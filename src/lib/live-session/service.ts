import "server-only";
import { Prisma, type LiveSession } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  type DeliveryModeName,
  type LiveState,
  OPEN_STATES,
  PRE_LIVE_STATES,
  deliveryModeFor,
  predecessorsOf,
  stateAfterEnd,
} from "@/lib/live-session/states";

/**
 * Server-side LiveSession lifecycle. Every state change is a compare-and-set
 * (`UPDATE … WHERE state IN (legal predecessors)`), so two concurrent
 * requests can never skip a state or double-apply one.
 *
 * During the transition period the old WhiteboardSession fields
 * (livePhase/status/scheduledEnd) are still what most existing routes read;
 * the helpers here keep them in step (dual-write) rather than replacing
 * them all at once.
 */

export class LiveSessionTransitionError extends Error {
  readonly code = "INVALID_LIVE_STATE_TRANSITION";
  constructor(readonly liveSessionId: string, readonly to: LiveState, readonly actual: LiveState | null) {
    super(`Live session ${liveSessionId} cannot move to ${to} from ${actual ?? "unknown"}.`);
    this.name = "LiveSessionTransitionError";
  }
}

type Db = Prisma.TransactionClient | typeof prisma;

/** The one not-yet-ended occurrence for a schedule, if any (DB guarantees at most one). */
export function getOpenLiveSession(batchScheduleId: string, db: Db = prisma) {
  return db.liveSession.findFirst({
    where: { batchScheduleId, state: { in: [...OPEN_STATES] } },
    orderBy: { occurrence: "desc" },
  });
}

/** Latest occurrence (open or not) for a schedule. */
export function getLatestLiveSession(batchScheduleId: string, db: Db = prisma) {
  return db.liveSession.findFirst({ where: { batchScheduleId }, orderBy: { occurrence: "desc" } });
}

/**
 * Compare-and-set transition. Only succeeds if the row is currently in one of
 * `to`'s legal predecessor states. Returns the updated row; throws
 * LiveSessionTransitionError otherwise. Transitioning to the state the row is
 * already in is treated as success (idempotent retries).
 */
export async function transitionLiveSession(
  liveSessionId: string,
  to: LiveState,
  data: Prisma.LiveSessionUncheckedUpdateManyInput = {},
  db: Db = prisma
): Promise<LiveSession> {
  const res = await db.liveSession.updateMany({
    where: { id: liveSessionId, state: { in: predecessorsOf(to) } },
    data: { ...data, state: to, stateChangedAt: new Date() },
  });
  const row = await db.liveSession.findUnique({ where: { id: liveSessionId } });
  if (res.count === 0 && row?.state !== to) {
    throw new LiveSessionTransitionError(liveSessionId, to, (row?.state as LiveState) ?? null);
  }
  return row!;
}

export type EnsureOpenInput = {
  batchScheduleId: string;
  whiteboardSessionId: string;
  controllingTeacherId: string;
  plannedStartsAt: Date;
  plannedEndsAt: Date;
  videoTransport: string;
  youtubeBroadcastId?: string | null;
  youtubeVideoId?: string | null;
};

/**
 * Returns the schedule's open occurrence, creating the next one
 * (occurrence = latest + 1) when none is open. A fresh occurrence starts with
 * NO YouTube or recording state — nothing from an earlier run carries over.
 * Safe under concurrent calls: the partial unique index allows only one open
 * row per schedule, and a losing insert re-reads the winner.
 */
