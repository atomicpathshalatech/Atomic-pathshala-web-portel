import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { configureYouTubeSession, updateBroadcastPhase, extractYouTubeVideoId } from "@/lib/live-class/youtube";
import { LiveClassPhase, VideoTransport } from "@prisma/client";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";
import { ensureOpenLiveSession, setLiveSessionDelivery, syncLiveSessionOnStart } from "@/lib/live-session/service";
import { effectiveClassEnd } from "@/lib/whiteboard/lifecycle";

export async function GET(_request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const { scheduleId } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!scheduleId) return apiError("Scheduled class not found", 404);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: scheduleId },
      include: { liveWhiteboardSession: true, batch: true },
    });

    if (!schedule) return apiError("Scheduled class not found", 404);

    return apiSuccess({
      schedule,
      whiteboardSession: schedule.liveWhiteboardSession,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const { scheduleId, schedule, teacher } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!scheduleId || !schedule || !teacher) return apiError("Scheduled class not found", 404);

    const body = await request.json();
    const { youtubeVideoId, videoTransport, livePhase } = body;
    const effectivePhase = (livePhase as LiveClassPhase) || LiveClassPhase.LIVE;

    // Ending a class must go through endWhiteboardSession (stops recording,
    // completes the YouTube broadcast, resolves hand raises, closes quizzes,
    // finalizes notes). Setting ENDED here skipped all of that.
    if (effectivePhase === LiveClassPhase.ENDED || effectivePhase === LiveClassPhase.ENDING) {
      return apiError("Use End Class to end a live class.", 400, { code: "USE_END_ROUTE" });
    }
    const videoId = youtubeVideoId ? extractYouTubeVideoId(youtubeVideoId) : null;

    const wbSession = await configureYouTubeSession({
      batchScheduleId: scheduleId,
      videoTransport: (videoTransport as VideoTransport) || VideoTransport.YOUTUBE,
      youtubeVideoId: videoId || undefined,
    });

    const now = new Date();
    const updatedWbSession = await prisma.whiteboardSession.update({
      where: { id: wbSession.id },
      data: {
        livePhase: effectivePhase,
        status: "ACTIVE", // ENDED/ENDING are rejected above; ending goes through End Class
        actualStartedAt: effectivePhase === LiveClassPhase.LIVE ? wbSession.actualStartedAt || now : wbSession.actualStartedAt,
        startedAt: effectivePhase === LiveClassPhase.LIVE ? wbSession.startedAt || now : wbSession.startedAt,
      },
    });

    // Lifecycle row. A manually saved id is only this class's own APP
    // broadcast if it IS the auto-created broadcast; otherwise it's an
    // EXTERNAL_YOUTUBE video.
    const delivery = {
      videoTransport: updatedWbSession.videoTransport,
      youtubeBroadcastId:
        updatedWbSession.youtubeBroadcastId && updatedWbSession.youtubeBroadcastId === updatedWbSession.youtubeVideoId
          ? updatedWbSession.youtubeBroadcastId
          : null,
      youtubeVideoId: updatedWbSession.youtubeVideoId,
      scheduledEnd: updatedWbSession.scheduledEnd,
    };
    if (effectivePhase === LiveClassPhase.LIVE) {
      // Marks this schedule (and only its simulcast group) LIVE.
      await syncLiveSessionOnStart({
        schedule,
        wbSession: { id: updatedWbSession.id, ...delivery },
        teacherId: teacher.id,
        startedAt: updatedWbSession.actualStartedAt ?? now,
      });
    } else {
      const open = await ensureOpenLiveSession({
        batchScheduleId: scheduleId,
        whiteboardSessionId: updatedWbSession.id,
        controllingTeacherId: teacher.id,
        plannedStartsAt: schedule.startsAt,
        plannedEndsAt: effectiveClassEnd(schedule.endsAt, updatedWbSession.scheduledEnd),
        ...delivery,
      });
      await setLiveSessionDelivery(open.id, delivery);
    }

    // Invalidate schedule cache
    const { cache } = await import("@/lib/cache/redis");
    await cache.del(`wb:schedule:${scheduleId}`);

    // Realtime broadcast
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.LIVE_PHASE_CHANGED, {
        phase: effectivePhase,
        livePhase: effectivePhase,
        videoTransport: updatedWbSession.videoTransport,
        youtubeVideoId: updatedWbSession.youtubeVideoId,
        actualStartedAt: now.toISOString(),
        serverTime: now.toISOString(),
      });
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.CONFIG_UPDATED, {
        videoTransport: updatedWbSession.videoTransport,
        youtubeVideoId: updatedWbSession.youtubeVideoId,
      });
    } catch (pushErr) {
      console.warn("[broadcast] Pusher warning:", pushErr);
    }

    return apiSuccess({
      message: "YouTube live broadcast configured successfully.",
      session: updatedWbSession,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
