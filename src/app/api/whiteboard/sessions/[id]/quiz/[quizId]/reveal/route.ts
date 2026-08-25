import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

/** Teacher reveals the correct answer + final tally to everyone in the session. */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const quiz = await prisma.quizSession.findFirst({
      where: { id: params.quizId, whiteboardSessionId: params.id },
    });
    if (!quiz) return apiError("Quiz not found", 404);
    if (quiz.status === "REVEALED") return apiSuccess({ quiz });

    const updated = await prisma.quizSession.update({
      where: { id: quiz.id },
      data: { status: "REVEALED", revealedAt: new Date() },
    });

    const grouped = await prisma.quizResponse.groupBy({
      by: ["selectedOption"],
      where: { quizSessionId: quiz.id },
      _count: { _all: true },
    });
    const totalResponses = await prisma.quizResponse.count({ where: { quizSessionId: quiz.id } });
    const correctCount = quiz.correctOption
      ? await prisma.quizResponse.count({
          where: { quizSessionId: quiz.id, selectedOption: quiz.correctOption },
        })
      : null;
    const counts = Object.fromEntries(grouped.map((r) => [r.selectedOption, r._count._all]));

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "WHITEBOARD_QUIZ_REVEALED",
        entityType: "QuizSession",
        entityId: quiz.id,
        metadata: { whiteboardSessionId: params.id, totalResponses },
      },
    });

    try {
      await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.QUIZ_REVEALED, {
        id: quiz.id,
        correctOption: quiz.correctOption,
        counts,
        totalResponses,
        correctCount,
      });
    } catch (err) {
      console.error("[pusher_trigger_error]", err);
    }

    return apiSuccess({ quiz: updated, counts, totalResponses, correctCount });
  } catch (error) {
    return handleApiError(error);
  }
}
