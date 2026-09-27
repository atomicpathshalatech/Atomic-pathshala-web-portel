import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";
import { reconcileRecordingStatus } from "@/lib/livekit/egress";

/**
 * Catch-up recording playback & metadata endpoint.
 * Strict RBAC: Only authorized teachers, academic admins, and enrolled batch students
 * can access live class recordings.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) return apiError("Forbidden: You are not authorized to view this recording.", 403);

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        batchScheduleId: true,
        teacherId: true,
        recordingStatus: true,
        recordingStorageKey: true,
        recordingDurationSeconds: true,
        recordingEgressId: true,
        actualStartedAt: true,
        startedAt: true,
        actualEndedAt: true,
        endedAt: true,
        createdAt: true,
        youtubeArchiveStatus: true,
        youtubeArchiveVideoUrl: true,
        youtubeVideoId: true,
        videoTransport: true,
      },
    });

    if (!wbSession) return apiError("Live class session not found", 404);

    // YouTube-delivered occurrences: the recording is whatever YouTube has
    // CONFIRMED processed — nothing is guessed from youtubeVideoId. While
    // YouTube is still processing, viewers get "processing", not a link to
    // a video that may not exist yet. Checking YouTube is single-flight (at
    // most once per 2 minutes per class, however many students ask).
    const latestLiveSession = await prisma.liveSession.findFirst({
      where: { whiteboardSessionId: params.id },
      orderBy: { occurrence: "desc" },
    });
    if (
      latestLiveSession &&
      ["APP_YOUTUBE", "MAIN_YOUTUBE", "EXTERNAL_YOUTUBE"].includes(latestLiveSession.deliveryMode)
    ) {
      let current = latestLiveSession;
      if (current.state === "RECORDING_PROCESSING") {
        const { checkRecordingReadiness } = await import("@/lib/live-session/app-youtube");
        await checkRecordingReadiness(current.id).catch((err) => console.warn("[recording_readiness_check_warning]", err));
        current = (await prisma.liveSession.findUnique({ where: { id: current.id } })) ?? current;
      }
      const ready = Boolean(current.recordingVideoId);
      return apiSuccess({
        recordingId: current.id,
        classId: wbSession.batchScheduleId,
        liveSessionId: wbSession.id,
        providerRecordingId: current.recordingVideoId,
        status: ready ? "READY" : current.state === "FAILED" ? "FAILED" : "PROCESSING",
        available: ready,
        url: ready ? `https://www.youtube.com/watch?v=${current.recordingVideoId}` : null,
        message: ready ? null : current.state === "FAILED" ? "The recording for this class is not available." : "Recording is processing. Please check back in a few minutes.",
        startedAt: current.actualStartedAt ?? wbSession.actualStartedAt ?? wbSession.startedAt,
        stoppedAt: current.actualEndedAt ?? wbSession.actualEndedAt ?? wbSession.endedAt,
        durationSeconds: null,
        storagePath: null,
        resourceId: null,
        createdAt: wbSession.createdAt,
      });
    }

    // Self-heal a missed egress_ended webhook via LiveKit reconciliation
    const reconciled = await reconcileRecordingStatus({
      id: params.id,
      recordingStatus: wbSession.recordingStatus,
      recordingEgressId: wbSession.recordingEgressId,
    });
    const effective = reconciled
      ? { ...wbSession, ...reconciled }
      : wbSession;

    // Look up FileAsset if storageKey exists
    let fileAsset = null;
    if (effective.recordingStorageKey) {
      fileAsset = await prisma.fileAsset.findUnique({
        where: { storageKey: effective.recordingStorageKey },
      });
    }

    const isReady = effective.recordingStatus === "READY" && Boolean(effective.recordingStorageKey);

    // YouTube archive or live YouTube stream replay
    const youtubeReady = wbSession.youtubeArchiveStatus === "COMPLETED" && Boolean(wbSession.youtubeArchiveVideoUrl);
    const directYouTubeUrl = wbSession.youtubeVideoId
      ? `https://www.youtube.com/watch?v=${wbSession.youtubeVideoId}`
      : null;

    let presignedUrl: string | null = null;
    if (youtubeReady) {
      presignedUrl = wbSession.youtubeArchiveVideoUrl;
    } else if (directYouTubeUrl) {
      presignedUrl = directYouTubeUrl;
    } else if (isReady && effective.recordingStorageKey) {
      presignedUrl = await createPresignedDownloadUrl({
        key: effective.recordingStorageKey,
        expiresInSeconds: 3600, // 1 hour private playback token
      });
    }

    return apiSuccess({
      recordingId: fileAsset?.id || effective.id,
      classId: effective.batchScheduleId,
      liveSessionId: effective.id,
      providerRecordingId: effective.recordingEgressId || null,
      status: effective.recordingStatus,
      available: isReady || youtubeReady || Boolean(directYouTubeUrl),
      url: presignedUrl,
      startedAt: effective.actualStartedAt || effective.startedAt,
      stoppedAt: effective.actualEndedAt || effective.endedAt,
      durationSeconds: effective.recordingDurationSeconds || null,
      storagePath: effective.recordingStorageKey || null,
      resourceId: fileAsset?.id || null,
      createdAt: effective.createdAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

