import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { videoRoomName } from "@/lib/livekit/server";
import { startRoomRecording, recordingStorageKey } from "@/lib/livekit/egress";
import { canTeacherStartClass } from "@/lib/schedule/access-rules";
import { extractYouTubeVideoId } from "@/lib/live-class/youtube";

export async function POST(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedTransport =
      body?.videoTransport === "YOUTUBE" ? "YOUTUBE" : body?.videoTransport === "BOTH" ? "BOTH" : "LIVEKIT";
    const requestedYouTubeId = body?.youtubeVideoId ? extractYouTubeVideoId(String(body.youtubeVideoId)) : null;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true },
    });

    if (!schedule) return apiError("Scheduled class not found", 404);
    if (schedule.type !== "LIVE_CLASS") {
      return apiError("Only Live Class sessions can be transitioned to LIVE.", 400);
    }

    const now = new Date();

    // 1. Authoritative Server Time Validation (T-5 Rule)
    const evaluation = canTeacherStartClass(schedule, now);
    if (!evaluation.allowed) {
      return apiError(
        evaluation.reason || "Start Class is not available yet. Classes can only be started starting 5 minutes before scheduled start time.",
        403,
        {
          code: evaluation.code || "START_TOO_EARLY",
          details: {
            opensAt: evaluation.opensAt.toISOString(),
            startOpensAt: evaluation.startOpensAt.toISOString(),
            secondsUntilStartOpens: evaluation.secondsUntilStartOpens,
            serverTime: now.toISOString(),
          },
        }
      );
    }

    // 2. Authoritative Teacher Authorization
    let teacher = await prisma.teacher.findFirst({
      where: { userId: session.user.id },
    });

    const isDirectlyAssigned = teacher && (schedule.teacherId === teacher.id);
    const isBatchAssigned = teacher && (await prisma.batchTeacher.findFirst({
      where: { batchId: schedule.batchId, teacherId: teacher.id },
    }));

    const { hasPermission } = await import("@/lib/rbac/guard");
    const isAdmin = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    if (!isDirectlyAssigned && !isBatchAssigned && !isAdmin) {
      throw new ForbiddenError("You are not authorized to start this live class.");
    }

    if (!teacher && isAdmin) {
      if (schedule.teacherId) {
        teacher = await prisma.teacher.findUnique({ where: { id: schedule.teacherId } });
      }
      if (!teacher) {
        const code = Date.now().toString().slice(-6);
        teacher = await prisma.teacher.create({
          data: {
            userId: session.user.id,
            employeeCode: `ADM-INST-${code}`,
            department: "Academic Operations",
            subjects: ["General", "All Subjects"],
            bio: "Academic Administrator and Instructor",
          },
        });
      }
    }

    if (!teacher) return apiError("Teacher profile could not be resolved.", 403);

    // 3. Duplicate Start Protection / Idempotency Check
    const isAlreadyLive =
      schedule.status === "LIVE" &&
      schedule.liveWhiteboardSession?.livePhase === "LIVE" &&
      Boolean(schedule.liveWhiteboardSession?.actualStartedAt);

    if (isAlreadyLive && schedule.liveWhiteboardSession) {
      return apiSuccess({
        message: "Class is already LIVE.",
        whiteboardSession: schedule.liveWhiteboardSession,
        serverTime: now.toISOString(),
        alreadyLive: true,
      });
    }

    // 4. Atomic Transition to LIVE using Database Transaction
    //
    // WhiteboardSession is @unique on batchScheduleId (schema.prisma) - a
    // rescheduled or re-run class NEVER gets a new row, it's the same row
    // reused across every occurrence. The `update` branch below used to
    // just flip livePhase/status back to LIVE and leave `pages` (and every
    // recording/PDF/PPTX/YouTube-archive field) exactly as the PREVIOUS
    // occurrence left them - so starting a class that had already run once
    // silently opened with the old class's entire board still on it. Any
    // livePhase other than LIVE reaching this point means the previous
    // occurrence is over (isAlreadyLive above already returned early for a
    // genuinely still-live class), so it's safe - and correct per "every
    // class must start from a blank first slide" - to reset here.
    //
    // BUT: `livePhase !== "LIVE"` alone also matches "PREPARING" - the
    // state the preflight route sets the moment a teacher uploads slides in
    // advance via "Prepare Slides," before the class has ever gone live
    // even once. That session's `pages` already hold the just-converted,
    // real presentation - not leftovers from a previous occurrence - so
    // wiping them here (and every "Start Class" click after, since
    // presentationUrl survives the wipe and re-triggers client-side PDF
    // conversion from scratch every single time) is what caused "PDF
    // re-uploads page-by-page on every restart." The correct signal for "a
    // previous occurrence genuinely happened and ended" is whether the
    // session was EVER actually started before (actualStartedAt set) - a
    // merely-prepared, never-yet-live session has none.
    const existingSession = schedule.liveWhiteboardSession;
    const isNewOccurrence =
      Boolean(existingSession) &&
      existingSession!.livePhase !== "LIVE" &&
      Boolean(existingSession!.actualStartedAt);

    if (isNewOccurrence && (existingSession!.pdfStatus === "GENERATING" || existingSession!.pptxStatus === "GENERATING")) {
      return apiError(
        "The previous class's recording/notes are still being finalized. Please try Start Class again in a minute.",
        409,
        { code: "PREVIOUS_OCCURRENCE_FINALIZING" }
      );
    }

    const scheduledStart = schedule.startsAt ? new Date(schedule.startsAt) : now;
    const scheduledEnd = schedule.endsAt ? new Date(schedule.endsAt) : new Date(now.getTime() + 60 * 60 * 1000);

    // Auto-generated first slide (chapter name, lecture number, the
    // teacher's own profile photo — no manual upload) — generated BEFORE
    // the transaction below and baked directly into page 1 at creation, so
    // there's no window where a client could load a still-blank page 1.
    // Only needed when page 1 is actually about to be (re)created — the
    // two branches below ("brand new session" and "isNewOccurrence" reset)
    // are the only places `pages: { create: ... } }` appears; reconnecting
    // to an already-live session touches no pages at all.
    const willCreatePage1 = !existingSession || isNewOccurrence;
    let startSlideUrl: string | null = null;
    if (willCreatePage1) {
      try {
        const { generateCreative } = await import("@/lib/creative/engine");
        const result = await generateCreative("LECTURE_START_SLIDE", params.scheduleId);
        if (result.ok) startSlideUrl = result.assetUrl;
      } catch (slideErr) {
        console.error("[live_class_start_slide_error]", slideErr);
      }
    }

    const transactionOps: any[] = [
      prisma.batchSchedule.update({
        where: { id: params.scheduleId },
        data: { status: "LIVE" },
      }),
    ];
    if (isNewOccurrence) {
      transactionOps.push(
        prisma.whiteboardPage.deleteMany({ where: { sessionId: existingSession!.id } })
      );
    }
    transactionOps.push(
      prisma.whiteboardSession.upsert({
        where: { batchScheduleId: params.scheduleId },
        update: {
          livePhase: "LIVE",
          status: "ACTIVE",
          videoTransport: requestedTransport,
          youtubeVideoId: requestedYouTubeId,
          actualStartedAt: schedule.liveWhiteboardSession?.actualStartedAt || now,
          startedAt: schedule.liveWhiteboardSession?.startedAt || now,
          activePageNumber: 1,
          ...(isNewOccurrence && {
            endedAt: null,
            actualEndedAt: null,
            recordingStatus: "NONE",
            recordingStorageKey: null,
            recordingEgressId: null,
            recordingDurationSeconds: null,
            pdfStatus: "NONE",
            pptxStatus: "NONE",
            pdfStorageKey: null,
            pptxStorageKey: null,
            pdfFileAssetId: null,
            pptxFileAssetId: null,
            pdfError: null,
            pptxError: null,
            finalizedAt: null,
            youtubeArchiveStatus: "NOT_ENABLED",
            youtubeArchiveVideoId: null,
            youtubeArchiveVideoUrl: null,
            youtubeArchiveUploadAttempts: 0,
            youtubeArchiveLastError: null,
            youtubeArchiveUploadStartedAt: null,
            youtubeArchiveUploadedAt: null,
            youtubeArchiveProcessedAt: null,
            youtubeArchiveUploadSessionUrl: null,
            youtubeArchiveUploadOffset: null,
            youtubeArchiveThumbnailStatus: "NOT_STARTED",
            youtubeArchiveThumbnailError: null,
            youtubeArchiveMetadataSnapshot: Prisma.JsonNull,
            pages: { create: { pageNumber: 1, objects: [], ...(startSlideUrl && { background: startSlideUrl }) } },
          }),
        },
        create: {
          batchScheduleId: schedule.id,
          teacherId: teacher.id,
          title: schedule.title,
          status: "ACTIVE",
          livePhase: "LIVE",
          videoTransport: requestedTransport,
          youtubeVideoId: requestedYouTubeId,
          actualStartedAt: now,
          startedAt: now,
          scheduledStart,
          scheduledEnd,
          pages: {
            create: {
              pageNumber: 1,
              objects: [],
              ...(startSlideUrl && { background: startSlideUrl }),
            },
          },
        },
        include: {
          pages: { orderBy: { pageNumber: "asc" } },
        },
      })
    );

    // transactionOps is [batchSchedule.update, (whiteboardPage.deleteMany)?, whiteboardSession.upsert]
    // - length varies with isNewOccurrence, so pull by position (first/last)
    // rather than a fixed-arity destructure.
    const txResults = await prisma.$transaction(transactionOps);
    const updatedSchedule = txResults[0];
    const wbSession = txResults[txResults.length - 1];

    // Late-start compliance penalty — only on the genuine first transition
    // to LIVE for this occurrence (existingSession.actualStartedAt was
    // unset going into this request; a reconnect/retry after that point
    // would already have it set and must never re-penalize the same
    // start). Compared against the schedule's own startsAt, not `now`
    // twice, so this reflects server-authoritative clocks only.
    if (!existingSession?.actualStartedAt && schedule.startsAt) {
      await import("@/lib/batch/late-start-penalty")
        .then(({ applyLateStartPenaltyIfDue }) =>
          applyLateStartPenaltyIfDue({
            scheduleId: params.scheduleId,
            teacherId: teacher.id,
            scheduledStartsAt: new Date(schedule.startsAt!),
            actualStartedAt: now,
            startedByUserId: session.user.id,
          })
        )
        .catch((err) => console.error("[late_start_penalty_error]", err));
    }

    // 4.5. Auto-create a YouTube broadcast when no manual youtubeVideoId was
    // supplied, for both YouTube-involving modes:
    //  - BOTH ("Application Class + YouTube"): step 5's egress pushes RTMP
    //    to it directly (LiveKit-driven, costs egress minutes).
    //  - YOUTUBE ("YouTube Live Class"): step 5's egress is skipped
    //    entirely for this transport (see the `!== "YOUTUBE"` check below)
    //    — this just hands the teacher a ready Server URL/Stream Key to
    //    paste into their own OBS/Studio, so they never touch LiveKit at
    //    all for this mode (zero connection or egress minutes). The manual
    //    URL field stays available for a teacher who already has an
    //    external stream set up some other way.
    // Idempotent — ensureYoutubeBroadcastForWhiteboard reuses an existing
    // broadcast on this same WhiteboardSession rather than creating a
    // second one on a re-start/restart. Failure here is surfaced as a
    // warning, not a hard error — the class still starts either way.
    let youtubeRtmpUrl: string | undefined;
    let youtubeSimulcastWarning: string | null = null;
    if ((requestedTransport === "BOTH" || requestedTransport === "YOUTUBE") && !requestedYouTubeId) {
      try {
        const { youtubeLiveClassConfigured, ensureYoutubeBroadcastForWhiteboard } = await import(
          "@/lib/live-class/youtube-broadcast"
        );
        if (!youtubeLiveClassConfigured()) {
          youtubeSimulcastWarning = "YouTube isn't configured on this environment — class started on the interactive room only.";
        } else {
          const withBroadcast = await ensureYoutubeBroadcastForWhiteboard(wbSession.id, schedule.title, scheduledStart);
          // Merge the newly-created broadcast fields in so the response
          // (and the teacher UI's "also live on YouTube" indicator, plus the
          // Server URL/Stream Key display for YOUTUBE mode) reflects them
          // immediately, rather than the stale pre-broadcast wbSession.
          Object.assign(wbSession, {
            youtubeBroadcastId: withBroadcast.youtubeBroadcastId,
            youtubeStreamId: withBroadcast.youtubeStreamId,
            youtubeVideoId: withBroadcast.youtubeVideoId,
            youtubeLiveChatId: withBroadcast.youtubeLiveChatId,
            youtubeStatus: withBroadcast.youtubeStatus,
            youtubeIngestUrl: withBroadcast.youtubeIngestUrl,
            youtubeStreamKey: withBroadcast.youtubeStreamKey,
          });
          if (withBroadcast.youtubeIngestUrl && withBroadcast.youtubeStreamKey) {
            youtubeRtmpUrl = `${withBroadcast.youtubeIngestUrl.replace(/\/$/, "")}/${withBroadcast.youtubeStreamKey}`;
          }
        }
      } catch (youtubeError) {
        console.error("[live_class_youtube_broadcast_error]", youtubeError);
        youtubeSimulcastWarning = "Could not set up the YouTube simulcast for this class — it's live on the interactive room only.";
      }
    }

    // 5. Start Room Recording (Room Composite Egress -> R2, plus a live RTMP
    // push to YouTube when youtubeRtmpUrl is set) - Idempotent, single identity
    let recordingWarning: string | null = null;

    if (requestedTransport !== "YOUTUBE") {
      const isAlreadyRecording =
        wbSession.recordingStatus === "RECORDING" ||
        wbSession.recordingStatus === "RECORDING_STARTING" ||
        wbSession.recordingStatus === "STARTING" ||
        Boolean(wbSession.recordingEgressId);

      if (!isAlreadyRecording) {
        try {
          await prisma.whiteboardSession
            .update({ where: { id: wbSession.id }, data: { recordingStatus: "RECORDING_STARTING" } })
            .catch(() => null);

          const storageKey = recordingStorageKey(wbSession.id);
          const egress = await startRoomRecording(videoRoomName(wbSession.id), storageKey, youtubeRtmpUrl);
          if (egress?.egressId) {
            await prisma.whiteboardSession
              .update({
                where: { id: wbSession.id },
                data: { recordingEgressId: egress.egressId, recordingStatus: "RECORDING" },
              })
              .catch(() => null);
          } else {
            recordingWarning = "Recording could not be confirmed as started. This class may not be recorded.";
          }
        } catch (recordingError) {
          console.error("[live_class_recording_start_error]", recordingError);
          // If this class has YouTube Live streaming active, YouTube automatically archives and records the video directly to YouTube as a live archive (VOD).
          // Therefore, students WILL get the recorded video via YouTube, and we must NOT falsely alarm the teacher with RECORDING_FAILED.
          if (requestedYouTubeId || wbSession.youtubeVideoId) {
            await prisma.whiteboardSession
              .update({ where: { id: wbSession.id }, data: { recordingStatus: "RECORDING" } })
              .catch(() => null);
            recordingWarning = null;
          } else {
            await prisma.whiteboardSession
              .update({ where: { id: wbSession.id }, data: { recordingStatus: "RECORDING_FAILED" } })
              .catch(() => null);
            recordingWarning = "Recording failed to start for this class. Students will not get a recorded video for it.";
          }
        }
      }
    }

    // 6. Realtime Broadcast State Change
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.LIVE_PHASE_CHANGED, {
        phase: "LIVE",
        livePhase: "LIVE",
        videoTransport: requestedTransport,
        youtubeVideoId: requestedYouTubeId,
        actualStartedAt: (wbSession.actualStartedAt || now).toISOString(),
        serverTime: now.toISOString(),
      });
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.CONFIG_UPDATED, {
        videoTransport: requestedTransport,
        youtubeVideoId: requestedYouTubeId,
      });
    } catch (pushErr) {
      console.warn("Realtime broadcast warning:", pushErr);
    }

    // 7. Dispatch LIVE_CLASS_STARTED notification event to enrolled students
    try {
      const { triggerNotificationEvent } = await import("@/lib/notifications/engine");
      const { cancelScheduledNotifications } = await import("@/lib/notifications/scheduler");
      const { NotificationType, NotificationCategory, NotificationPriority } = await import("@/lib/notifications/types");

      // Cancel any future scheduled start alert or 15m reminder to prevent duplicates
      await cancelScheduledNotifications(NotificationType.CLASS_STARTED, schedule.id).catch(() => {});
      await cancelScheduledNotifications(NotificationType.CLASS_REMINDER_15_MIN, schedule.id).catch(() => {});

      await triggerNotificationEvent({
        eventType: NotificationType.LIVE_CLASS_STARTED,
        category: NotificationCategory.CLASSES,
        priority: NotificationPriority.HIGH,
        entityId: schedule.id,
        classId: schedule.id,
        batchId: schedule.batchId,
        title: `🔴 Live Now: ${schedule.title}`,
        body: `Your live class has started. Tap to join now!`,
        deepLink: `/live-class/${schedule.id}`,
        actionType: "JOIN_CLASS",
        actionUrl: `/live-class/${schedule.id}`,
        metadata: {
          classId: schedule.id,
          className: schedule.title,
          liveStartedAt: (wbSession.actualStartedAt || now).toISOString(),
          batchId: schedule.batchId,
        },
        idempotencyKey: `class-live:${schedule.id}`,
      });
    } catch (err) {
      console.error("[LIVE_CLASS_STARTED notification error]", err);
    }

    return apiSuccess({
      message: "Class started successfully.",
      whiteboardSession: wbSession,
      schedule: updatedSchedule,
      serverTime: now.toISOString(),
      startSlideUrl,
      recordingWarning,
      youtubeSimulcastWarning,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
