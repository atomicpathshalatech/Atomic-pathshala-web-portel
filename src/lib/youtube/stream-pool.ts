import "server-only";
import type { StreamLease, YoutubeIngestStream } from "@prisma/client";
import { prisma } from "@/lib/db";
import { openSecret, sealSecret } from "@/lib/crypto/secret-box";
import { createPoolIngestStream, deleteIngestStream } from "@/lib/youtube/live-broadcast";

/**
 * The APP channel's ingest stream pool. Replaces the old single "master"
 * stream key every class shared (two teachers live at once collided on it).
 *
 *   - N long-lived, reusable YouTube liveStreams (N = max concurrent App
 *     classes). Created once; each costs ~50 quota units.
 *   - A class takes an exclusive, expiring LEASE on one stream at Start
 *     (SELECT … FOR UPDATE SKIP LOCKED, plus a partial unique index in SQL
 *     so no stream can ever hold two active leases).
 *   - The lease is released after the class's broadcast is completed.
 *   - Stream keys are stored encrypted and only ever handed to the class's
 *     own controller for the lease's lifetime.
 */

export const ACTIVE_LEASE_STATES = ["RESERVED", "BOUND", "ACTIVE", "RELEASING"] as const;
const LEASE_GRACE_MS = 30 * 60_000;

export class NoIngestCapacityError extends Error {
  readonly code = "NO_INGEST_CAPACITY";
  constructor() {
    super("All live-class stream slots are in use right now. Try again when another class ends, or ask an admin to add a slot.");
    this.name = "NoIngestCapacityError";
  }
}

export async function poolStatus() {
  const streams = await prisma.youtubeIngestStream.findMany({
    where: { channel: "APP" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      youtubeStreamId: true,
      status: true,
      keyRotatedAt: true,
      lastReleasedAt: true,
      leases: {
        where: { state: { in: [...ACTIVE_LEASE_STATES] } },
        select: { id: true, state: true, expiresAt: true, liveSession: { select: { id: true, batchScheduleId: true, state: true } } },
      },
    },
  });
  return {
    total: streams.filter((s) => s.status !== "RETIRED").length,
    available: streams.filter((s) => s.status === "AVAILABLE").length,
    streams,
  };
}

/** Creates reusable ingest streams until the pool has `size` usable ones. ~50 quota units per stream created. */
export async function provisionPool(size: number): Promise<number> {
  const usable = await prisma.youtubeIngestStream.count({ where: { channel: "APP", status: { in: ["AVAILABLE", "LEASED"] } } });
  let created = 0;
  for (let i = usable; i < size; i++) {
    const stream = await createPoolIngestStream(`Atomic Pathshala class slot ${i + 1}`);
    await prisma.youtubeIngestStream.create({
      data: {
        channel: "APP",
        youtubeStreamId: stream.id,
        ingestAddress: stream.ingestUrl,
        streamNameEnc: sealSecret(stream.streamKey),
        keyRotatedAt: new Date(),
      },
    });
    created++;
  }
  return created;
}

/** Existing active lease for a live session, if any. */
export function getActiveLease(liveSessionId: string) {
  return prisma.streamLease.findFirst({
    where: { liveSessionId, state: { in: [...ACTIVE_LEASE_STATES] } },
    include: { stream: true },
  });
}

/**
 * Exclusive lease on a free stream for this live session. Idempotent (returns
 * the session's existing active lease). Concurrency: FOR UPDATE SKIP LOCKED
 * makes simultaneous starts pick different streams instead of blocking, and
 * the partial unique index rejects any lease that would still collide.
 */
