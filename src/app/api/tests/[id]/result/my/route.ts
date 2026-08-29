import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveStudentForSchedule } from "@/lib/batch/access";
import { toLegacyQuestion } from "@/lib/questions/legacy";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Full review — correctOption/explanation only ever appear here, and only
 * once the attempt is actually finalized. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: {
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

    const { student } = await resolveStudentForSchedule(session.user.id, test.batchScheduleId);
    if (!student) throw new ForbiddenError();

    const attempt = await prisma.attempt.findUnique({
      where: { testId_studentId: { testId: test.id, studentId: student.id } },
      include: { answers: true },
    });
    if (!attempt) return apiError("You haven't attempted this test.", 404);
    if (attempt.status === "IN_PROGRESS") {
      return apiError("Submit the test before viewing your result.", 409);
    }

    const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const sectionQuestions = test.sections.flatMap((s) => s.questions.map((sq) => ({ ...sq, section: s })));
    const totalMarks = sectionQuestions.reduce(
      (sum, sq) => sum + (sq.marksOverride ?? sq.section.marksPerQuestion ?? test.correctMarks),
      0
    );

    // Rank among every other finalized attempt on this test — same real,
    // computed-fresh approach as the student-facing result page.
    const finalizedAttempts = await prisma.attempt.findMany({
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

    let correctCount = 0;
    let incorrectCount = 0;
    for (const ans of attempt.answers) {
      if (ans.isCorrect === true) correctCount++;
      else if (ans.isCorrect === false) incorrectCount++;
    }
    const unattemptedCount = Math.max(0, sectionQuestions.length - attempt.answers.length);

    return apiSuccess({
      attempt: {
        status: attempt.status,
        score: attempt.score,
        correctCount,
        incorrectCount,
        unattemptedCount,
        submittedAt: attempt.submittedAt,
      },
      totalMarks,
      rank,
      totalParticipants,
      percentile,
      questions: sectionQuestions.map((sq) => {
        const ans = answerByQuestion.get(sq.question.id);
        const legacy = toLegacyQuestion(sq.question);
        const selected = Array.isArray(ans?.selectedOptionIds) ? (ans!.selectedOptionIds as string[])[0] : null;
        const correctMarks = sq.marksOverride ?? sq.section.marksPerQuestion ?? test.correctMarks;
        const incorrectMarks = sq.negativeMarksOverride ?? sq.section.negativeMarks ?? test.incorrectMarks;
        return {
          id: sq.question.id,
          order: sq.order,
          body: legacy.body,
          type: legacy.type,
          optionA: legacy.optionA,
          optionB: legacy.optionB,
          optionC: legacy.optionC,
          optionD: legacy.optionD,
          correctOption: legacy.correctOption,
          explanation: legacy.explanation,
          mySelection: selected ?? null,
          isCorrect: ans?.isCorrect ?? null,
          marksAwarded: ans ? (ans.isCorrect ? correctMarks : incorrectMarks) : 0,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
