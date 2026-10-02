import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { computeDeadlineMs, finalizeAttempt } from "@/lib/test-engine/scoring";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { areResultsReleased, resultsReleaseAt } from "@/lib/tests/schedule-rules";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
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

    const finalized = await finalizeAttempt(attempt.id, isLate);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_ATTEMPT_SUBMITTED",
        entityType: "Test",
        entityId: test.id,
        metadata: { attemptId: attempt.id, auto: isLate, score: finalized?.score },
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
