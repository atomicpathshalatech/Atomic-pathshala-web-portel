import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForSchedule } from "@/lib/batch/access";
import { computeDeadlineMs } from "@/lib/test-engine/scoring";
import { testAnswerUpsertSchema } from "@/lib/validation/test";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Autosave endpoint — the attempt-runner UI calls this on a short debounce
 * as the student picks/changes an answer, same pattern as the whiteboard
 * page autosave. Not audit-logged (too frequent, not an accountable event
 * on its own — the attempt's final submit is what's logged).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: { batchSchedule: true },
    });
    if (!test) return apiError("Test not found", 404);

    const { student } = await resolveStudentForSchedule(session.user.id, test.batchScheduleId);
    if (!student) throw new ForbiddenError();

    const attempt = await prisma.testAttempt.findUnique({
      where: { testId_studentId: { testId: test.id, studentId: student.id } },
    });
    if (!attempt) return apiError("You haven't started this test yet.", 404);
    if (attempt.status !== "IN_PROGRESS") return apiError("This attempt is already finalized.", 409);

    const deadlineMs = computeDeadlineMs(attempt.startedAt, test.durationMin, test.batchSchedule.endsAt);
    if (Date.now() > deadlineMs) return apiError("Time's up — this attempt is being finalized.", 409);

    const input = testAnswerUpsertSchema.parse(await request.json());

    const belongsToTest = await prisma.testQuestion.findFirst({
      where: { testId: test.id, questionId: input.questionId },
    });
    if (!belongsToTest) return apiError("That question isn't part of this test.", 400);

    if (input.selectedOption === null) {
      await prisma.testAttemptAnswer.deleteMany({
        where: { attemptId: attempt.id, questionId: input.questionId },
      });
      return apiSuccess({ saved: true, cleared: true });
    }

    await prisma.testAttemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: input.questionId } },
      create: { attemptId: attempt.id, questionId: input.questionId, selectedOption: input.selectedOption },
      update: { selectedOption: input.selectedOption, answeredAt: new Date() },
    });

    return apiSuccess({ saved: true, cleared: false });
  } catch (error) {
    return handleApiError(error);
  }
}