export async function acquireStreamLease(liveSessionId: string, classEndsAt: Date): Promise<StreamLease & { stream: YoutubeIngestStream }> {
  const existing = await getActiveLease(liveSessionId);
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "youtube_ingest_streams"
      WHERE "channel" = 'APP' AND "status" = 'AVAILABLE'
      ORDER BY "lastReleasedAt" ASC NULLS FIRST, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1`;
    const streamId = rows[0]?.id;
    if (!streamId) throw new NoIngestCapacityError();

    await tx.youtubeIngestStream.update({ where: { id: streamId }, data: { status: "LEASED" } });
    return tx.streamLease.create({
      data: { streamId, liveSessionId, state: "RESERVED", expiresAt: new Date(classEndsAt.getTime() + LEASE_GRACE_MS) },
      include: { stream: true },
    });
  });
}

export function markLease(leaseId: string, state: "BOUND" | "ACTIVE" | "RELEASING") {
  return prisma.streamLease.update({ where: { id: leaseId }, data: { state } });
}

/** Ends a lease and returns its stream to the pool. Safe to call twice. */
export async function releaseStreamLease(leaseId: string, outcome: "RELEASED" | "FAILED" = "RELEASED") {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const lease = await tx.streamLease.findUnique({ where: { id: leaseId } });
    if (!lease || lease.state === "RELEASED" || lease.state === "FAILED") return;
    await tx.streamLease.update({ where: { id: leaseId }, data: { state: outcome, releasedAt: now } });
    const stillLeased = await tx.streamLease.count({
      where: { streamId: lease.streamId, id: { not: leaseId }, state: { in: [...ACTIVE_LEASE_STATES] } },
    });
    if (stillLeased === 0) {
      await tx.youtubeIngestStream.updateMany({
        where: { id: lease.streamId, status: "LEASED" },
        data: { status: "AVAILABLE", lastReleasedAt: now },
      });
    }
  });
}

/** Releases every active lease a live session holds. */
export async function releaseLeasesForSession(liveSessionId: string) {
  const leases = await prisma.streamLease.findMany({
    where: { liveSessionId, state: { in: [...ACTIVE_LEASE_STATES] } },
    select: { id: true },
  });
  for (const l of leases) await releaseStreamLease(l.id);
}

/**
 * Leases whose class is over (terminal/post-live state) or whose expiry has
 * passed go back to the pool. Called from the stale-session cron.
 */
export async function sweepStaleLeases(now = new Date()): Promise<number> {
  const stale = await prisma.streamLease.findMany({
    where: {
      state: { in: [...ACTIVE_LEASE_STATES] },
      OR: [
        { expiresAt: { lt: now } },
        { liveSession: { state: { in: ["RECORDING_PROCESSING", "RECORDING_READY", "COMPLETED", "CANCELLED", "FAILED", "READY"] } } },
      ],
    },
    select: { id: true },
  });
  for (const l of stale) await releaseStreamLease(l.id);
  return stale.length;
}

/** RTMP(S) target for a lease — only for the lease holder's controller; never stored in plaintext. */
export function leaseIngestCredentials(stream: YoutubeIngestStream): { serverUrl: string; streamKey: string } {
  return { serverUrl: stream.ingestAddress, streamKey: openSecret(stream.streamNameEnc) };
}

/**
 * Key rotation for an idle stream: deletes the YouTube stream and creates a
 * fresh one (~100 quota units). Use weekly, and whenever a teacher account
 * with past access is removed.
 */
export async function rotateIdleStream(poolStreamId: string) {
  const stream = await prisma.youtubeIngestStream.findUniqueOrThrow({ where: { id: poolStreamId } });
  if (stream.status !== "AVAILABLE") throw new Error("Only an idle (AVAILABLE) stream can be rotated.");
  await prisma.youtubeIngestStream.update({ where: { id: poolStreamId }, data: { status: "DISABLED" } });
  try {
    const fresh = await createPoolIngestStream("Atomic Pathshala class slot (rotated)");
    await prisma.youtubeIngestStream.create({
      data: { channel: "APP", youtubeStreamId: fresh.id, ingestAddress: fresh.ingestUrl, streamNameEnc: sealSecret(fresh.streamKey), keyRotatedAt: new Date() },
    });
    await prisma.youtubeIngestStream.update({ where: { id: poolStreamId }, data: { status: "RETIRED" } });
    await deleteIngestStream(stream.youtubeStreamId).catch((err) => console.warn("[stream_pool_rotate_delete_warning]", err));
  } catch (err) {
    await prisma.youtubeIngestStream.update({ where: { id: poolStreamId }, data: { status: "AVAILABLE" } });
    throw err;
  }
}
