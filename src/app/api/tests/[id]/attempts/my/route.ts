import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { computeDeadlineMs, finalizeAttempt } from "@/lib/test-engine/scoring";
import { toLegacyQuestion } from "@/lib/questions/legacy";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * The student's own in-progress (or just-finalized) attempt, with the
 * question list — but never `correctOption`/`explanation`, which only the
 * result endpoint (post-submission) reveals. If the deadline has quietly
 * passed (student closed the tab instead of clicking Submit), this lazily
 * finalizes the attempt right here before responding — the server, not the
 * client, owns "is time up". Works for both batch-scheduled and standalone
 * tests — computeDeadlineMs already treats a null schedule end as "just
 * use the duration" (see @/lib/test-engine/scoring.ts).
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: {
        batchSchedule: true,
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: { question: { include: { translations: true } } },
            },
          },
        },
      },
    });
    if (!test) return apiError("Test not found", 404);
    if (!test.batchScheduleId && !test.testSeriesId) {
      return apiError("This test isn't linked to a scheduled session or a series.", 400);
    }

    const { student } = await resolveStudentForTest(session.user.id, test);
    if (!student) throw new ForbiddenError();

    let attempt = await prisma.attempt.findUnique({
      where: { testId_studentId: { testId: test.id, studentId: student.id } },
      include: { answers: true },
    });
    if (!attempt) return apiError("You haven't started this test yet.", 404);

    const deadlineMs = computeDeadlineMs(attempt.startedAt, test.durationMin, test.batchSchedule?.endsAt);
    if (attempt.status === "IN_PROGRESS" && Date.now() > deadlineMs) {
      await finalizeAttempt(attempt.id, true);
      attempt = await prisma.attempt.findUnique({
        where: { id: attempt.id },
        include: { answers: true },
      });
    }
    if (!attempt) return apiError("Attempt not found", 404);

    const answerByQuestion = new Map(
      attempt.answers.map((a) => [
        a.questionId,
        Array.isArray(a.selectedOptionIds) ? (a.selectedOptionIds as string[])[0] ?? null : null,
      ])
    );

    const sectionQuestions = test.sections.flatMap((s) => s.questions);

    return apiSuccess({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        deadlineAt: new Date(deadlineMs).toISOString(),
      },
      test: { id: test.id, title: test.name, instructions: test.instructions, durationMin: test.durationMin },
      questions: sectionQuestions.map((sq) => {
        const legacy = toLegacyQuestion(sq.question);
        const enTrans = sq.question.translations?.find((t) => t.language === "ENGLISH");
        const hiTrans = sq.question.translations?.find((t) => t.language === "HINDI");
        const enOpts = (enTrans?.options as Record<string, string>) || {};
        const hiOpts = (hiTrans?.options as Record<string, string>) || {};

        return {
          id: sq.question.id,
          order: sq.order,
          subject: sq.question.subject || test.batchSchedule?.subject || "General",
          body: enTrans?.statement || legacy.body,
          type: legacy.type,
          optionA: enOpts.A || legacy.optionA,
          optionB: enOpts.B || legacy.optionB,
          optionC: enOpts.C || legacy.optionC,
          optionD: enOpts.D || legacy.optionD,
          bodyHi: hiTrans?.statement || null,
          optionAHi: hiOpts.A || null,
          optionBHi: hiOpts.B || null,
          optionCHi: hiOpts.C || null,
          optionDHi: hiOpts.D || null,
          mySelection: answerByQuestion.get(sq.question.id) ?? null,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
