import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForSchedule } from "@/lib/batch/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Full review — correctOption/explanation only ever appear here, and only
 * once the attempt is actually finalized. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: { questions: { orderBy: { order: "asc" }, include: { question: true } } },
    });
    if (!test) return apiError("Test not found", 404);

    const { student } = await resolveStudentForSchedule(session.user.id, test.batchScheduleId);
    if (!student) throw new ForbiddenError();

    const attempt = await prisma.testAttempt.findUnique({
      where: { testId_studentId: { testId: test.id, studentId: student.id } },
      include: { answers: true },
    });
    if (!attempt) return apiError("You haven't attempted this test.", 404);
    if (attempt.status === "IN_PROGRESS") {
      return apiError("Submit the test before viewing your result.", 409);
    }

    const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const totalMarks = test.questions.reduce((sum, tq) => sum + tq.question.marksCorrect, 0);

    // Rank among every other finalized attempt on this test — same real,
    // computed-fresh approach as the student-facing result page.
    const finalizedAttempts = await prisma.testAttempt.findMany({
      where: { testId: test.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
      select: { score: true },
    });
    const myScore = attempt.score ?? 0;
    const totalParticipants = finalizedAttempts.length;
    const rank = finalizedAttempts.filter((a) => (a.score ?? 0) > myScore).length + 1;
    const percentile =
      totalParticipants <= 1
        ? 100
        : Math.round(((totalParticipants - rank) / (totalParticipants - 1)) * 100);

    return apiSuccess({
      attempt: {
        status: attempt.status,
        score: attempt.score,
        correctCount: attempt.correctCount,
        incorrectCount: attempt.incorrectCount,
        unattemptedCount: attempt.unattemptedCount,
        submittedAt: attempt.submittedAt,
      },
      totalMarks,
      rank,
      totalParticipants,
      percentile,
      questions: test.questions.map((tq) => {
        const ans = answerByQuestion.get(tq.question.id);
        return {
          id: tq.question.id,
          order: tq.order,
          body: tq.question.body,
          type: tq.question.type,
          optionA: tq.question.optionA,
          optionB: tq.question.optionB,
          optionC: tq.question.optionC,
          optionD: tq.question.optionD,
          correctOption: tq.question.correctOption,
          explanation: tq.question.explanation,
          mySelection: ans?.selectedOption ?? null,
          isCorrect: ans?.isCorrect ?? null,
          marksAwarded: ans?.marksAwarded ?? 0,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
