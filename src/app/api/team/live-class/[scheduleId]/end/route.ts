import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

export async function POST(
  _request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true },
    });

    if (!schedule) return apiError("Scheduled class not found", 404);

    const wbSession = schedule.liveWhiteboardSession;
    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const now = new Date();

    const updatedSession = await prisma.whiteboardSession.update({
      where: { id: wbSession.id },
      data: {
        livePhase: "ENDED",
        status: "ENDED",
        endedAt: now,
        actualEndedAt: now,
      },
    });

    await prisma.batchSchedule.update({
      where: { id: params.scheduleId },
      data: { status: "COMPLETED" },
    });

    // Notify all participants that class has ended
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.SESSION_ENDED, {
        endedAt: now.toISOString(),
      });
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.LIVE_PHASE_CHANGED, {
        phase: "ENDED",
        endedAt: now.toISOString(),
      });
    } catch (pushErr) {
      console.warn("Realtime end broadcast warning:", pushErr);
    }

    return apiSuccess({
      message: "Class ended successfully.",
      whiteboardSession: updatedSession,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
