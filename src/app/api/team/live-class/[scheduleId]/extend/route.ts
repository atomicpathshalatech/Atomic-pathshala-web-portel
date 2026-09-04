import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

export async function POST(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const body = await request.json();
    const addedMinutes = Number(body.addedMinutes);

    if (!addedMinutes || isNaN(addedMinutes) || addedMinutes <= 0 || addedMinutes > 120) {
      return apiError("Invalid extension duration (must be between 1 and 120 minutes).", 400);
    }

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true },
    });

    if (!schedule) return apiError("Scheduled class not found", 404);

    const wbSession = schedule.liveWhiteboardSession;
    if (!wbSession) return apiError("Active whiteboard session not found", 404);

    const currentHistory = Array.isArray(wbSession.extensionHistory)
      ? (wbSession.extensionHistory as any[])
      : [];

    const newExtensionEntry = {
      addedMinutes,
      extendedAt: new Date().toISOString(),
      teacherUserId: session.user.id,
    };

    const newTotalExtended = (wbSession.totalExtendedMinutes || 0) + addedMinutes;
    const currentScheduledEnd = wbSession.scheduledEnd
      ? new Date(wbSession.scheduledEnd)
      : schedule.endsAt
      ? new Date(schedule.endsAt)
      : new Date(Date.now() + 60 * 60 * 1000);

    const newScheduledEnd = new Date(currentScheduledEnd.getTime() + addedMinutes * 60 * 1000);

    const updatedSession = await prisma.whiteboardSession.update({
      where: { id: wbSession.id },
      data: {
        totalExtendedMinutes: newTotalExtended,
        scheduledEnd: newScheduledEnd,
        extensionHistory: [...currentHistory, newExtensionEntry],
      },
    });

    // Broadcast extension event to all students and teachers in session
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.SESSION_EXTENDED, {
        addedMinutes,
        newScheduledEnd: newScheduledEnd.toISOString(),
        totalExtendedMinutes: newTotalExtended,
      });
    } catch (pushErr) {
      console.warn("Realtime extension broadcast warning:", pushErr);
    }

    return apiSuccess({
      message: `Class extended by ${addedMinutes} minutes.`,
      whiteboardSession: updatedSession,
      addedMinutes,
      newScheduledEnd: newScheduledEnd.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
