import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";
import { syncLiveSessionOnStart } from "@/lib/live-session/service";
import { announceClassLive } from "@/lib/live-session/announce";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { videoRoomName } from "@/lib/livekit/server";
import { startRoomRecording, recordingStorageKey } from "@/lib/livekit/egress";
import { canTeacherStartClass } from "@/lib/schedule/access-rules";
import { extractYouTubeVideoId } from "@/lib/live-class/youtube";
import { issueStageToken, stageUrl } from "@/lib/live-class/stage-session";
import { YOUTUBE_OAUTH_PRODUCTION_URL } from "@/lib/youtube/oauth-config";
import { appYoutubeAvailable, pickVideoTransport } from "@/lib/live-session/delivery-options";

export async function POST(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    let schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true },
    });

    if (!schedule) {
      const lecture = await prisma.lecture.findUnique({
        where: { id: params.scheduleId },
        include: { chapter: true, teacher: true },
      });
      if (lecture) {
        schedule = await prisma.batchSchedule.findFirst({
          where: { OR: [{ id: lecture.id }, { lectureId: lecture.id }] },
          include: { liveWhiteboardSession: true },
        });
      }
    }

    if (!schedule) return apiError("Scheduled class not found", 404);
    if (schedule.type !== "LIVE_CLASS") {
      return apiError("Only Live Class sessions can be transitioned to LIVE.", 400);
    }

    // App class = this class's own unlisted YouTube stream. The LiveKit room
    // is only a fallback while App YouTube isn't set up on this server (see
    // src/lib/live-session/delivery-options.ts).
    const requestedTransport = pickVideoTransport(
      body?.videoTransport,
      schedule.liveWhiteboardSession?.videoTransport,
      await appYoutubeAvailable().catch(() => false)
    );

    // WhiteboardSession is @unique on batchScheduleId - a rescheduled or
    // re-run class NEVER gets a new row, it's the same row reused across
    // every occurrence. Any livePhase other than LIVE reaching this point
    // with actualStartedAt set means a previous occurrence genuinely ran and
    // ended (a merely prepared, never-live session has no actualStartedAt -
    // see the "Prepare Slides" note further down).
    const existingSession = schedule.liveWhiteboardSession;
    const isNewOccurrence =
      Boolean(existingSession) &&
      existingSession!.livePhase !== "LIVE" &&
      Boolean(existingSession!.actualStartedAt);

    // A new occurrence must never inherit the previous run's YouTube video —
    // only an id sent with THIS request counts. (Falling back to the stored
    // id used to put students of a re-run class onto the old, finished
    // broadcast.)
    const bodyYouTubeId = body?.youtubeVideoId ? extractYouTubeVideoId(String(body.youtubeVideoId)) : null;
    const requestedYouTubeId = bodyYouTubeId ?? (isNewOccurrence ? null : existingSession?.youtubeVideoId ?? null);

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

    // 2. Authoritative Teacher Authorization — the schedule's assigned
    // teacher or a LIVE_CLASS_ADMIN (see src/lib/live-class/ownership.ts).
    const { teacher } = await assertCanControlLiveClass(session.user.id, schedule.id);
    if (!teacher) return apiError("Teacher profile could not be resolved.", 403);

    // 3. Duplicate Start Protection / Idempotency Check
    const isAlreadyLive =
      schedule.status === "LIVE" &&
      schedule.liveWhiteboardSession?.livePhase === "LIVE" &&
      Boolean(schedule.liveWhiteboardSession?.actualStartedAt);

    if (isAlreadyLive && schedule.liveWhiteboardSession) {
      // A retry after a partial failure: make sure the lifecycle row caught up too.
      // (An APP_YOUTUBE class still connecting to YouTube stays connecting.)
      const [current] = await syncLiveSessionOnStart({
        schedule,
        wbSession: schedule.liveWhiteboardSession,
        teacherId: teacher.id,
        startedAt: schedule.liveWhiteboardSession.actualStartedAt ?? now,
      });
      const { youtubeStreamKey: _key, youtubeIngestUrl: _url, ...safeSession } = schedule.liveWhiteboardSession;
      return apiSuccess({
        message: current?.state === "LIVE" ? "Class is already LIVE." : "Class is starting — waiting for YouTube to receive the stream.",
        whiteboardSession: safeSession,
        serverTime: now.toISOString(),
        alreadyLive: current?.state === "LIVE",
        liveState: current?.state ?? "LIVE",
        youtubeConnecting: current?.state !== "LIVE",
      });
    }

    // 3.5. Simulcast group: one group = one room. If another member schedule
    // of this group is already running the room, this one must not open a
    // second room — its students are already watching that one.
    const { groupRoomRunByAnotherSchedule } = await import("@/lib/live-session/simulcast");
    const roomElsewhere = await groupRoomRunByAnotherSchedule(schedule.id);
    if (roomElsewhere) {
      return apiError(
        "This class is taught together with another batch's class that is already running. Open that class instead.",
        409,
        { code: "SIMULCAST_ROOM_ELSEWHERE", details: { scheduleId: roomElsewhere } }
      );
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
    // merely-prepared, never-yet-live session has none. (existingSession /
    // isNewOccurrence are computed at the top of this handler.)
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
        const result = await generateCreative("LECTURE_START_SLIDE", schedule.id);
        if (result.ok) startSlideUrl = result.assetUrl;
      } catch (slideErr) {
        console.error("[live_class_start_slide_error]", slideErr);
      }
    }

    const transactionOps: any[] = [
      prisma.batchSchedule.update({
        where: { id: schedule.id },
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
        where: { batchScheduleId: schedule.id },
        update: {
          livePhase: "LIVE",
          status: "ACTIVE",
          videoTransport: requestedTransport,
          youtubeVideoId: requestedYouTubeId,
          actualStartedAt: schedule.liveWhiteboardSession?.actualStartedAt || now,
          startedAt: schedule.liveWhiteboardSession?.startedAt || now,
          activePageNumber: 1,
          // First start of a room that was opened earlier (e.g. before a
          // reschedule): its clock must follow the schedule as it is NOW,
          // or the room auto-ends the class against a stale end time.
          ...(!isNewOccurrence && !schedule.liveWhiteboardSession?.actualStartedAt && { scheduledStart, scheduledEnd }),
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
            // A new occurrence gets its own YouTube broadcast/stream and
            // recording — nothing from the previous run carries over.
            youtubeBroadcastId: null,
            youtubeStreamId: null,
            youtubeLiveChatId: null,
            youtubeStatus: null,
            youtubeIngestUrl: null,
            youtubeStreamKey: null,
            recordingVideoId: null,
            scheduledStart,
            scheduledEnd,
            totalExtendedMinutes: 0,
            extensionHistory: Prisma.JsonNull,
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

    // Sibling batches are NOT flipped LIVE here any more. Each schedule has
    // its own lifecycle; schedules only move together when an admin put
    // them in the same simulcast group (handled by markLiveSessionLive
    // below). The old implicit "same lectureId → LIVE" sync also left those
    // siblings stuck LIVE forever, since End Class never completed them.

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
            scheduleId: schedule.id,
            teacherId: teacher.id,
            scheduledStartsAt: new Date(schedule.startsAt!),
            actualStartedAt: now,
            startedByUserId: session.user.id,
          })
        )
        .catch((err) => console.error("[late_start_penalty_error]", err));
    }

    // 4.5. Auto-create a YouTube broadcast when no manual youtubeVideoId was
    // supplied, for both YouTube-involving modes. BOTH and YOUTUBE now both
    // hand the teacher OBS credentials + an /obs-stage broadcast-page URL
    // (see BroadcastStage.tsx) instead of paying for LiveKit Egress — Egress
    // Room Composite only ever records LiveKit room tracks (camera/mic), and
    // the whiteboard/PPT canvas is 100% client-side and never becomes a
    // LiveKit track, so a BOTH-mode Egress recording never actually showed
    // the board. OBS capturing /obs-stage shows exactly what students see.
    // Idempotent — ensureYoutubeBroadcastForWhiteboard reuses an existing
    // broadcast on this same WhiteboardSession rather than creating a
    // second one on a re-start/restart. Failure here is surfaced as a
    // warning, not a hard error — the class still starts either way.
    let youtubeSimulcastWarning: string | null = null;
    let obsBroadcastUrl: string | undefined;
    let effectiveTransport = requestedTransport;

    // wbSession is the post-upsert row: for a new occurrence its YouTube
    // fields were just reset, so only this request's id (if any) counts.
    const existingYtId = requestedYouTubeId || wbSession.youtubeVideoId || null;

    // 4.5. APP_YOUTUBE: a per-class stream from the pool + this occurrence's
    // own unlisted broadcast (no shared master stream key any more). The
    // class is NOT live yet: it waits in YOUTUBE_CONNECTING until YouTube
    // actually receives the teacher's stream (see the stream-status route),
    // and only then do students see it live and get notified.
    let appYoutubeConnecting = false;
    if ((requestedTransport === "BOTH" || requestedTransport === "YOUTUBE") && !existingYtId) {
      // An App Class whose YouTube broadcast cannot be created (quota used
      // up, YouTube down) still has to run: it becomes an interactive App
      // Class in the app's own room, instead of a class with no video.
      const livekitReady = Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
      const fallBack = async (warning: string, toInteractive = false) => {
        youtubeSimulcastWarning = warning;
        if (requestedTransport === "BOTH" || (toInteractive && livekitReady)) {
          effectiveTransport = "LIVEKIT";
          await prisma.whiteboardSession.update({ where: { id: wbSession.id }, data: { videoTransport: "LIVEKIT" } }).catch(() => null);
          wbSession.videoTransport = "LIVEKIT";
        }
      };
      try {
        const { youtubeLiveClassConfigured } = await import("@/lib/live-class/youtube-broadcast");
        const { appYoutubePoolConfigured, beginAppYoutubeStart } = await import("@/lib/live-session/app-youtube");
        if (!youtubeLiveClassConfigured() || !(await appYoutubePoolConfigured())) {
          await fallBack(
            requestedTransport === "YOUTUBE"
              ? "YouTube class streaming isn't set up on this server yet (no stream slots). Paste your YouTube Live link in OBS Setup, or ask an admin to set up stream slots."
              : "YouTube class streaming isn't set up on this server yet — class started on the interactive room only."
          );
        } else {
          const teacherName = (await prisma.user.findFirst({ where: { teacher: { id: teacher.id } }, select: { name: true } }))?.name;
          const began = await beginAppYoutubeStart({
            schedule: { id: schedule.id, title: schedule.title, startsAt: new Date(schedule.startsAt), endsAt: new Date(schedule.endsAt) },
            wbSession: { id: wbSession.id, scheduledEnd: wbSession.scheduledEnd ?? null },
            teacherId: teacher.id,
            broadcastTitle: `${schedule.title}${teacherName ? ` | ${teacherName}` : ""} | Atomic Pathshala`,
          });
          Object.assign(wbSession, {
            youtubeBroadcastId: began.youtubeBroadcastId,
            youtubeVideoId: began.youtubeBroadcastId,
            youtubeIngestUrl: null,
            youtubeStreamKey: null,
          });
          effectiveTransport = requestedTransport;
          appYoutubeConnecting = began.liveSession.state !== "LIVE";
        }
      } catch (youtubeError) {
        console.error("[live_class_youtube_broadcast_error]", youtubeError);
        const { describeYoutubeError } = await import("@/lib/youtube/errors");
        const { NoIngestCapacityError } = await import("@/lib/youtube/stream-pool");
        const reason =
          youtubeError instanceof NoIngestCapacityError ? youtubeError.message : describeYoutubeError(youtubeError);
        await fallBack(
          requestedTransport === "YOUTUBE" && !livekitReady
            ? `Could not set up the YouTube broadcast. ${reason} You can paste your stream link in OBS Setup.`
            : `Could not set up the YouTube broadcast. ${reason} Interactive App Class is active for all students.`,
          true
        );
      }
    }

    // 5. Start Room Recording (Room Composite Egress -> R2) for LIVEKIT-only
    // classes. BOTH and YOUTUBE both skip this now (see 4.5's comment) —
    // YouTube's own live-stream auto-archive becomes the recording for
    // those, exactly like the YOUTUBE-only branch already assumed below.
    let recordingWarning: string | null = null;

    if (requestedTransport === "LIVEKIT") {
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

    // 5.5 + 6 + 7. Lifecycle row, realtime state, "Live Now" notification.
    // APP_YOUTUBE classes skip all three here: they are still connecting to
    // YouTube, and the stream-status route does this once YouTube actually
    // receives the stream. Everything else is live right now.
    let liveState: string = "LIVE";
    if (appYoutubeConnecting) {
      liveState = "YOUTUBE_CONNECTING";
    } else {
      await syncLiveSessionOnStart({
        schedule,
        wbSession: { ...wbSession, videoTransport: effectiveTransport },
        teacherId: teacher.id,
        startedAt: wbSession.actualStartedAt ?? now,
      });
      await announceClassLive({
        schedule,
        whiteboardSessionId: wbSession.id,
        aliasChannelId: params.scheduleId,
        videoTransport: effectiveTransport,
        youtubeVideoId: requestedYouTubeId || wbSession.youtubeVideoId || null,
        startedAt: wbSession.actualStartedAt || now,
      });
    }

    // OBS Browser Source URL: a revocable stage token for this occurrence
    // (issued now that the occurrence's LiveSession row exists).
    if (requestedTransport === "BOTH" || requestedTransport === "YOUTUBE") {
      const stageToken = await issueStageToken({ batchScheduleId: schedule.id, issuedToUserId: session.user.id });
      if (stageToken) obsBroadcastUrl = stageUrl(YOUTUBE_OAUTH_PRODUCTION_URL, schedule.id, stageToken);
    }

    return apiSuccess({
      message: "Class started successfully.",
      whiteboardSession: wbSession,
      schedule: updatedSchedule,
      serverTime: now.toISOString(),
      startSlideUrl,
      recordingWarning,
      youtubeSimulcastWarning,
      obsBroadcastUrl,
      liveState,
      youtubeConnecting: appYoutubeConnecting,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

