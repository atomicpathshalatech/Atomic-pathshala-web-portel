import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * A student's own result for one quiz. isCorrect/correctOption stay withheld
 * until the teacher has revealed — before that this only confirms whether
 * they've submitted, so a curious student can't peek at the answer key
 * early and tip off classmates still deciding.
 */
export async function GET(
  _request: NextRequest,
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

    const response = await prisma.quizResponse.findUnique({
      where: {
        quizSessionId_studentId: { quizSessionId: quiz.id, studentId: access.entityId },
      },
    });

    if (!response) return apiSuccess({ submitted: false });

    if (quiz.status !== "REVEALED") {
      return apiSuccess({ submitted: true, selectedOption: response.selectedOption });
    }

    return apiSuccess({
      submitted: true,
      selectedOption: response.selectedOption,
      isCorrect: response.isCorrect,
      correctOption: quiz.correctOption,
      responseTimeMs: response.responseTimeMs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
