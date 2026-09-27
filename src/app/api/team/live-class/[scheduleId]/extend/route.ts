import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";
import { getOpenLiveSession, extendLiveSession } from "@/lib/live-session/service";
import { effectiveClassEnd } from "@/lib/whiteboard/lifecycle";

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

    const { scheduleId } = await assertCanControlLiveClass(session.user.id, params.scheduleId);
    if (!scheduleId) return apiError("Scheduled class not found", 404);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: scheduleId },
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

    // The authoritative end lives on the open LiveSession: extending moves it
    // (and the simulcast group's, and any stream lease expiry) and mirrors
    // it onto WhiteboardSession.scheduledEnd. Auto-end, the cron and the
    // client countdown all follow it, so the class is no longer cut off at
    // its original end time.
    const openLiveSession = await getOpenLiveSession(schedule.id);
    let newScheduledEnd: Date;
    let newTotalExtended: number;
    if (openLiveSession) {
      const extended = await extendLiveSession(openLiveSession.id, addedMinutes);
      const own = extended.find((s) => s.id === openLiveSession.id)!;
      newScheduledEnd = own.effectiveEndsAt;
      newTotalExtended = own.totalExtendedMinutes;
    } else {
      // Session from before the LiveSession backfill: legacy fields only.
      newTotalExtended = (wbSession.totalExtendedMinutes || 0) + addedMinutes;
      const currentScheduledEnd = effectiveClassEnd(schedule.endsAt, wbSession.scheduledEnd);
      newScheduledEnd = new Date(currentScheduledEnd.getTime() + addedMinutes * 60 * 1000);
    }

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