export async function ensureOpenLiveSession(input: EnsureOpenInput): Promise<LiveSession> {
  const existing = await getOpenLiveSession(input.batchScheduleId);
  if (existing) {
    if (existing.whiteboardSessionId !== input.whiteboardSessionId) {
      return prisma.liveSession.update({ where: { id: existing.id }, data: { whiteboardSessionId: input.whiteboardSessionId } });
    }
    return existing;
  }

  const latest = await getLatestLiveSession(input.batchScheduleId);
  const { deliveryMode, youtubeChannel } = deliveryModeFor(input);
  const effectiveEndsAt =
    input.plannedEndsAt.getTime() > input.plannedStartsAt.getTime()
      ? input.plannedEndsAt
      : new Date(input.plannedStartsAt.getTime() + 60 * 60_000);

  try {
    return await prisma.liveSession.create({
      data: {
        batchScheduleId: input.batchScheduleId,
        occurrence: (latest?.occurrence ?? 0) + 1,
        whiteboardSessionId: input.whiteboardSessionId,
        deliveryMode,
        youtubeChannel,
        youtubeBroadcastId: deliveryMode === "APP_YOUTUBE" ? input.youtubeBroadcastId ?? null : null,
        youtubeVideoId: deliveryMode === "LEGACY_LIVEKIT" ? null : input.youtubeVideoId ?? input.youtubeBroadcastId ?? null,
        state: "SCHEDULED",
        controllingTeacherId: input.controllingTeacherId,
        plannedStartsAt: input.plannedStartsAt,
        effectiveEndsAt,
      },
    });
  } catch (err) {
    // Lost a race with another request creating the same occurrence.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await getOpenLiveSession(input.batchScheduleId);
      if (winner) return winner;
    }
    throw err;
  }
}

/** Updates the delivery mode/YouTube ids on an open occurrence (e.g. a manual link saved, or the broadcast failed and the class fell back to the room). */
export function setLiveSessionDelivery(
  liveSessionId: string,
  input: { videoTransport: string; youtubeBroadcastId?: string | null; youtubeVideoId?: string | null; verifiedMainChannel?: boolean }
) {
  const { deliveryMode, youtubeChannel } = deliveryModeFor(input);
  return prisma.liveSession.update({
    where: { id: liveSessionId },
    data: {
      deliveryMode,
      youtubeChannel,
      youtubeBroadcastId: deliveryMode === "APP_YOUTUBE" ? input.youtubeBroadcastId ?? null : null,
      youtubeVideoId: deliveryMode === "LEGACY_LIVEKIT" ? null : input.youtubeVideoId ?? input.youtubeBroadcastId ?? null,
    },
  });
}

/** All occurrences that move together with this one: its simulcast group's open sessions, or just itself. */
async function groupOpenSessions(session: LiveSession, db: Db = prisma): Promise<LiveSession[]> {
  if (!session.simulcastGroupId) return [session];
  return db.liveSession.findMany({
    where: { simulcastGroupId: session.simulcastGroupId, state: { in: [...OPEN_STATES] } },
  });
}

/**
 * Current pipeline start: → STARTING → LIVE for this occurrence and every
 * open occurrence in its simulcast group, and marks exactly those schedules
 * LIVE. (The stream-pool step inserts the YouTube health gate between
 * STARTING and LIVE for APP_YOUTUBE.)
 */
export async function markLiveSessionLive(liveSessionId: string, startedAt: Date): Promise<LiveSession[]> {
  const session = await prisma.liveSession.findUniqueOrThrow({ where: { id: liveSessionId } });
  return liftSessionsLive(await groupOpenSessions(session), startedAt);
}

/**
 * The group members of an APP_YOUTUBE primary that just reached LIVE through
 * the YouTube health gate: the other schedules have no stream of their own,
 * so they go straight STARTING → LIVE alongside it.
 */
export async function markGroupMembersLive(liveSessionId: string, startedAt: Date): Promise<LiveSession[]> {
  const session = await prisma.liveSession.findUniqueOrThrow({ where: { id: liveSessionId } });
  const members = (await groupOpenSessions(session)).filter((m) => m.id !== session.id);
  return liftSessionsLive(members, startedAt);
}

