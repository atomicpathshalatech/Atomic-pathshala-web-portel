import "server-only";
import { prisma } from "@/lib/db";
import { pusherServer, sessionChannel, teacherChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { GRACE_PERIOD_MINUTES } from "@/lib/whiteboard/constants";

/** True once `now` is past this class's scheduled end plus the grace window. */
export function isPastGracePeriod(endsAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > endsAt.getTime() + GRACE_PERIOD_MINUTES * 60_000;
}

/**
 * Transitions live class from LIVE -> ENDING.
 *
 * Atomically:
 * - Changes livePhase to ENDING
 * - Sets actualEndedAt to current server timestamp
 * - Blocks new student participation / resolves pending hand raises
 * - Stops LiveKit recording egress into PROCESSING
 * - Triggers background slide watermark finalization
 * - Broadcasts SESSION_ENDED to connected clients
 * - Preserves all chat, whiteboard, attendance, and presentation resources
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
  if (existing.status === "ENDED" || existing.livePhase === "ENDED") return existing;

  const now = new Date();

  // Stop LiveKit Room Recording if active
  if (
    existing.recordingEgressId &&
    (existing.recordingStatus === "RECORDING" ||
      existing.recordingStatus === "RECORDING_STARTING" ||
      existing.recordingStatus === "STARTING")
  ) {
    import("@/lib/livekit/egress")
      .then(({ stopRoomRecording }) => stopRoomRecording(existing.recordingEgressId!))
      .catch((err) => console.warn("[stopRoomRecording_on_end_error]", err));
  }

  const isRecordingActive =
    existing.recordingEgressId &&
    (existing.recordingStatus === "RECORDING" ||
      existing.recordingStatus === "RECORDING_STARTING" ||
      existing.recordingStatus === "STARTING");

  const [ended] = await prisma.$transaction([
    prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: {
        livePhase: "ENDING",
        endedAt: existing.endedAt || now,
        actualEndedAt: existing.actualEndedAt || now,
        ...(isRecordingActive && { recordingStatus: "PROCESSING" }),
      },
    }),

    prisma.handRaiseEvent.updateMany({
      where: { whiteboardSessionId: sessionId, status: "PENDING" },
      data: { status: "RESOLVED", resolvedAt: now },
    }),
    prisma.quizSession.updateMany({
      where: { whiteboardSessionId: sessionId, status: { in: ["ACTIVE", "REVEALED"] } },
      data: { status: "CLOSED" },
    }),
  ]);

  // Realtime broadcast to transition students immediately to post-class feedback screen
  try {
    await pusherServer.trigger(sessionChannel(sessionId), WB_EVENTS.SESSION_ENDED, {
      livePhase: "ENDING",
      endedAt: now.toISOString(),
    });
    await pusherServer.trigger(sessionChannel(sessionId), WB_EVENTS.LIVE_PHASE_CHANGED, {
      phase: "ENDING",
      livePhase: "ENDING",
      endedAt: now.toISOString(),
    });
    await pusherServer.trigger(teacherChannel(sessionId), WB_EVENTS.SESSION_ENDED, {
      livePhase: "ENDING",
      endedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[pusher_trigger_error]", err);
  }

  // Record audit log
  prisma.auditLog
    .create({
      data: {
        userId: opts.endedByUserId,
        action: opts.reason === "manual" ? "WHITEBOARD_SESSION_ENDED" : "WHITEBOARD_SESSION_AUTO_ENDED",
        entityType: "WhiteboardSession",
        entityId: sessionId,
        metadata: { batchScheduleId: existing.batchScheduleId, reason: opts.reason },
      },
    })
    .catch((err) => console.error("[audit_log_error]", err));

  // Trigger background slide generation & R2 upload (PDF & PPTX with watermark)
  import("@/lib/whiteboard/finalization")
    .then(({ finalizeWhiteboardSlides }) => finalizeWhiteboardSlides(sessionId))
    .catch((err) => console.error("[finalizeWhiteboardSlides_trigger_error]", err));

  return ended;
}

/**
 * Finalizes class from ENDING -> COMPLETED (Ended).
 *
 * Performs:
 * - Attendance summary finalization (sets leftAt and calculates attendance_status)
 * - Persists teacher technical review and delivery notes
 * - Transitions whiteboardSession.status to ENDED, livePhase to ENDED
 * - Transitions batchSchedule.status to COMPLETED
 * - Idempotent: safe against repeat submissions
 */
export async function finalizeWhiteboardSession(
  sessionId: string,
  opts: {
    userId: string;
    teacherId: string;
    feedback?: {
      networkOk?: boolean;
      audioOk?: boolean;
      videoOk?: boolean;
      whiteboardOk?: boolean;
      engagementOk?: boolean;
      issueDescription?: string;
      rating?: number;
      tags?: string[];
    };
  }
) {
  const existing = await prisma.whiteboardSession.findUnique({
    where: { id: sessionId },
    include: { batchSchedule: true, attendances: true },
  });
  if (!existing) return null;

  const now = new Date();
  const classEnd = existing.actualEndedAt || existing.endedAt || now;

  // 1. Finalize attendance for all students (set leftAt for open attendances)
  await prisma.liveClassAttendance.updateMany({
    where: { whiteboardSessionId: sessionId, leftAt: null },
    data: { leftAt: classEnd },
  });

  // 2. Persist teacher feedback if supplied
  if (opts.feedback) {
    await prisma.teacherClassFeedback.upsert({
      where: { whiteboardSessionId: sessionId },
      create: {
        whiteboardSessionId: sessionId,
        teacherId: opts.teacherId,
        networkOk: opts.feedback.networkOk ?? true,
        audioOk: opts.feedback.audioOk ?? true,
        videoOk: opts.feedback.videoOk ?? true,
        whiteboardOk: opts.feedback.whiteboardOk ?? true,
        engagementOk: opts.feedback.engagementOk ?? true,
        issueDescription: opts.feedback.issueDescription,
        rating: opts.feedback.rating ?? 5,
      },
      update: {
        networkOk: opts.feedback.networkOk ?? true,
        audioOk: opts.feedback.audioOk ?? true,
        videoOk: opts.feedback.videoOk ?? true,
        whiteboardOk: opts.feedback.whiteboardOk ?? true,
        engagementOk: opts.feedback.engagementOk ?? true,
        issueDescription: opts.feedback.issueDescription,
        rating: opts.feedback.rating ?? 5,
      },
    });
  }

  // 3. Atomically transition session to ENDED and batchSchedule to COMPLETED
  const [completedSession] = await prisma.$transaction([
    prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: {
        status: "ENDED",
        livePhase: "ENDED",
        endedAt: classEnd,
        actualEndedAt: classEnd,
      },
    }),
    prisma.batchSchedule.update({
      where: { id: existing.batchScheduleId },
      data: { status: "COMPLETED" },
    }),
  ]);

  // 4. Audit Log
  prisma.auditLog
    .create({
      data: {
        userId: opts.userId,
        action: "WHITEBOARD_SESSION_COMPLETED",
        entityType: "WhiteboardSession",
        entityId: sessionId,
        metadata: { batchScheduleId: existing.batchScheduleId, attendanceCount: existing.attendances.length },
      },
    })
    .catch((err) => console.error("[audit_log_error]", err));

  return completedSession;
}

