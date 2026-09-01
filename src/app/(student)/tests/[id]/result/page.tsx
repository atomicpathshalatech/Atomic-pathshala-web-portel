import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { toLegacyQuestion } from "@/lib/questions/legacy";
import { FormulaText } from "@/components/test-portal/FormulaText";

export const metadata: Metadata = {
  title: "Test Result & AIR Analytics | Atomic Pathshala",
};

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default async function TestResultPage({ params }: { params: { id: string } }) {
  const { session } = await requireStudentSession();

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
      batchSchedule: { include: { batch: true } },
      testSeries: true,
    },
  });
  if (!test) notFound();
  if (!test.batchScheduleId && !test.testSeriesId) redirect("/tests");

  const { student } = await resolveStudentForTest(session.user.id, test);
  if (!student) redirect("/tests");

  const attempt = await prisma.attempt.findUnique({
    where: { testId_studentId: { testId: test.id, studentId: student.id } },
    include: { answers: true, _count: { select: { violations: true } } },
  });
  if (!attempt) redirect("/tests");
  if (attempt.status === "IN_PROGRESS") redirect(`/tests/${test.id}/attempt`);

  const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const sectionQuestions = test.sections.flatMap((s) => s.questions.map((sq) => ({ ...sq, section: s })));
  const totalMarks = sectionQuestions.reduce(
    (sum, sq) => sum + (sq.marksOverride ?? sq.section.marksPerQuestion ?? test.correctMarks),
    0
  );

  // All finalized attempts for benchmarking
  const finalizedAttempts = await prisma.attempt.findMany({
    where: { testId: test.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    select: { score: true },
  });

  const myScore = attempt.score ?? 0;
  const totalParticipants = Math.max(finalizedAttempts.length, 1);
  const rank = finalizedAttempts.filter((a) => (a.score ?? 0) > myScore).length + 1;
  const topperScore = Math.max(...finalizedAttempts.map((a) => a.score ?? 0), myScore);
  const avgScore =
    finalizedAttempts.reduce((sum, a) => sum + (a.score ?? 0), 0) / totalParticipants;

  const percentile =
    totalParticipants <= 1
      ? 100
      : Math.round(((totalParticipants - rank) / (totalParticipants - 1)) * 100);

  const totalQuestions = sectionQuestions.length;
  let correctCount = 0;
  let incorrectCount = 0;
  for (const ans of attempt.answers) {
    if (ans.isCorrect === true) correctCount++;
    else if (ans.isCorrect === false) incorrectCount++;
  }
  const unattemptedCount = Math.max(0, totalQuestions - attempt.answers.length);
  const accuracyPercent =
    correctCount + incorrectCount > 0
      ? Math.round((correctCount / (correctCount + incorrectCount)) * 100)
      : 0;

  // Subject-wise grouping and diagnostics
  const subjectBreakdown: Record<
    string,
    { total: number; correct: number; incorrect: number; marks: number }
  > = {};

  for (const sq of sectionQuestions) {
    const subj = sq.question.subject || "General";
    if (!subjectBreakdown[subj]) {
      subjectBreakdown[subj] = { total: 0, correct: 0, incorrect: 0, marks: 0 };
    }
    subjectBreakdown[subj].total += 1;
    const ans = answerByQuestion.get(sq.question.id);
    if (ans) {
      const correctMarks = sq.marksOverride ?? sq.section.marksPerQuestion ?? test.correctMarks;
      const incorrectMarks = sq.negativeMarksOverride ?? sq.section.negativeMarks ?? test.incorrectMarks;
      if (ans.isCorrect) {
        subjectBreakdown[subj].correct += 1;
        subjectBreakdown[subj].marks += correctMarks;
      } else {
        subjectBreakdown[subj].incorrect += 1;
        subjectBreakdown[subj].marks += incorrectMarks;
      }
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header Breadcrumb */}
      <div>
        <p className="flex items-center gap-2 text-xs text-on-surface-variant mb-2">
          <Link href="/tests" className="hover:text-primary transition-colors">
            Test Series
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-primary font-bold">{test.name}</span>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg md:text-3xl font-bold text-on-surface">
              {test.name} — Analytics &amp; Scorecard
            </h1>
            <p className="text-xs text-on-surface-variant mt-1">
              {test.batchSchedule ? (
                <>
                  Batch: <b>{test.batchSchedule.batch.name}</b> &middot;{" "}
                </>
              ) : (
                <>
                  Series: <b>{test.testSeries?.name ?? "Standalone Test"}</b> &middot;{" "}
                </>
              )}
              Submitted at:{" "}
              {attempt.submittedAt?.toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <Link
            href="/tests"
            className="px-4 py-2 bg-surface-container-high text-on-surface rounded-xl text-xs font-semibold hover:bg-surface-container-highest transition-colors self-start sm:self-auto"
          >
            &larr; All Tests
          </Link>
        </div>
      </div>

      {/* Hero Rank & AIR Performance Card */}
      <section className="glass-card rounded-3xl p-6 md:p-8 relative overflow-hidden bg-gradient-to-br from-primary/15 via-surface to-surface border-2 border-primary/20 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* AIR Rank Gauge */}
          <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-outline-variant/30 pb-6 md:pb-0 md:pr-6">
            <div className="w-20 h-20 rounded-2xl bg-primary text-on-primary flex flex-col items-center justify-center shadow-lg font-bold">
              <span className="text-xs uppercase tracking-wider opacity-80">Rank</span>
              <span className="text-2xl font-mono">#{rank}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">All India Rank (AIR)</p>
              <p className="text-sm font-bold text-on-surface mt-0.5">
                Top {100 - percentile}% Nationally
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Against {totalParticipants} total test candidates
              </p>
            </div>
          </div>

          {/* Score & Accuracy */}
          <div className="flex justify-around border-b md:border-b-0 md:border-r border-outline-variant/30 pb-6 md:pb-0 md:pr-6">
            <div className="text-center">
              <span className="text-xs text-on-surface-variant block">Total Score</span>
              <span className="font-headline-lg font-bold text-primary font-mono">
                {myScore}
                <span className="text-xs text-on-surface-variant font-normal">/{totalMarks}</span>
              </span>
              <span className="text-[10px] text-on-surface-variant block mt-0.5">
                {Math.round((myScore / (totalMarks || 1)) * 100)}% Marks
              </span>
            </div>
            <div className="text-center">
              <span className="text-xs text-on-surface-variant block">Accuracy</span>
              <span className="font-headline-lg font-bold text-secondary font-mono">{accuracyPercent}%</span>
              <span className="text-[10px] text-on-surface-variant block mt-0.5">
                {correctCount} / {correctCount + incorrectCount} Attempted
              </span>
            </div>
          </div>

          {/* Benchmark Comparison */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-on-surface uppercase tracking-wider">Performance Benchmark</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Topper Score:</span>
                <span className="font-bold text-secondary font-mono">{topperScore} Marks</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Batch Average:</span>
                <span className="font-mono text-on-surface">{avgScore.toFixed(1)} Marks</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Your Score:</span>
                <span className="font-bold text-primary font-mono">{myScore} Marks</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid: Stats & Subject Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* KPI Tiles */}
        <div className="md:col-span-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card rounded-2xl p-4 text-center">
              <span className="material-symbols-outlined text-secondary text-2xl">check_circle</span>
              <p className="font-bold text-lg text-secondary mt-1 font-mono">{correctCount}</p>
              <p className="text-xs text-on-surface-variant">Correct</p>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center">
              <span className="material-symbols-outlined text-error text-2xl">cancel</span>
              <p className="font-bold text-lg text-error mt-1 font-mono">{incorrectCount}</p>
              <p className="text-xs text-on-surface-variant">Incorrect</p>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center">
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">timer</span>
              <p className="font-bold text-lg text-on-surface mt-1 font-mono">{test.durationMin}m</p>
              <p className="text-xs text-on-surface-variant">Duration</p>
            </div>
            <div className="glass-card rounded-2xl p-4 text-center">
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">help_center</span>
              <p className="font-bold text-lg text-on-surface-variant mt-1 font-mono">{unattemptedCount}</p>
              <p className="text-xs text-on-surface-variant">Skipped</p>
            </div>
          </div>

          {/* Exam Integrity Score */}
          <div
            className={`glass-card rounded-2xl p-4 flex items-center justify-between border ${
              attempt.integrityScore >= 90
                ? "border-tertiary/30 bg-tertiary-container/10"
                : attempt.integrityScore >= 70
                ? "border-secondary/30 bg-secondary-container/10"
                : "border-error/30 bg-error-container/10"
            }`}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Exam Integrity Score
              </p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                {attempt._count.violations > 0
                  ? `${attempt._count.violations} proctoring violation${attempt._count.violations === 1 ? "" : "s"} recorded`
                  : "No proctoring violations recorded"}
              </p>
            </div>
            <span
              className={`font-headline-md font-bold font-mono text-2xl ${
                attempt.integrityScore >= 90
                  ? "text-tertiary"
                  : attempt.integrityScore >= 70
                  ? "text-secondary"
                  : "text-error"
              }`}
            >
              {attempt.integrityScore}
            </span>
          </div>

          {/* AI Diagnostic Recommendation */}
          <div className="glass-card rounded-2xl p-5 space-y-2 bg-secondary-container/10 border border-secondary/20">
            <p className="text-xs font-bold text-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">psychology</span>
              Atomic AI Diagnostic Recommendation
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {accuracyPercent >= 80
                ? "Excellent mastery of tested concepts! Focus on improving speed during revision."
                : accuracyPercent >= 50
                ? "Good baseline. Revise flagged questions and review recorded lectures on weaker sub-topics."
                : "Need more conceptual reinforcement. Schedule a 1-on-1 doubt session with your batch faculty."}
            </p>
          </div>
        </div>

        {/* Subject-Wise Mastery Table */}
        <div className="md:col-span-8 glass-card rounded-2xl p-6 space-y-4">
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
            Subject-wise Performance Breakdown
          </h2>
          <div className="space-y-3">
            {Object.entries(subjectBreakdown).map(([subj, data]) => {
              const subjAccuracy =
                data.correct + data.incorrect > 0
                  ? Math.round((data.correct / (data.correct + data.incorrect)) * 100)
                  : 0;
              return (
                <div key={subj} className="space-y-1.5 bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-on-surface">{subj}</span>
                    <span className="font-mono text-primary font-semibold">{data.marks} Marks &middot; {subjAccuracy}% Accuracy</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${subjAccuracy}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-on-surface-variant">
                    <span>{data.correct} Correct</span>
                    <span>{data.incorrect} Incorrect</span>
                    <span>{data.total - data.correct - data.incorrect} Skipped</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed Question Review with KaTeX */}
      <section className="space-y-4">
        <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
          Question-by-Question Detailed Review &amp; Solutions
        </h2>
        <div className="space-y-4">
          {sectionQuestions.map((sq, i) => {
            const ans = answerByQuestion.get(sq.question.id);
            const legacy = toLegacyQuestion(sq.question);
            const selected = Array.isArray(ans?.selectedOptionIds)
              ? (ans!.selectedOptionIds as string[])[0] ?? null
              : null;
            const isCorrect = ans?.isCorrect === true;
            const isSkipped = ans === undefined || selected === null;
            const correctMarks = sq.marksOverride ?? sq.section.marksPerQuestion ?? test.correctMarks;
            const incorrectMarks = sq.negativeMarksOverride ?? sq.section.negativeMarks ?? test.incorrectMarks;

            return (
              <div
                key={sq.id}
                className={`glass-card rounded-2xl p-6 space-y-4 border ${
                  isCorrect
                    ? "border-secondary/30"
                    : isSkipped
                    ? "border-outline-variant/30"
                    : "border-error/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-on-surface-variant">
                      Question {i + 1} &middot; {legacy.subject || "Subject"}
                    </span>
                    {legacy.chapter && (
                      <span className="text-[11px] text-on-surface-variant block mt-0.5">
                        Chapter: {legacy.chapter}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      isSkipped
                        ? "bg-surface-container-high text-on-surface-variant"
                        : isCorrect
                        ? "bg-secondary/15 text-secondary"
                        : "bg-error/15 text-error"
                    }`}
                  >
                    {isSkipped ? "Skipped (0)" : isCorrect ? `Correct (+${correctMarks})` : `Incorrect (${incorrectMarks})`}
                  </span>
                </div>

                <div className="font-body-md text-sm md:text-base text-on-surface leading-relaxed">
                  <FormulaText text={legacy.body} />
                </div>

                {/* Options List */}
                {legacy.type === "MCQ" ? (
                  <div className="space-y-2">
                    {OPTION_KEYS.map((key) => {
                      const label = (legacy as unknown as Record<string, string | null>)[`option${key}`];
                      if (!label) return null;
                      const isCorrectOption = legacy.correctOption === key;
                      const isSelected = selected === key;

                      return (
                        <div
                          key={key}
                          className={`px-4 py-2.5 rounded-xl text-xs flex items-center justify-between border ${
                            isCorrectOption
                              ? "border-secondary bg-secondary/10 text-secondary font-semibold"
                              : isSelected
                              ? "border-error bg-error/10 text-error"
                              : "border-outline-variant/30 text-on-surface-variant"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{key}.</span>
                            <FormulaText text={label} />
                          </div>
                          {isCorrectOption && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                              ✓ Correct Answer
                            </span>
                          )}
                          {isSelected && !isCorrectOption && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-error">
                              ✗ Your Choice
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className="text-on-surface-variant">
                      Your answer: <b className="text-on-surface">{selected ?? "—"}</b>
                    </span>
                    <span className="text-secondary">
                      Correct answer: <b>{legacy.correctOption}</b>
                    </span>
                  </div>
                )}

                {/* Solution Explanation */}
                {legacy.explanation && (
                  <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/20 space-y-1.5">
                    <p className="text-xs font-bold text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">menu_book</span>
                      Detailed Verified Solution & Explanation
                    </p>
                    <div className="text-xs text-on-surface-variant leading-relaxed">
                      <FormulaText text={legacy.explanation} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