async function liftSessionsLive(members: LiveSession[], startedAt: Date): Promise<LiveSession[]> {
  if (members.length === 0) return [];
  const out: LiveSession[] = [];
  for (const member of members) {
    if (member.state === "LIVE") {
      out.push(member);
      continue;
    }
    if (member.state !== "STARTING") {
      await transitionLiveSession(member.id, "STARTING");
    }
    out.push(await transitionLiveSession(member.id, "LIVE", { actualStartedAt: member.actualStartedAt ?? startedAt }));
  }
  await prisma.batchSchedule.updateMany({
    where: { id: { in: out.map((s) => s.batchScheduleId) } },
    data: { status: "LIVE" },
  });
  return out;
}

/**
 * END: → ENDING → RECORDING_PROCESSING (YouTube modes: the recording is
 * confirmed later by asking YouTube, never assumed) or COMPLETED (legacy
 * room without a recording). Applies to the whole simulcast group and marks
 * exactly those schedules COMPLETED — no sibling is left LIVE.
 */
export async function markLiveSessionEnded(
  liveSessionId: string,
  opts: { endedAt: Date; hasLegacyRecording: boolean }
): Promise<LiveSession[]> {
  const session = await prisma.liveSession.findUniqueOrThrow({ where: { id: liveSessionId } });
  const members = session.simulcastGroupId
    ? await prisma.liveSession.findMany({ where: { simulcastGroupId: session.simulcastGroupId, state: { in: ["LIVE", "ENDING"] } } })
    : [session];

  const out: LiveSession[] = [];
  for (const member of members) {
    if (member.state !== "LIVE" && member.state !== "ENDING") {
      out.push(member);
      continue;
    }
    if (member.state === "LIVE") await transitionLiveSession(member.id, "ENDING", { actualEndedAt: opts.endedAt });
    const next = stateAfterEnd(member.deliveryMode as DeliveryModeName, member.id === session.id && opts.hasLegacyRecording);
    out.push(await transitionLiveSession(member.id, next, { actualEndedAt: member.actualEndedAt ?? opts.endedAt }));
  }
  await prisma.batchSchedule.updateMany({
    where: { id: { in: out.map((s) => s.batchScheduleId) } },
    data: { status: "COMPLETED" },
  });
  return out;
}

/**
 * Extend: moves THE authoritative end (LiveSession.effectiveEndsAt) for the
 * whole simulcast group, pushes any stream lease expiry forward with it, and
 * mirrors the new end onto WhiteboardSession.scheduledEnd for code that
 * still reads it. One transaction.
 */
export async function extendLiveSession(liveSessionId: string, addedMinutes: number): Promise<LiveSession[]> {
  const session = await prisma.liveSession.findUniqueOrThrow({ where: { id: liveSessionId } });
  const members = await groupOpenSessions(session);
  const addMs = addedMinutes * 60_000;

  return prisma.$transaction(async (tx) => {
    const out: LiveSession[] = [];
    for (const member of members) {
      const newEnd = new Date(member.effectiveEndsAt.getTime() + addMs);
      const updated = await tx.liveSession.update({
        where: { id: member.id },
        data: { effectiveEndsAt: newEnd, totalExtendedMinutes: { increment: addedMinutes } },
      });
      await tx.streamLease.updateMany({
        where: { liveSessionId: member.id, state: { in: ["RESERVED", "BOUND", "ACTIVE", "RELEASING"] } },
        data: { expiresAt: new Date(newEnd.getTime() + 30 * 60_000) },
      });
      if (member.whiteboardSessionId) {
        await tx.whiteboardSession.update({
          where: { id: member.whiteboardSessionId },
          data: { scheduledEnd: newEnd, totalExtendedMinutes: updated.totalExtendedMinutes },
        });
      }
      out.push(updated);
    }
    return out;
  });
}

/**
 * The end time auto-end must honour for a whiteboard session: its open
 * occurrence's effectiveEndsAt when there is one, else the legacy "later of
 * schedule end and session end" rule (for sessions not yet backfilled).
 */
