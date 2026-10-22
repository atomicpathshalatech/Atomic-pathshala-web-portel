import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { testAnswerUpsertSchema } from "@/lib/validation/test";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { reattemptAnswers, reattemptDeadlineMs } from "@/lib/test-engine/reattempts";

const ANSWER_GRACE_MS = 30_000;

/** Saves one answer of re-attempt n (same body as /attempts/my/answers). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; n: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const test = await prisma.test.findUnique({ where: { id: params.id } });
    if (!test) return apiError("Test not found", 404);
    const { student } = await resolveStudentForTest(session.user.id, test);
    if (!student) throw new ForbiddenError();

    const re = await prisma.testReattempt.findUnique({
      where: { testId_studentId_attemptNumber: { testId: test.id, studentId: student.id, attemptNumber: Number(params.n) || 0 } },
    });
    if (!re) return apiError("Re-attempt not found.", 404);
    if (re.status !== "IN_PROGRESS") return apiError("This attempt is already finalized.", 409);
    if (Date.now() > reattemptDeadlineMs(re.startedAt, test.durationMin) + ANSWER_GRACE_MS) {
      return apiError("Time's up — this attempt is being finalized.", 409);
    }

    const input = testAnswerUpsertSchema.parse(await request.json());
    const inTest = await prisma.sectionQuestion.findFirst({
      where: { section: { testId: test.id }, questionId: input.questionId },
      select: { id: true },
    });
    if (!inTest) return apiError("That question isn't part of this test.", 400);

    // The answers are one JSON map: read and write it in one transaction so
    // two quick saves on different questions don't drop one another.
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.testReattempt.findUnique({ where: { id: re.id }, select: { answers: true } });
      const answers = reattemptAnswers(fresh?.answers);
      if (input.selectedOption === null) delete answers[input.questionId];
      else answers[input.questionId] = input.selectedOption;
      await tx.testReattempt.update({ where: { id: re.id }, data: { answers } });
    });
    return apiSuccess({ saved: true, cleared: input.selectedOption === null });
  } catch (error) {
    return handleApiError(error);
  }
}
