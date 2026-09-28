import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";

/**
 * YouTube health gate for an APP_YOUTUBE class, polled every few seconds by
 * the class's own teacher (never by students — 500 students must not turn
 * into 500 YouTube API calls). Each call costs 1–2 quota units while the
 * class is connecting and nothing once it is live.
 *
 * When YouTube reports the broadcast live, the class becomes LIVE here and
 * students are told (realtime push + "Live Now" notification).
 */
export async function GET(_request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { scheduleId, schedule } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!scheduleId || !schedule) return apiError("Scheduled class not found", 404);

    const { getOpenLiveSession, getLatestLiveSession } = await import("@/lib/live-session/service");
    const liveSession = (await getOpenLiveSession(scheduleId)) ?? (await getLatestLiveSession(scheduleId));
    if (!liveSession) return apiSuccess({ state: null });

    if (liveSession.deliveryMode !== "APP_YOUTUBE") {
      return apiSuccess({ state: liveSession.state, deliveryMode: liveSession.deliveryMode });
    }

    const { pollAppYoutubeStatus } = await import("@/lib/live-session/app-youtube");
    const status = await pollAppYoutubeStatus(liveSession.id);

    if (status.becameLive) {
      const { announceClassLive } = await import("@/lib/live-session/announce");
      const wb = liveSession.whiteboardSessionId
        ? await prisma.whiteboardSession.findUnique({ where: { id: liveSession.whiteboardSessionId }, select: { id: true, videoTransport: true, actualStartedAt: true } })
        : null;
      if (wb) {
        await announceClassLive({
          schedule,
          whiteboardSessionId: wb.id,
          aliasChannelId: scheduleId,
          videoTransport: wb.videoTransport,
          youtubeVideoId: liveSession.youtubeVideoId,
          startedAt: wb.actualStartedAt ?? new Date(),
        });
      }
      const { cache } = await import("@/lib/cache/redis");
      await cache.del(`wb:schedule:${scheduleId}`);
      await cache.del(`live:state:${scheduleId}`);
    }

    return apiSuccess({
      state: status.state,
      deliveryMode: liveSession.deliveryMode,
      streamStatus: status.streamStatus,
      healthStatus: status.healthStatus,
      broadcastLifecycle: status.broadcastLifecycle,
      becameLive: status.becameLive,
      embedBlocked: status.embedBlocked,
    });
  } catch (error) {
    const { classifyYoutubeError, describeYoutubeError } = await import("@/lib/youtube/errors");
    const kind = classifyYoutubeError(error);
    if (kind !== "UNKNOWN" && kind !== "CONFIG") return apiError(describeYoutubeError(error), 502, { code: `YOUTUBE_${kind}` });
    return handleApiError(error);
  }
}
