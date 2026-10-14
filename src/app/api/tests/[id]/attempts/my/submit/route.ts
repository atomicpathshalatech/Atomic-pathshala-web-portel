import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { computeDeadlineMs, finalizeAttempt } from "@/lib/test-engine/scoring";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";

// The answers on the student's screen at submit time (question id → option, or null for none).
const submitSchema = z.object({ answers: z.record(z.string().min(1), z.string().min(1).max(20).nullable()).optional() });
// Answers sent with a submit are accepted up to this long after the deadline (slow networks at auto-submit).
const SUBMIT_GRACE_MS = 2 * 60_000;
import { areResultsReleased, resultsReleaseAt } from "@/lib/tests/schedule-rules";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: { batchSchedule: true },
    });
    if (!test) return apiError("Test not found", 404);
    if (!test.batchScheduleId && !test.testSeriesId && !test.chapterId && test.testType !== "DPP") {
      return apiError("This test isn't linked to a scheduled session, series, or chapter.", 400);
    }

    const { student } = await resolveStudentForTest(session.user.id, test);
    if (!student) throw new ForbiddenError();

    const attempt = await prisma.attempt.findUnique({
      where: { testId_studentId: { testId: test.id, studentId: student.id } },
    });
    if (!attempt) return apiError("You haven't started this test yet.", 404);

    if (attempt.status !== "IN_PROGRESS") {
      // already finalized — idempotent
      if (!areResultsReleased(test)) {
        const { score: _score, ...withoutScore } = attempt;
        return apiSuccess({ attempt: withoutScore, resultsReleaseAt: resultsReleaseAt(test) });
      }
      return apiSuccess({ attempt });
    }

    const deadlineMs = computeDeadlineMs(attempt.startedAt, test.durationMin, test.batchSchedule?.endsAt);
    const isLate = Date.now() > deadlineMs;

    // Bring the stored answers in line with what the student saw, so an answer
    // whose save never got through is not counted as skipped.
    const body = submitSchema.safeParse(await request.json().catch(() => ({})));
    const sent = body.success ? body.data.answers : undefined;
    let reconciled = 0;
    if (sent && Date.now() <= deadlineMs + SUBMIT_GRACE_MS) {
      const inTest = await prisma.sectionQuestion.findMany({ where: { section: { testId: test.id } }, select: { questionId: true } });
      const valid = new Set(inTest.map((q) => q.questionId));
      const stored = await prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id }, select: { questionId: true, selectedOptionIds: true } });
      const storedBy = new Map(stored.map((s) => [s.questionId, Array.isArray(s.selectedOptionIds) ? ((s.selectedOptionIds as string[])[0] ?? null) : null]));
      const changes = Object.entries(sent).filter(([qid, value]) => valid.has(qid) && (storedBy.get(qid) ?? null) !== value);
      if (changes.length) {
        await prisma.$transaction(
          changes.map(([questionId, value]) =>
            value === null
              ? prisma.attemptAnswer.deleteMany({ where: { attemptId: attempt.id, questionId } })
              : prisma.attemptAnswer.upsert({
                  where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
                  create: { attemptId: attempt.id, questionId, selectedOptionIds: [value] },
                  update: { selectedOptionIds: [value] },
                })
          )
        );
        reconciled = changes.length;
      }
    }

    const finalized = await finalizeAttempt(attempt.id, isLate);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_ATTEMPT_SUBMITTED",
        entityType: "Test",
        entityId: test.id,
        metadata: { attemptId: attempt.id, auto: isLate, score: finalized?.score, answersRecoveredAtSubmit: reconciled },
      },
    });

    // Until results are released, don't hand the score back with the submit.
    if (!areResultsReleased(test) && finalized) {
      const { score: _score, ...withoutScore } = finalized as typeof finalized & { score?: unknown };
      return apiSuccess({ attempt: withoutScore, resultsReleaseAt: resultsReleaseAt(test) });
    }
    return apiSuccess({ attempt: finalized });
  } catch (error) {
    return handleApiError(error);
  }
}
