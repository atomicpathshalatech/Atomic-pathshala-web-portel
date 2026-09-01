import "server-only";
import { prisma } from "@/lib/db";
import { pusherServer, sessionChannel, teacherChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { GRACE_PERIOD_MINUTES } from "@/lib/whiteboard/constants";

/** True once `now` is past this class's scheduled end plus the grace window. */
export function isPastGracePeriod(endsAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > endsAt.getTime() + GRACE_PERIOD_MINUTES * 60_000;
}

/**
 * Shared end-of-class logic — used by both the teacher-initiated manual end
 * (POST .../end) and the lazy backend auto-end check in
 * resolveWhiteboardAccess (there is no cron/worker in this app, so auto-end
 * is enforced the same way DeviceSession revocation is: re-checked on every
 * request that touches the session, not on a schedule). One implementation,
 * two callers, per the "no parallel systems" rule.
 *
 * Idempotent: a session already ENDED is returned as-is, so a race between
 * a manual end and a concurrent auto-end check is harmless.
 */
export async function endWhiteboardSession(
  sessionId: string,
  opts: { endedByUserId: string | null; reason: "manual" | "auto_grace_expired" }
) {
  const existing = await prisma.whiteboardSession.findUnique({
    where: { id: sessionId },
    include: { batchSchedule: true },
  });
  if (!existing) return null;
  if (existing.status === "ENDED") return existing;

  const [ended] = await prisma.$transaction([
    prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt: new Date(), livePhase: "ENDED" },
    }),
    prisma.handRaiseEvent.updateMany({
      where: { whiteboardSessionId: sessionId, status: "PENDING" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    }),
    prisma.quizSession.updateMany({
      where: { whiteboardSessionId: sessionId, status: { in: ["ACTIVE", "REVEALED"] } },
      data: { status: "CLOSED" },
    }),
  ]);

  if (existing.batchSchedule.status === "LIVE") {
    await prisma.batchSchedule.update({
      where: { id: existing.batchScheduleId },
      data: { status: "COMPLETED" },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: opts.endedByUserId,
      action: opts.reason === "manual" ? "WHITEBOARD_SESSION_ENDED" : "WHITEBOARD_SESSION_AUTO_ENDED",
      entityType: "WhiteboardSession",
      entityId: sessionId,
      metadata: { batchScheduleId: existing.batchScheduleId, reason: opts.reason },
    },
  });

  try {
    await pusherServer.trigger(sessionChannel(sessionId), WB_EVENTS.SESSION_ENDED, {});
    await pusherServer.trigger(teacherChannel(sessionId), WB_EVENTS.SESSION_ENDED, {});
  } catch (err) {
    // Realtime is a convenience nudge, not the source of truth — a client
    // that misses this will still see status: "ENDED" on its next fetch.
    console.error("[pusher_trigger_error]", err);
  }

  return ended;
}
