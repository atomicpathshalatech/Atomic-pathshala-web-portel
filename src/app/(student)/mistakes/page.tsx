import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { toLegacyQuestion } from "@/lib/questions/legacy";

export const metadata: Metadata = {
  title: "Mistake Book",
};

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default async function MistakeBookPage({
  searchParams,
}: {
  searchParams?: { subject?: string };
}) {
  const { student } = await requireStudentSession();
  const filterSubject = searchParams?.subject;

  // Retrieve all incorrect, actually-attempted answers from finalized test attempts
  const wrongAnswersRaw = await prisma.attemptAnswer.findMany({
    where: {
      attempt: {
        studentId: student.id,
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      },
      isCorrect: false,
    },
    include: {
      question: { include: { translations: true } },
      attempt: { include: { test: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // selectedOptionIds is a Json array — filter out any stray empty-selection
  // rows (shouldn't normally exist for isCorrect: false, but be defensive).
  const wrongAnswers = wrongAnswersRaw
    .map((w) => ({
      ...w,
      selected: Array.isArray(w.selectedOptionIds) ? (w.selectedOptionIds as string[])[0] ?? null : null,
      legacy: toLegacyQuestion(w.question),
    }))
    .filter((w) => w.selected !== null);

  const filtered = filterSubject ? wrongAnswers.filter((w) => w.legacy.subject === filterSubject) : wrongAnswers;

  // Get distinct subjects
  const subjects = Array.from(new Set(wrongAnswers.map((w) => w.legacy.subject).filter(Boolean) as string[]));

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <header>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <span>Practice &amp; Review</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-amber-500 font-semibold">Mistake Book</span>
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg font-bold text-on-surface">
              Mistake Book
            </h1>
            <p className="text-body-lg text-on-surface-variant mt-1">
              Automatically collected questions you got wrong during mock tests. Review solutions and fix conceptual gaps.
            </p>
          </div>
          <div className="bg-amber-400/10 border border-amber-400/30 px-4 py-2 rounded-2xl text-amber-600 dark:text-amber-400 font-bold text-sm shrink-0 self-start sm:self-auto">
            {wrongAnswers.length} Mistakes to Review
          </div>
        </div>
      </header>

      {/* Subject Filter Tabs */}
      {subjects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link
            href="/mistakes"
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              !filterSubject
                ? "bg-amber-400 text-amber-950 shadow-sm"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
          >
            All Subjects ({wrongAnswers.length})
          </Link>
          {subjects.map((s) => (
            <Link
              key={s}
              href={`/mistakes?subject=${encodeURIComponent(s)}`}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterSubject === s
                  ? "bg-amber-400 text-amber-950 shadow-sm"
                  : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {s} ({wrongAnswers.filter((w) => w.legacy.subject === s).length})
            </Link>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-on-surface-variant font-body-md space-y-3">
          <span className="material-symbols-outlined text-4xl text-amber-400/60">verified</span>
          <h2 className="font-headline-md text-on-surface">Your mistake book is clean!</h2>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto">
            {filterSubject
              ? `No mistakes found under ${filterSubject}.`
              : "You haven't made any mistakes on submitted tests yet, or all answers were correct."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item, i) => {
            const q = item.legacy;
            return (
              <div
                key={item.id}
                className="glass-card rounded-2xl p-6 space-y-4 border border-amber-400/30 shadow-sm bg-gradient-to-br from-amber-500/5 via-surface to-surface"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-600 dark:text-amber-400">
                      Mistake #{i + 1}
                    </span>
                    {q.subject && (
                      <span className="text-xs font-semibold text-on-surface-variant">{q.subject}</span>
                    )}
                    {q.chapter && (
                      <span className="text-xs text-on-surface-variant/80">&middot; {q.chapter}</span>
                    )}
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    From: <b>{item.attempt.test?.name ?? "Test"}</b>
                  </span>
                </div>

                <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
                  {q.body}
                </p>

                {/* Options Review */}
                {q.type === "MCQ" && (
                  <div className="space-y-2">
                    {OPTION_KEYS.map((key) => {
                      const label = (q as unknown as Record<string, string | null>)[`option${key}`];
                      if (!label) return null;
                      const isCorrect = q.correctOption === key;
                      const isStudentChoice = item.selected === key;

                      return (
                        <div
                          key={key}
                          className={`px-4 py-2.5 rounded-xl text-xs flex items-center justify-between border ${
                            isCorrect
                              ? "border-secondary bg-secondary/10 text-secondary font-semibold"
                              : isStudentChoice
                              ? "border-error bg-error/10 text-error font-medium"
                              : "border-outline-variant/30 text-on-surface-variant"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{key}.</span>
                            <span>{label}</span>
                          </div>
                          {isCorrect && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                              ✓ Correct Answer
                            </span>
                          )}
                          {isStudentChoice && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-error">
                              ✗ Your Mistake
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Solution Explanation */}
                {q.explanation && (
                  <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/20 space-y-1">
                    <p className="text-xs font-bold text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">lightbulb</span>
                      Correct Derivation &amp; Conceptual Fix
                    </p>
                    <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                      {q.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
