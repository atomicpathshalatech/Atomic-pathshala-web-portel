import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { startCloudStageStreaming, stopCloudStageStreaming } from "@/lib/livekit/egress";
import { issueStageToken, stageUrl } from "@/lib/live-class/stage-session";
import { YOUTUBE_OAUTH_PRODUCTION_URL } from "@/lib/youtube/oauth-config";
import { encoderCredentialsForSchedule } from "@/lib/live-session/app-youtube";
import { openSecret } from "@/lib/crypto/secret-box";

/**
 * Cloud Web Egress Stream Controller:
 * Enables 100% standalone tablet teaching without any Windows laptop or OBS.
 * LiveKit Cloud opens the stage URL in headless Chromium and pipes the rendered
 * canvas/audio directly into YouTube's RTMP ingest stream.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const { schedule, teacher } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!schedule || !teacher) return apiError("Scheduled class not found or unauthorized.", 404);

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { batchScheduleId: schedule.id },
    });
    if (!wbSession) return apiError("Whiteboard session has not been created yet. Tap Start Class first.", 400);

    // 1. Resolve RTMP Ingest Credentials
    const leased = await encoderCredentialsForSchedule(schedule.id);
    let manual: { serverUrl: string; streamKey: string } | null = null;
    if (wbSession.youtubeStreamKey) {
      try {
        manual = {
          serverUrl: wbSession.youtubeIngestUrl || "rtmp://a.rtmp.youtube.com/live2",
          streamKey: openSecret(wbSession.youtubeStreamKey),
        };
      } catch (err) {
        console.error("[cloud_stream_manual_unreadable]", err);
      }
    }

    const creds = manual ?? leased;
    if (!creds?.serverUrl || !creds?.streamKey) {
      return apiError(
        "No active stream lease found for this class. Make sure Start Class was clicked and a stream slot is reserved.",
        400,
        { code: "NO_STREAM_SLOT" }
      );
    }

    // 2. Generate Authorized Stage Broadcast URL
    const stageToken = await issueStageToken({
      batchScheduleId: schedule.id,
      issuedToUserId: session.user.id,
    });
    if (!stageToken) {
      return apiError("Could not issue secure stage token for cloud streamer.", 500);
    }

    const fullStageUrl = stageUrl(YOUTUBE_OAUTH_PRODUCTION_URL, schedule.id, stageToken);
    const rtmpDestination = `${creds.serverUrl.replace(/\/+$/, "")}/${creds.streamKey}`;

    // 3. Launch LiveKit Cloud Headless Stage Egress
    const egressInfo = await startCloudStageStreaming({
      stageUrl: fullStageUrl,
      youtubeRtmpUrl: rtmpDestination,
      storageKey: `recordings/${wbSession.id}/cloud_${Date.now()}.mp4`,
    });

    // 4. Record active cloud egress
    if (egressInfo?.egressId) {
      await prisma.whiteboardSession.update({
        where: { id: wbSession.id },
        data: {
          recordingEgressId: egressInfo.egressId,
          recordingStatus: "RECORDING",
        },
      });
    }

    return apiSuccess({
      cloudStreamStarted: true,
      egressId: egressInfo?.egressId ?? null,
      stageUrl: fullStageUrl,
      destinationServer: creds.serverUrl,
      message: "Cloud streaming engine is now streaming your class stage directly to YouTube Live.",
    });
  } catch (error: any) {
    console.error("[cloud_stream_start_error]", error);
    return apiError(
      error?.message || "Cloud streaming engine is temporarily unavailable. You can use Studio Relay / OBS fallback.",
      500,
      { code: "CLOUD_EGRESS_FAILED" }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { schedule } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!schedule) return apiError("Scheduled class not found.", 404);

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { batchScheduleId: schedule.id },
      select: { id: true, recordingEgressId: true },
    });

    if (wbSession?.recordingEgressId) {
      await stopCloudStageStreaming(wbSession.recordingEgressId).catch(() => undefined);
      await prisma.whiteboardSession.update({
        where: { id: wbSession.id },
        data: { recordingStatus: "RECORDING_STOPPING" },
      });
    }

    return apiSuccess({ cloudStreamStopped: true });
  } catch (error) {
    return handleApiError(error);
  }
}
