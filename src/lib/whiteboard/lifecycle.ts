import "server-only";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/db";
import { pusherServer, sessionChannel, teacherChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { GRACE_PERIOD_MINUTES } from "@/lib/whiteboard/constants";

/** True once `now` is past this class's scheduled end plus the grace window. */
export function isPastGracePeriod(endsAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > endsAt.getTime() + GRACE_PERIOD_MINUTES * 60_000;
}

/**
 * The end time auto-end must honour. "Extend Class" only moves
 * WhiteboardSession.scheduledEnd, so reading BatchSchedule.endsAt alone
 * force-ended every extended class at its original time + grace. Interim
 * fix until the LiveSession.effectiveEndsAt redesign lands: take the later
 * of the two.
 */
export function effectiveClassEnd(scheduleEndsAt: Date, sessionScheduledEnd: Date | null | undefined): Date {
  if (!sessionScheduledEnd) return scheduleEndsAt;
  return sessionScheduledEnd.getTime() > scheduleEndsAt.getTime() ? sessionScheduledEnd : scheduleEndsAt;
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

  // The occurrence's lifecycle row decides how the video/recording side is
  // wound down. With a YouTube delivery mode, the recording is confirmed
  // later by asking YouTube (checkRecordingReadiness) — never marked READY,
  // and the lecture link never published, just because class ended.
  const { getOpenLiveSession } = await import("@/lib/live-session/service");
  const openLiveSession = await getOpenLiveSession(existing.batchScheduleId).catch((err) => {
    console.error("[live_session_lookup_error]", sessionId, err);
    return null;
  });
  const youtubeManaged =
    openLiveSession !== null &&
    (openLiveSession.deliveryMode === "APP_YOUTUBE" ||
      openLiveSession.deliveryMode === "MAIN_YOUTUBE" ||
      openLiveSession.deliveryMode === "EXTERNAL_YOUTUBE");

  // Stop LiveKit Room Recording if active. waitUntil() keeps this function
  // alive past the HTTP response — a bare fire-and-forget import().then()
  // has no guarantee of completing on Vercel serverless once the response
  // is sent (this was silently losing the recording on every "End Class"
  // click before this fix).
  if (
    existing.recordingEgressId &&
    (existing.recordingStatus === "RECORDING" ||
      existing.recordingStatus === "RECORDING_STARTING" ||
      existing.recordingStatus === "STARTING")
  ) {
    waitUntil(
      import("@/lib/livekit/egress")
        .then(({ stopRoomRecording }) => stopRoomRecording(existing.recordingEgressId!))
        .catch((err) => console.warn("[stopRoomRecording_on_end_error]", err))
    );
  }

  // Legacy path only (a session with no lifecycle row yet): the old
  // behaviour of completing the broadcast and linking the lecture at once.
  if (!openLiveSession) {
    if (existing.youtubeBroadcastId) {
      waitUntil(
        import("@/lib/youtube/live-broadcast")
          .then(({ transitionBroadcast }) => transitionBroadcast(existing.youtubeBroadcastId!, "complete"))
          .catch((err) => console.warn("[youtube_transition_complete_warning]", err))
      );
    }
    if (existing.batchSchedule?.lectureId && existing.youtubeVideoId) {
      waitUntil(
        prisma.lecture
          .update({
            where: { id: existing.batchSchedule.lectureId },
            data: {
              videoUrl: `https://www.youtube.com/watch?v=${existing.youtubeVideoId}`,
              status: "PUBLISHED",
            },
          })
          .catch((err) => console.warn("[lecture_videoUrl_update_error]", err))
      );
    }
  }

  // Every scheduled class has an ACTIVE session row from the moment it is
  // scheduled, so the auto-end also reaches classes nobody ever started.
  // Those were never taught: they are CANCELLED, not COMPLETED (no "Play
  // Class", no empty board PDF).
  const neverStarted =
    opts.reason === "auto_grace_expired" &&
    !existing.actualStartedAt &&
    existing.livePhase !== "LIVE" &&
    existing.livePhase !== "ENDING";

  const isRecordingActive =
    existing.recordingEgressId &&
    (existing.recordingStatus === "RECORDING" ||
      existing.recordingStatus === "RECORDING_STARTING" ||
      existing.recordingStatus === "STARTING");

  const [ended] = await prisma.$transaction([
    prisma.whiteboardSession.update({
      where: { id: sessionId },
      data: {
        status: "ENDED",
        livePhase: neverStarted ? "CANCELLED" : "ENDED",
        endedAt: existing.endedAt || now,
        actualEndedAt: neverStarted ? existing.actualEndedAt : existing.actualEndedAt || now,
        ...(isRecordingActive && { recordingStatus: "PROCESSING" }),
        ...(youtubeManaged && existing.youtubeVideoId && { recordingStatus: "PROCESSING", recordingVideoId: null }),
        ...(!openLiveSession &&
          existing.youtubeVideoId && {
            recordingVideoId: existing.youtubeVideoId,
            recordingStatus: "READY",
          }),
      },
    }),

    prisma.batchSchedule.update({
      where: { id: existing.batchScheduleId },
      data: { status: neverStarted ? "CANCELLED" : "COMPLETED" },
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

  // Lifecycle row: LIVE → ENDING → RECORDING_PROCESSING (YouTube modes wait
  // for YouTube to confirm the recording) or COMPLETED, for this occurrence
  // and its simulcast group — so no grouped sibling schedule stays LIVE. A
  // class ended before YouTube ever went live → FAILED (its unused broadcast
  // is deleted). APP_YOUTUBE then completes its broadcast and returns its
  // stream to the pool. Non-fatal: students must still be moved out of the
  // class even if this bookkeeping fails; the stale-lease sweep cleans up.
  if (openLiveSession) {
    try {
      const { markLiveSessionEnded, transitionLiveSession } = await import("@/lib/live-session/service");
      const { finishAppYoutubeBroadcast, PRE_LIVE_YOUTUBE_STATES } = await import("@/lib/live-session/app-youtube");
      const endedBeforeLive = (PRE_LIVE_YOUTUBE_STATES as readonly string[]).includes(openLiveSession.state);
      // OBS stage links for this occurrence stop working now.
      const { revokeStageTokens } = await import("@/lib/live-class/stage-session");
      await revokeStageTokens(openLiveSession.id);
      if (endedBeforeLive) {
        await transitionLiveSession(openLiveSession.id, "FAILED", { failureReason: "ended_before_live", actualEndedAt: now });
      } else if (openLiveSession.state === "LIVE" || openLiveSession.state === "ENDING") {
        await markLiveSessionEnded(openLiveSession.id, { endedAt: now, hasLegacyRecording: Boolean(isRecordingActive) });
      }
      if (openLiveSession.deliveryMode === "APP_YOUTUBE") {
        waitUntil(
          finishAppYoutubeBroadcast(openLiveSession.id, endedBeforeLive).catch((err) =>
            console.warn("[app_youtube_finish_warning]", sessionId, err)
          )
        );
      }
    } catch (err) {
      console.error("[live_session_end_error]", sessionId, err);
    }
  }


  // Realtime broadcast to transition students immediately to post-class feedback screen
  try {
    await pusherServer.trigger(sessionChannel(sessionId), WB_EVENTS.SESSION_ENDED, {
      livePhase: "ENDED",
      endedAt: now.toISOString(),
    });
    await pusherServer.trigger(sessionChannel(sessionId), WB_EVENTS.LIVE_PHASE_CHANGED, {
      phase: "ENDED",
      livePhase: "ENDED",
      endedAt: now.toISOString(),
    });
    await pusherServer.trigger(teacherChannel(sessionId), WB_EVENTS.SESSION_ENDED, {
      livePhase: "ENDED",
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

  // Trigger background slide generation & R2 upload (PDF & PPTX with
  // watermark) — same waitUntil reasoning as stopRoomRecording above.
  // A class that never started has no board to export.
  if (!neverStarted) waitUntil(
    import("@/lib/whiteboard/finalization")
      .then(({ finalizeWhiteboardSlides }) => finalizeWhiteboardSlides(sessionId))
      .catch((err) => console.error("[finalizeWhiteboardSlides_trigger_error]", err))
  );

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

