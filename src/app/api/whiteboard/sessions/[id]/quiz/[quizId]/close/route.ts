import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Teacher ends a quiz WITHOUT revealing the correct answer (e.g. a mis-typed
 * question). Students' in-progress answer UI is dismissed via the same
 * QUIZ_CLOSED event a normal auto-close (launching the next quiz) uses.
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
      where: { id: params.quizId, whiteboardSessionId: params.id, status: "ACTIVE" },
      data: { status: "CLOSED" },
    });
    if (updated.count === 0) {
      return apiError("Quiz not found or already closed.", 404);
    }

    try {
      await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.QUIZ_CLOSED, {
        id: params.quizId,
      });
    } catch (err) {
      console.error("[pusher_trigger_error]", err);
    }

    return apiSuccess({ closed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
