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

export async function GET(_request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    let schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true, batch: true },
    });

    if (!schedule) {
      const wb = await prisma.whiteboardSession.findUnique({
        where: { id: params.scheduleId },
        include: { batchSchedule: { include: { batch: true } } },
      });
      if (wb?.batchSchedule) {
        schedule = { ...wb.batchSchedule, liveWhiteboardSession: wb as any } as any;
      }
    }

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

    let schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
    });
    let scheduleId = params.scheduleId;

    if (!schedule) {
      const wb = await prisma.whiteboardSession.findUnique({
        where: { id: params.scheduleId },
      });
      if (wb?.batchScheduleId) {
        scheduleId = wb.batchScheduleId;
        schedule = await prisma.batchSchedule.findUnique({
          where: { id: scheduleId },
        });
      }
    }

    if (!schedule) return apiError("Scheduled class not found", 404);

    const body = await request.json();
    const { youtubeVideoId, videoTransport, livePhase } = body;
    const effectivePhase = (livePhase as LiveClassPhase) || LiveClassPhase.LIVE;
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
        status: effectivePhase === LiveClassPhase.ENDED ? "ENDED" : "ACTIVE",
        actualStartedAt: effectivePhase === LiveClassPhase.LIVE ? wbSession.actualStartedAt || now : wbSession.actualStartedAt,
        startedAt: effectivePhase === LiveClassPhase.LIVE ? wbSession.startedAt || now : wbSession.startedAt,
      },
    });

    if (effectivePhase === LiveClassPhase.LIVE) {
      await prisma.batchSchedule.update({
        where: { id: scheduleId },
        data: { status: "LIVE" },
      }).catch(() => null);
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
