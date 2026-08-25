import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { quizLaunchSchema } from "@/lib/validation/whiteboard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

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
      where: { whiteboardSessionId: params.id, status: "ACTIVE" },
      data: { status: "CLOSED" },
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

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "WHITEBOARD_QUIZ_LAUNCHED",
        entityType: "QuizSession",
        entityId: quiz.id,
        metadata: { whiteboardSessionId: params.id, isQuickQuiz: quiz.isQuickQuiz },
      },
    });

    // Everyone in the session sees the question, options, and timer — never
    // the correct answer, which stays server-side until reveal.
    try {
      await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.QUIZ_LAUNCHED, {
        id: quiz.id,
        questionText: quiz.questionText,
        options: quiz.options,
        timeLimitSec: quiz.timeLimitSec,
        startedAt: quiz.startedAt,
      });
    } catch (err) {
      console.error("[pusher_trigger_error]", err);
    }

    return apiSuccess({ quiz }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * The current (or most recently launched) quiz for this session — used by
 * clients that join or refresh mid-quiz instead of relying solely on the
 * launch event, which they may have missed. Response shape is role-gated:
 * students never receive correctOption before reveal.
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
    if (!quiz) return apiSuccess({ quiz: null });

    if (access.role === "TEACHER") {
      return apiSuccess({ quiz });
    }

    const myResponse =
      quiz.status !== "ACTIVE"
        ? null
        : await prisma.quizResponse.findUnique({
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
        // correctOption only travels once the teacher has revealed it.
        correctOption: quiz.status === "REVEALED" ? quiz.correctOption : undefined,
      },
      hasResponded: quiz.status === "ACTIVE" ? Boolean(myResponse) : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
