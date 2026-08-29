import "server-only";
import { prisma } from "@/lib/db";

/** The attempt's real deadline is whichever comes first: the test's own
 * duration counted from when the student started, or the schedule window's
 * close time — a student who starts 2 minutes before the slot closes
 * doesn't get the full duration, same as a real exam hall. Standalone
 * TestSeries tests have no schedule window, so scheduleEndsAt is nullable —
 * in that case the deadline is just the duration. */
export function computeDeadlineMs(
  attemptStartedAt: Date,
  durationMin: number,
  scheduleEndsAt: Date | null | undefined
) {
  const byDuration = attemptStartedAt.getTime() + durationMin * 60_000;
  if (!scheduleEndsAt) return byDuration;
  return Math.min(byDuration, scheduleEndsAt.getTime());
}

export type AttemptCounts = {
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
};

/**
 * correctCount/incorrectCount/unattemptedCount are no longer persisted
 * columns on Attempt (the Test Portal schema doesn't carry them) — compute
 * them on the fly from AttemptAnswer.isCorrect plus the test's total
 * question count, wherever the old code displayed them.
 */
export function computeAttemptCounts(
  answers: { isCorrect: boolean | null }[],
  totalQuestions: number
): AttemptCounts {
  let correctCount = 0;
  let incorrectCount = 0;
  for (const a of answers) {
    if (a.isCorrect === true) correctCount++;
    else if (a.isCorrect === false) incorrectCount++;
  }
  const unattemptedCount = Math.max(0, totalQuestions - answers.length);
  return { correctCount, incorrectCount, unattemptedCount };
}

/**
 * Server-authoritative scoring — walks every question on the test (via its
 * section(s)), matches it against whatever answer (if any) the student
 * saved, and computes isCorrect per answer plus the attempt's total score.
 * `isLate` decides SUBMITTED vs AUTO_SUBMITTED but never changes the score
 * itself. Used by both the explicit submit route and the lazy
 * expiry-detection path in the "my attempt" GET route, so an abandoned
 * attempt still gets scored the first time anyone asks about it.
 *
 * correctCount/incorrectCount/unattemptedCount are intentionally NOT
 * persisted here (no such columns on Attempt anymore) — callers that need
 * them should use computeAttemptCounts() against the returned answers.
 */
export async function finalizeAttempt(attemptId: string, isLate: boolean) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          sections: {
            include: {
              questions: {
                include: { question: { include: { translations: true } } },
              },
            },
          },
        },
      },
      answers: true,
    },
  });
  if (!attempt || attempt.status !== "IN_PROGRESS") return attempt;
  if (!attempt.test) return attempt;

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));
  let score = 0;
  const answerUpdates = [];

  for (const section of attempt.test.sections) {
    for (const sq of section.questions) {
      const ans = answerMap.get(sq.questionId);
      if (!ans) continue;

      const selected = Array.isArray(ans.selectedOptionIds) ? (ans.selectedOptionIds as string[]) : [];
      if (selected.length === 0) continue;

      const en =
        sq.question.translations.find((t) => t.language === "ENGLISH") ?? sq.question.translations[0];
      const correctIds = (en?.correctOptionIds as string[] | null) ?? [];
      const isCorrect =
        correctIds.length > 0 &&
        correctIds.length === selected.length &&
        correctIds.every((id) => selected.includes(id));

      const correctMarks = sq.marksOverride ?? section.marksPerQuestion ?? attempt.test.correctMarks;
      const incorrectMarks =
        sq.negativeMarksOverride ?? section.negativeMarks ?? attempt.test.incorrectMarks;

      score += isCorrect ? correctMarks : incorrectMarks;

      answerUpdates.push(prisma.attemptAnswer.update({ where: { id: ans.id }, data: { isCorrect } }));
    }
  }

  await prisma.$transaction([
    ...answerUpdates,
    prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: isLate ? "AUTO_SUBMITTED" : "SUBMITTED",
        submittedAt: new Date(),
        score,
      },
    }),
  ]);

  return prisma.attempt.findUnique({ where: { id: attemptId } });
}
