import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveStudentForSchedule } from "@/lib/batch/access";

export const metadata: Metadata = {
  title: "Test Result",
};

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default async function TestResultPage({ params }: { params: { id: string } }) {
  const { session } = await requireStudentSession();

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { order: "asc" }, include: { question: true } }, batchSchedule: true },
  });
  if (!test) notFound();

  const { student } = await resolveStudentForSchedule(session.user.id, test.batchScheduleId);
  if (!student) redirect("/tests");

  const attempt = await prisma.testAttempt.findUnique({
    where: { testId_studentId: { testId: test.id, studentId: student.id } },
    include: { answers: true },
  });
  if (!attempt) redirect("/tests");
  if (attempt.status === "IN_PROGRESS") redirect(`/tests/${test.id}/attempt`);

  const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const totalMarks = test.questions.reduce((sum, tq) => sum + tq.question.marksCorrect, 0);

  // Rank among every other finalized attempt on this same test — real
  // data, computed fresh per view rather than cached, since scores can
  // still change while a batch-mate's attempt is being graded/re-graded.
  // IN_PROGRESS attempts don't have a final score yet, so they're excluded
  // from the pool entirely (this page itself only renders once the
  // viewer's own attempt is no longer IN_PROGRESS, per the redirect above).
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

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <Link href="/tests" className="hover:text-primary">
            Test Series
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">{test.title}</span>
        </p>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">{test.title}</h1>
      </div>

      <div className="glass-card rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <p className="font-headline-lg text-headline-lg text-primary">
            {attempt.score ?? 0}
            <span className="text-label-md text-on-surface-variant">/{totalMarks}</span>
          </p>
          <p className="text-label-sm text-on-surface-variant mt-1">Score</p>
        </div>
        <div className="text-center">
          <p className="font-headline-lg text-headline-lg text-secondary">{attempt.correctCount ?? 0}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">Correct</p>
        </div>
        <div className="text-center">
          <p className="font-headline-lg text-headline-lg text-error">{attempt.incorrectCount ?? 0}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">Incorrect</p>
        </div>
        <div className="text-center">
          <p className="font-headline-lg text-headline-lg text-on-surface-variant">{attempt.unattemptedCount ?? 0}</p>
          <p className="text-label-sm text-on-surface-variant mt-1">Unattempted</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">Your Rank</p>
          <p className="font-headline-md text-headline-md text-on-surface mt-0.5">
            #{rank} <span className="text-on-surface-variant font-body-sm text-body-sm">of {totalParticipants}</span>
          </p>
        </div>
        <p className="text-body-sm text-on-surface-variant text-right">
          Better than <span className="font-bold text-primary">{percentile}%</span>
          <br />
          of test-takers
        </p>
      </div>

      {attempt.status === "AUTO_SUBMITTED" && (
        <div className="rounded-xl bg-secondary/10 border border-secondary/20 px-4 py-3 text-label-sm text-secondary">
          This attempt was auto-submitted when time ran out.
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">Review</h2>
        {test.questions.map((tq, i) => {
          const ans = answerByQuestion.get(tq.question.id);
          const q = tq.question;
          return (
            <div key={tq.id} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-label-sm text-on-surface-variant">Question {i + 1}</p>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                    ans === undefined
                      ? "bg-surface-container-high text-on-surface-variant"
                      : ans.isCorrect
                      ? "bg-secondary/10 text-secondary"
                      : "bg-error/10 text-error"
                  }`}
                >
                  {ans === undefined ? "Unattempted" : ans.isCorrect ? "Correct" : "Incorrect"}
                  {ans !== undefined &&
                    ` · ${(ans.marksAwarded ?? 0) >= 0 ? "+" : ""}${ans.marksAwarded ?? 0}`}
                </span>
              </div>
              <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{q.body}</p>

              {q.type === "MCQ" ? (
                <div className="space-y-1.5">
                  {OPTION_KEYS.map((key) => {
                    const label = (q as unknown as Record<string, string | null>)[`option${key}`];
                    if (!label) return null;
                    const isCorrectOption = q.correctOption === key;
                    const isMine = ans?.selectedOption === key;
                    return (
                      <div
                        key={key}
                        className={`px-3 py-2 rounded-lg text-label-md border ${
                          isCorrectOption
                            ? "border-secondary bg-secondary/10 text-secondary"
                            : isMine
                            ? "border-error bg-error/10 text-error"
                            : "border-outline-variant text-on-surface-variant"
                        }`}
                      >
                        <span className="font-bold mr-2">{key}.</span>
                        {label}
                        {isCorrectOption && " ✓"}
                        {isMine && !isCorrectOption && " (your answer)"}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-4 text-label-md">
                  <span className="text-on-surface-variant">
                    Your answer: <span className="text-on-surface font-bold">{ans?.selectedOption ?? "—"}</span>
                  </span>
                  <span className="text-secondary">
                    Correct answer: <span className="font-bold">{q.correctOption}</span>
                  </span>
                </div>
              )}

              {q.explanation && (
                <p className="text-label-sm text-on-surface-variant border-t border-outline-variant/20 pt-3">
                  <span className="font-bold text-on-surface">Explanation: </span>
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