export async function authoritativeEndFor(wb: {
  id: string;
  scheduledEnd: Date | null;
  batchSchedule: { id: string; endsAt: Date };
}): Promise<Date> {
  const open = await prisma.liveSession.findFirst({
    where: { batchScheduleId: wb.batchSchedule.id, state: { in: [...OPEN_STATES] } },
    select: { effectiveEndsAt: true },
    orderBy: { occurrence: "desc" },
  });
  if (open) return open.effectiveEndsAt;
  const { effectiveClassEnd } = await import("@/lib/whiteboard/lifecycle");
  return effectiveClassEnd(wb.batchSchedule.endsAt, wb.scheduledEnd);
}

/** Reschedule: a not-yet-live occurrence moves with the schedule. A live or ended one is left alone. */
export async function rescheduleOpenLiveSession(batchScheduleId: string, startsAt: Date, endsAt: Date) {
  const end = endsAt.getTime() > startsAt.getTime() ? endsAt : new Date(startsAt.getTime() + 60 * 60_000);
  // The room's own clock (countdown + auto-end) reads the whiteboard
  // session's scheduledStart/End. A room opened before the reschedule kept
  // the OLD times, so the class was auto-ended the moment it started (the
  // old end had passed) — seen in the second real test class. Move it too,
  // unless the class is actually live right now.
  await prisma.whiteboardSession.updateMany({
    where: { batchScheduleId, livePhase: { not: "LIVE" } },
    data: { scheduledStart: startsAt, scheduledEnd: end, totalExtendedMinutes: 0 },
  });
  return prisma.liveSession.updateMany({
    where: { batchScheduleId, state: { in: [...PRE_LIVE_STATES] } },
    data: { plannedStartsAt: startsAt, effectiveEndsAt: end },
  });
}

/** Cancel: a not-yet-live occurrence becomes CANCELLED (and releases nothing — it never held a stream). */
export async function cancelOpenLiveSession(batchScheduleId: string) {
  return prisma.liveSession.updateMany({
    where: { batchScheduleId, state: { in: ["SCHEDULED", "READY"] } },
    data: { state: "CANCELLED", stateChangedAt: new Date() },
  });
}

/**
 * Brings the occurrence's LiveSession row in step with a class that just
 * went live (Start Class, or an admin mapping a YouTube video as live):
 * creates the occurrence if needed (fresh — no YouTube/recording state from
 * any earlier run), records the delivery mode students will actually get,
 * and moves it (and its simulcast group, if any) to LIVE.
 */
export async function syncLiveSessionOnStart(input: {
  schedule: { id: string; startsAt: Date; endsAt: Date };
  wbSession: {
    id: string;
    videoTransport: string;
    youtubeBroadcastId?: string | null;
    youtubeVideoId?: string | null;
    scheduledEnd?: Date | null;
  };
  teacherId: string;
  startedAt: Date;
  verifiedMainChannel?: boolean;
}): Promise<LiveSession[]> {
  const { effectiveClassEnd } = await import("@/lib/whiteboard/lifecycle");
  const delivery = {
    videoTransport: input.wbSession.videoTransport,
    youtubeBroadcastId: input.wbSession.youtubeBroadcastId ?? null,
    youtubeVideoId: input.wbSession.youtubeVideoId ?? null,
    verifiedMainChannel: input.verifiedMainChannel ?? false,
  };
  const open = await ensureOpenLiveSession({
    batchScheduleId: input.schedule.id,
    whiteboardSessionId: input.wbSession.id,
    controllingTeacherId: input.teacherId,
    plannedStartsAt: new Date(input.schedule.startsAt),
    plannedEndsAt: effectiveClassEnd(new Date(input.schedule.endsAt), input.wbSession.scheduledEnd ?? null),
    ...delivery,
  });
  // An APP_YOUTUBE class waiting on YouTube only goes LIVE through the
  // health gate (src/lib/live-session/app-youtube.ts) — never via a retried
  // Start or a mapping call.
  if (open.deliveryMode === "APP_YOUTUBE" && ["STARTING", "YOUTUBE_CONNECTING", "YOUTUBE_ACTIVE"].includes(open.state)) {
    return [open];
  }
  await setLiveSessionDelivery(open.id, delivery);
  return markLiveSessionLive(open.id, input.startedAt);
}
