import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { quizResponseSchema } from "@/lib/validation/whiteboard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pushQuizMetrics } from "@/lib/whiteboard/quiz";

/**
 * Student submits an answer. The deadline and elapsed time are both computed
 * server-side from quiz.startedAt/timeLimitSec — the client's own clock, or
 * any client-supplied "time taken" value, is never trusted, since either
 * could be spoofed to fake a fast or late-but-hidden answer.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; quizId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "STUDENT") throw new ForbiddenError();

    const quiz = await prisma.quizSession.findFirst({
      where: { id: params.quizId, whiteboardSessionId: params.id },
    });
    if (!quiz) return apiError("Quiz not found", 404);
    if (quiz.status !== "ACTIVE") {
      return apiError("This quiz is no longer accepting answers.", 409);
    }

    const deadline = quiz.startedAt.getTime() + quiz.timeLimitSec * 1000;
    if (Date.now() > deadline) {
      return apiError("Time's up — this quiz is no longer accepting answers.", 409);
    }

    const input = quizResponseSchema.parse(await request.json());

    const options = quiz.options as Array<{ key: string; label: string }>;
    if (!options.some((o) => o.key === input.selectedOption)) {
      return apiError("Invalid option selected.", 400);
    }

    const existing = await prisma.quizResponse.findUnique({
      where: {
        quizSessionId_studentId: { quizSessionId: quiz.id, studentId: access.entityId },
      },
    });
    if (existing) return apiError("You have already answered this quiz.", 409);

    const responseTimeMs = Date.now() - quiz.startedAt.getTime();
    const isCorrect = quiz.correctOption ? input.selectedOption === quiz.correctOption : null;

    const response = await prisma.quizResponse.create({
      data: {
        quizSessionId: quiz.id,
        studentId: access.entityId,
        selectedOption: input.selectedOption,
        responseTimeMs,
        isCorrect,
      },
    });

    await pushQuizMetrics(quiz.id);

    // isCorrect is deliberately withheld here too — students find out at
    // reveal, not the instant they answer, so the fastest responders can't
    // tip off everyone else still deciding.
    return apiSuccess({ submitted: true, responseId: response.id }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
