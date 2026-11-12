import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { quizLaunchSchema } from "@/lib/validation/whiteboard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { addCounts, youtubeVoteCounts } from "@/lib/whiteboard/youtube-votes";

/**
 * Launches a new quiz/quick-poll on the board. Only one quiz can be ACTIVE
 * per session at a time — launching a new one auto-closes whatever was
 * still open, matching a single "current question" mental model instead of
 * letting quizzes silently stack up.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({ where: { id: params.id } });
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    if (wbSession.status !== "ACTIVE") return apiError("This class isn't live right now.", 409);

    const input = quizLaunchSchema.parse(await request.json());

    await prisma.quizSession.updateMany({
      where: { whiteboardSessionId: params.id, status: { in: ["ACTIVE", "REVEALED"] } },
      data: { status: "CLOSED", dismissedAt: new Date() },
    });

    const quiz = await prisma.quizSession.create({
      data: {
        whiteboardSessionId: params.id,
        questionText: input.questionText ?? null,
        isQuickQuiz: input.isQuickQuiz,
        options: input.options,
        correctOption: input.correctOption ?? null,
        timeLimitSec: input.timeLimitSec,
        createdById: session.user.id,
      },
    });

    // Everyone in the session sees the question, options, and timer — never
    // the correct answer, which stays server-side until reveal.
    try {
      const channels = [sessionChannel(params.id)];
      if (wbSession.batchScheduleId && wbSession.batchScheduleId !== params.id) {
        channels.push(sessionChannel(wbSession.batchScheduleId));
      }
      await pusherServer.trigger(channels, WB_EVENTS.QUIZ_LAUNCHED, {
        id: quiz.id,
        questionText: quiz.questionText,
        options: quiz.options,
        timeLimitSec: quiz.timeLimitSec,
        startedAt: quiz.startedAt,
      });
    } catch (err) {
      console.error("[pusher_trigger_error]", err);
    }

    prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          action: "WHITEBOARD_QUIZ_LAUNCHED",
          entityType: "QuizSession",
          entityId: quiz.id,
          metadata: { whiteboardSessionId: params.id, isQuickQuiz: quiz.isQuickQuiz },
        },
      })
      .catch((err) => console.error("[audit_log_error]", err));

    return apiSuccess({ quiz }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * The current (or most recently launched) quiz for this session — used by
 * clients that join or refresh mid-quiz or during published results.
 * Preserves published results until dismissed.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const quiz = await prisma.quizSession.findFirst({
      where: { whiteboardSessionId: params.id },
      orderBy: { startedAt: "desc" },
    });

    // If no quiz exists or latest quiz has been closed/dismissed, return null
    if (!quiz || quiz.status === "CLOSED") {
      return apiSuccess({ quiz: null });
    }

    // Pre-calculate live metrics for active or revealed poll
    const [grouped, appResponses, youtube] = await Promise.all([
      prisma.quizResponse.groupBy({
        by: ["selectedOption"],
        where: { quizSessionId: quiz.id },
        _count: { _all: true },
      }),
      prisma.quizResponse.count({ where: { quizSessionId: quiz.id } }),
      youtubeVoteCounts(quiz.id),
    ]);
    const counts = addCounts(
      Object.fromEntries(grouped.map((r) => [r.selectedOption, r._count._all])),
      youtube.counts
    );
    const totalResponses = appResponses + youtube.total;

    if (access.role === "TEACHER") {
      return apiSuccess({
        quiz,
        quizMetrics: {
          counts,
          totalResponses,
          youtubeResponses: youtube.total,
        },
      });
    }

    // Student: Look up their answer (both while ACTIVE and while REVEALED)
    const myResponse = await prisma.quizResponse.findUnique({
      where: {
        quizSessionId_studentId: { quizSessionId: quiz.id, studentId: access.entityId },
      },
    });

    return apiSuccess({
      quiz: {
        id: quiz.id,
        questionText: quiz.questionText,
        isQuickQuiz: quiz.isQuickQuiz,
        options: quiz.options,
        timeLimitSec: quiz.timeLimitSec,
        status: quiz.status,
        startedAt: quiz.startedAt,
        revealedAt: quiz.revealedAt,
        correctOption: quiz.status === "REVEALED" ? quiz.correctOption : undefined,
        counts: quiz.status === "REVEALED" ? counts : undefined,
        totalVotes: quiz.status === "REVEALED" ? totalResponses : undefined,
      },
      hasResponded: Boolean(myResponse),
      mySelection: myResponse?.selectedOption ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
