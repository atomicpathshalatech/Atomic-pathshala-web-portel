import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Teacher dismisses / ends a quiz.
 * Valid in both ACTIVE state (closing early) and REVEALED state (dismissing published results).
 * Updates poll state to CLOSED and records dismissedAt timestamp.
 * Broadcasts QUIZ_DISMISSED and QUIZ_CLOSED to all connected student screens.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const updated = await prisma.quizSession.updateMany({
      where: {
        id: params.quizId,
        whiteboardSessionId: params.id,
        status: { in: ["ACTIVE", "REVEALED"] },
      },
      data: {
        status: "CLOSED",
        dismissedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return apiError("Quiz not found or already dismissed.", 404);
    }

    try {
      const wb = await prisma.whiteboardSession.findUnique({
        where: { id: params.id },
        select: { batchScheduleId: true },
      });
      const channels = [sessionChannel(params.id)];
      if (wb?.batchScheduleId && wb.batchScheduleId !== params.id) {
        channels.push(sessionChannel(wb.batchScheduleId));
      }
      await Promise.all([
        pusherServer.trigger(channels, WB_EVENTS.QUIZ_DISMISSED, {
          id: params.quizId,
        }),
        pusherServer.trigger(channels, WB_EVENTS.QUIZ_CLOSED, {
          id: params.quizId,
        }),
      ]);
    } catch (err) {
      console.error("[pusher_trigger_error]", err);
    }

    return apiSuccess({ closed: true, dismissed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
