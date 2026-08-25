import "server-only";
import { prisma } from "@/lib/db";

/** The attempt's real deadline is whichever comes first: the test's own
 * duration counted from when the student started, or the schedule window's
 * close time — a student who starts 2 minutes before the slot closes
 * doesn't get the full duration, same as a real exam hall. */
export function computeDeadlineMs(attemptStartedAt: Date, durationMin: number, scheduleEndsAt: Date) {
  const byDuration = attemptStartedAt.getTime() + durationMin * 60_000;
  const byWindow = scheduleEndsAt.getTime();
  return Math.min(byDuration, byWindow);
}

/**
 * Server-authoritative scoring — walks every question on the test, matches
 * it against whatever answer (if any) the student saved, and computes
 * isCorrect/marksAwarded per question plus the attempt-level totals.
 * `isLate` decides SUBMITTED vs AUTO_SUBMITTED but never changes the score
 * itself. Used by both the explicit submit route and the lazy
 * expiry-detection path in the "my attempt" GET route, so an abandoned
 * attempt still gets scored the first time anyone asks about it.
 */
export async function finalizeAttempt(attemptId: string, isLate: boolean) {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { include: { questions: { include: { question: true } } } },
      answers: true,
    },
  });
  if (!attempt || attempt.status !== "IN_PROGRESS") return attempt;

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));
  let score = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  const answerUpdates = [];
  for (const tq of attempt.test.questions) {
    const ans = answerMap.get(tq.questionId);
    if (!ans || !ans.selectedOption) {
      unattemptedCount++;
      continue;
    }
    const isCorrect = ans.selectedOption === tq.question.correctOption;
    const marksAwarded = isCorrect ? tq.question.marksCorrect : tq.question.marksIncorrect;
    score += marksAwarded;
    if (isCorrect) correctCount++;
    else incorrectCount++;
    answerUpdates.push(
      prisma.testAttemptAnswer.update({
        where: { id: ans.id },
        data: { isCorrect, marksAwarded },
      })
    );
  }

  await prisma.$transaction([
    ...answerUpdates,
    prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: isLate ? "AUTO_SUBMITTED" : "SUBMITTED",
        submittedAt: new Date(),
        score,
        correctCount,
        incorrectCount,
        unattemptedCount,
      },
    }),
  ]);

  return prisma.testAttempt.findUnique({ where: { id: attemptId } });
}
