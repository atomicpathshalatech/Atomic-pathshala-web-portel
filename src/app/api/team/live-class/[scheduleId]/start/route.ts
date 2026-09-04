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

    const now = new Date();

    const { canTeacherStart } = await import("@/lib/schedule/access-rules");
    const evaluation = canTeacherStart(schedule, now);
    if (!evaluation.allowed) {
      return apiError(
        evaluation.reason || "Live class cannot be started yet. Starting is allowed within 15 minutes of scheduled time.",
        403,
        {
          code: "START_WINDOW_NOT_OPEN",
          details: {
            opensAt: evaluation.opensAt.toISOString(),
            secondsUntilWindowOpens: evaluation.secondsUntilWindowOpens,
          },
        }
      );
    }

    const teacher = await prisma.teacher.findFirst({
      where: { userId: session.user.id },
    });

    if (!teacher) return apiError("Teacher profile not found", 403);

    const wbSession = await prisma.whiteboardSession.upsert({
      where: { batchScheduleId: params.scheduleId },
      update: {
        livePhase: "LIVE",
        status: "ACTIVE",
        actualStartedAt: now,
        startedAt: now,
      },
      create: {
        batchScheduleId: schedule.id,
        teacherId: teacher.id,
        title: schedule.title,
        status: "ACTIVE",
        livePhase: "LIVE",
        actualStartedAt: now,
        startedAt: now,
        scheduledStart: schedule.startsAt ? new Date(schedule.startsAt) : now,
        scheduledEnd: schedule.endsAt ? new Date(schedule.endsAt) : new Date(now.getTime() + 60 * 60 * 1000),
        pages: {
          create: {
            pageNumber: 1,
            objects: [],
          },
        },
      },
    });

    // Notify all participants that class is now LIVE
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.LIVE_PHASE_CHANGED, {
        phase: "LIVE",
        actualStartedAt: now.toISOString(),
      });
    } catch (pushErr) {
      console.warn("Realtime broadcast warning:", pushErr);
    }

    return apiSuccess({
      message: "Class started successfully.",
      whiteboardSession: wbSession,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
