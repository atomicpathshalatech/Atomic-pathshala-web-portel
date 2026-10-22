import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  examQuestions,
  finalizeReattempt,
  loadTestForExam,
  reattemptAnswers,
  reattemptDeadlineMs,
} from "@/lib/test-engine/reattempts";

/** The exam room's data for re-attempt n (same shape as /attempts/my). Past its time it is closed here. */
export async function GET(_request: NextRequest, { params }: { params: { id: string; n: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const test = await loadTestForExam(params.id);
    if (!test) return apiError("Test not found", 404);
    const { student } = await resolveStudentForTest(session.user.id, test);
    if (!student) throw new ForbiddenError();

    let re = await prisma.testReattempt.findUnique({
      where: { testId_studentId_attemptNumber: { testId: test.id, studentId: student.id, attemptNumber: Number(params.n) || 0 } },
    });
    if (!re) return apiError("Re-attempt not found.", 404);
    const deadlineMs = reattemptDeadlineMs(re.startedAt, test.durationMin);
    if (re.status === "IN_PROGRESS" && Date.now() > deadlineMs) {
      re = (await finalizeReattempt(re.id, true)) ?? re;
    }

    return apiSuccess({
      attempt: { id: re.id, status: re.status, startedAt: re.startedAt, deadlineAt: new Date(deadlineMs).toISOString() },
      test: { id: test.id, title: test.name, instructions: test.instructions, durationMin: test.durationMin },
      questions: examQuestions(test, reattemptAnswers(re.answers)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
