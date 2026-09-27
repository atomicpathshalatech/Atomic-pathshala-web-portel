import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { OPEN_STATES } from "@/lib/live-session/states";

/**
 * Tokens for the OBS broadcast stage (/obs-stage/[scheduleId]) — the page an
 * OBS Browser Source loads without a login cookie.
 *
 * Replaces the old stateless HMAC token, which could not be revoked and was
 * not tied to one live occurrence. Each token here is:
 *   - random (256-bit), stored only as its SHA-256 hash;
 *   - bound to exactly one schedule AND one LiveSession occurrence;
 *   - short-lived (class end + 30 min, never more than 12 h);
 *   - revoked when the class ends;
 *   - valid only while that occurrence is open.
 * A Class A token can never open Class B: every lookup is by hash and must
 * match the schedule in the URL.
 */

const MAX_TTL_MS = 12 * 60 * 60_000;
const AFTER_END_MS = 30 * 60_000;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{40,64}$/;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap shape check so garbage is rejected without touching the database. */
export function looksLikeStageToken(token: string | null | undefined): token is string {
  return Boolean(token && TOKEN_SHAPE.test(token));
}

/**
 * Issues a stage token for the schedule's open occurrence. Returns null when
 * the class has no open occurrence yet (the stage has nothing to show).
 */
export async function issueStageToken(input: { batchScheduleId: string; issuedToUserId: string }): Promise<string | null> {
  const session = await prisma.liveSession.findFirst({
    where: { batchScheduleId: input.batchScheduleId, state: { in: [...OPEN_STATES] } },
    orderBy: { occurrence: "desc" },
    select: { id: true, effectiveEndsAt: true },
  });
  if (!session) return null;

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = new Date(Math.min(session.effectiveEndsAt.getTime() + AFTER_END_MS, now + MAX_TTL_MS));
  await prisma.broadcastStageSession.create({
    data: {
      liveSessionId: session.id,
      batchScheduleId: input.batchScheduleId,
      issuedToUserId: input.issuedToUserId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Math.max(expiresAt.getTime(), now + 5 * 60_000)),
    },
  });
  return token;
}

export type VerifiedStage = {
  liveSessionId: string;
  batchScheduleId: string;
  whiteboardSessionId: string;
  issuedToUserId: string;
};

/**
 * Server-side verification. `expectedScheduleId`, when given, must be the
 * schedule the token was issued for (the id in the stage URL).
 */
export async function verifyStageToken(token: string | null | undefined, expectedScheduleId?: string): Promise<VerifiedStage | null> {
  if (!looksLikeStageToken(token)) return null;
  const row = await prisma.broadcastStageSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { liveSession: { select: { state: true, whiteboardSessionId: true } } },
  });
  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return null;
  if (expectedScheduleId && row.batchScheduleId !== expectedScheduleId) return null;
  if (!OPEN_STATES.includes(row.liveSession.state as (typeof OPEN_STATES)[number])) return null;
  if (!row.liveSession.whiteboardSessionId) return null;
  return {
    liveSessionId: row.liveSessionId,
    batchScheduleId: row.batchScheduleId,
    whiteboardSessionId: row.liveSession.whiteboardSessionId,
    issuedToUserId: row.issuedToUserId,
  };
}

/** Revokes every stage token of an occurrence (called when the class ends). */
export function revokeStageTokens(liveSessionId: string) {
  return prisma.broadcastStageSession.updateMany({
    where: { liveSessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Builds the OBS Browser Source URL for a freshly issued token. */
export function stageUrl(baseUrl: string, batchScheduleId: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/obs-stage/${batchScheduleId}?token=${encodeURIComponent(token)}`;
}
