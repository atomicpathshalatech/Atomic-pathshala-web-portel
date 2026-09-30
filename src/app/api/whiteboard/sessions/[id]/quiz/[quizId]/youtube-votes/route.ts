import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { syncYoutubeVotes } from "@/lib/whiteboard/youtube-votes";
import { pushQuizMetrics } from "@/lib/whiteboard/quiz";

/**
 * POST — reads the YouTube live chat for answers to this poll and returns the
 * updated tally (app + YouTube). Called by the teacher's room every few
 * seconds while the poll is open; the teacher's live bars update through
 * the usual QUIZ_METRICS push as well.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string; quizId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const quiz = await prisma.quizSession.findFirst({
      where: { id: params.quizId, whiteboardSessionId: params.id },
      select: { id: true, status: true },
    });
    if (!quiz) return apiError("Quiz not found", 404);

    const sync = quiz.status === "ACTIVE" ? await syncYoutubeVotes(quiz.id) : { ok: true, added: 0 };
    const metrics = await pushQuizMetrics(quiz.id);
    return apiSuccess({ chatReadable: sync.ok, added: sync.added, metrics });
  } catch (error) {
    return handleApiError(error);
  }
}
