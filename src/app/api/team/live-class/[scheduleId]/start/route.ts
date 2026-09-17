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
    const requestedTransport = body?.videoTransport === "YOUTUBE" ? "YOUTUBE" : "LIVEKIT";
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
    const existingSession = schedule.liveWhiteboardSession;
    const isNewOccurrence = Boolean(existingSession) && existingSession!.livePhase !== "LIVE";

    if (isNewOccurrence && (existingSession!.pdfStatus === "GENERATING" || existingSession!.pptxStatus === "GENERATING")) {
      return apiError(
        "The previous class's recording/notes are still being finalized. Please try Start Class again in a minute.",
        409,
        { code: "PREVIOUS_OCCURRENCE_FINALIZING" }
      );
    }

    const scheduledStart = schedule.startsAt ? new Date(schedule.startsAt) : now;
    const scheduledEnd = schedule.endsAt ? new Date(schedule.endsAt) : new Date(now.getTime() + 60 * 60 * 1000);

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
            pages: { create: { pageNumber: 1, objects: [] } },
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

    // 5. Start Room Recording (Room Composite Egress -> R2) - Idempotent, single identity
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
          const egress = await startRoomRecording(videoRoomName(wbSession.id), storageKey);
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
          await prisma.whiteboardSession
            .update({ where: { id: wbSession.id }, data: { recordingStatus: "RECORDING_FAILED" } })
            .catch(() => null);
          recordingWarning = "Recording failed to start for this class. Students will not get a recorded video for it.";
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

    // 8. Auto-generated first slide (spec section 10) — the educator never
    // manually creates/uploads this. Resolved straight from this same
    // BatchSchedule (educator, chapter, lecture, batch — all already known
    // here), rendered by the one shared creative engine, and cached: a
    // second "Start Class" call (a refresh, a retry) reuses the same
    // asset instead of re-rendering.
    let startSlideUrl: string | null = null;
    try {
      const { generateCreative } = await import("@/lib/creative/engine");
      const result = await generateCreative("LECTURE_START_SLIDE", params.scheduleId);
      if (result.ok) startSlideUrl = result.assetUrl;
    } catch (slideErr) {
      console.error("[live_class_start_slide_error]", slideErr);
    }

    return apiSuccess({
      message: "Class started successfully.",
      whiteboardSession: wbSession,
      schedule: updatedSchedule,
      serverTime: now.toISOString(),
      startSlideUrl,
      recordingWarning,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
