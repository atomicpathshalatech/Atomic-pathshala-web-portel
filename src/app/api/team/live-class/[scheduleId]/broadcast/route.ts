import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { configureYouTubeSession, updateBroadcastPhase, extractYouTubeVideoId } from "@/lib/live-class/youtube";
import { LiveClassPhase, VideoTransport } from "@prisma/client";

export async function GET(_request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
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

    const body = await request.json();
    const { youtubeVideoId, videoTransport, livePhase } = body;

    const wbSession = await configureYouTubeSession({
      batchScheduleId: params.scheduleId,
      videoTransport: videoTransport as VideoTransport | undefined,
      youtubeVideoId,
    });

    if (livePhase && Object.values(LiveClassPhase).includes(livePhase)) {
      await updateBroadcastPhase(wbSession.id, livePhase as LiveClassPhase);
    }

    return apiSuccess({
      message: "YouTube live broadcast configured successfully.",
      session: wbSession,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
