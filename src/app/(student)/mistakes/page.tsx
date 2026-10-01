import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { loadMistakeBook } from "@/lib/mistakes/mistake-book";
import { MistakeSolveButton } from "@/components/student/MistakeSolveButton";

export const metadata: Metadata = {
  title: "Mistake Book",
};

export default async function MistakeBookPage({
  searchParams,
}: {
  searchParams?: { subject?: string; source?: string; view?: string };
}) {
  const { student, session } = await requireStudentSession();
  const filterSubject = searchParams?.subject;
  const filterSource = searchParams?.source || "ALL";
  const view = searchParams?.view === "solved" ? "solved" : "review";

  const everything = await loadMistakeBook(student.id, session.user.id);
  const toReview = everything.filter((m) => !m.solved);
  const solvedList = everything.filter((m) => m.solved);
  const allMistakes = view === "solved" ? solvedList : toReview;
  const testMistakes = allMistakes.filter((m) => m.source === "TEST_SERIES");
  const guruMistakes = allMistakes.filter((m) => m.source === "ATOMIC_GURU");
  const ncertMistakes = allMistakes.filter((m) => m.source === "NCERT");
  const qs = (o: Record<string, string | undefined>) =>
    Object.entries({ view: view === "solved" ? "solved" : undefined, ...o })
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");

  // Apply filters
  let filtered = allMistakes;
  if (filterSource === "TESTS") {
    filtered = filtered.filter((m) => m.source === "TEST_SERIES");
  } else if (filterSource === "GURU") {
    filtered = filtered.filter((m) => m.source === "ATOMIC_GURU");
  } else if (filterSource === "NCERT") {
    filtered = filtered.filter((m) => m.source === "NCERT");
  }

  if (filterSubject) {
    filtered = filtered.filter((m) => m.subject === filterSubject);
  }

  // Extract distinct subjects
  const subjects = Array.from(new Set(allMistakes.map((w) => w.subject).filter(Boolean)));

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
              Automatically collected questions you got wrong across Mock Tests and Atomic Guru Practice. Review solutions and master your weak areas.
            </p>
          </div>
          <div className="bg-amber-400/10 border border-amber-400/30 px-4 py-2 rounded-2xl text-amber-600 dark:text-amber-400 font-bold text-sm shrink-0 self-start sm:self-auto">
            {toReview.length} to review · {solvedList.length} solved
          </div>
        </div>
      </header>

      {/* To review | Solved */}
      <div className="grid grid-cols-2 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {([
          ["review", "To review", toReview.length, "pending_actions"],
          ["solved", "Solved", solvedList.length, "task_alt"],
        ] as const).map(([v, label, n, icon]) => (
          <Link
            key={v}
            href={`/mistakes${v === "solved" ? "?view=solved" : ""}`}
            className={`relative py-3 flex items-center justify-center gap-1.5 text-sm font-bold ${view === v ? "text-slate-900 dark:text-white" : "text-slate-500"}`}
          >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            {label}
            <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] flex items-center justify-center ${view === v ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800"}`}>{n}</span>
            {view === v && <span className="absolute bottom-0 left-6 right-6 h-[3px] rounded-full bg-slate-900 dark:bg-white" />}
          </Link>
        ))}
      </div>

      {/* Source Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-outline-variant/30 pb-3">
        <Link
          href={`/mistakes?${qs({ subject: filterSubject, source: "ALL" })}`}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
            filterSource === "ALL"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          All Sources ({allMistakes.length})
        </Link>
        <Link
          href={`/mistakes?${qs({ subject: filterSubject, source: "TESTS" })}`}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            filterSource === "TESTS"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-sm">quiz</span>
          <span>Mock Tests ({testMistakes.length})</span>
        </Link>
        <Link
          href={`/mistakes?${qs({ subject: filterSubject, source: "GURU" })}`}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            filterSource === "GURU"
              ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-sm">psychology</span>
          <span>Atomic Guru ({guruMistakes.length})</span>
        </Link>
        <Link
          href={`/mistakes?${qs({ subject: filterSubject, source: "NCERT" })}`}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            filterSource === "NCERT"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-sm">menu_book</span>
          <span>NCERT ({ncertMistakes.length})</span>
        </Link>
      </div>

      {/* Subject Filter Tabs */}
      {subjects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link
            href={`/mistakes?${qs({ source: filterSource !== "ALL" ? filterSource : undefined })}`}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              !filterSubject
                ? "bg-amber-400 text-amber-950 shadow-sm"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
          >
            All Subjects ({allMistakes.length})
          </Link>
          {subjects.map((s) => (
            <Link
              key={s}
              href={`/mistakes?${qs({ subject: s, source: filterSource !== "ALL" ? filterSource : undefined })}`}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterSubject === s
                  ? "bg-amber-400 text-amber-950 shadow-sm"
                  : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {s} ({allMistakes.filter((w) => w.subject === s).length})
            </Link>
          ))}
        </div>
      )}

      {/* Mistakes List or Empty State */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-on-surface-variant font-body-md space-y-3">
          <span className="material-symbols-outlined text-4xl text-amber-400/60">verified</span>
          <h2 className="font-headline-md text-on-surface">{view === "solved" ? "Nothing solved yet" : "Your mistake book is clean!"}</h2>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto">
            {view === "solved"
              ? "When you understand a question, tap \"I understood it\" and it moves here."
              : filterSubject
              ? `No mistakes found under ${filterSubject}.`
              : "No wrong answers to review from tests, Atomic Guru or NCERT practice."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item, i) => (
            <div
              key={item.key}
              className="glass-card rounded-2xl p-6 space-y-4 border border-amber-400/30 shadow-sm bg-gradient-to-br from-amber-500/5 via-surface to-surface"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-600 dark:text-amber-400">
                    {item.solved ? "Solved" : `Mistake #${i + 1}`}
                  </span>
                  {item.source === "ATOMIC_GURU" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-400/30">
                      Atomic Guru Practice
                    </span>
                  ) : item.source === "NCERT" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      NCERT Practice
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      Mock Test Series
                    </span>
                  )}
                  {item.subject && (
                    <span className="text-xs font-semibold text-on-surface-variant">{item.subject}</span>
                  )}
                  {item.chapter && (
                    <span className="text-xs text-on-surface-variant/80">&middot; {item.chapter}</span>
                  )}
                  {item.topic && (
                    <span className="text-xs text-on-surface-variant/70">&middot; {item.topic}</span>
                  )}
                  {item.attemptCount > 1 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      Attempted {item.attemptCount}x
                    </span>
                  )}
                </div>
                <span className="text-xs text-on-surface-variant">
                  From: <b>{item.sourceName}</b>
                </span>
              </div>

              <div className="font-body-md text-body-md text-on-surface leading-relaxed min-w-0">
                <FormulaText text={item.body} />
              </div>

              {/* Options Review */}
              {item.options.length > 0 && (
                <div className="space-y-2">
                  {item.options.map((opt) => (
                    <div
                      key={opt.key}
                      className={`px-4 py-2.5 rounded-xl text-xs flex items-start justify-between gap-2 min-w-0 border ${
                        opt.isCorrect
                          ? "border-secondary bg-secondary/10 text-secondary font-semibold"
                          : opt.isStudentChoice
                          ? "border-error bg-error/10 text-error font-medium"
                          : "border-outline-variant/30 text-on-surface-variant"
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span className="font-bold shrink-0">{opt.key}.</span>
                        <FormulaText text={opt.label} className="min-w-0" />
                      </div>
                      {opt.isCorrect && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-secondary">
                          ✓ Correct Answer
                        </span>
                      )}
                      {opt.isStudentChoice && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-error">
                          ✗ Your Mistake
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Solution Explanation */}
              {item.explanation && (
                <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/20 space-y-1">
                  <p className="text-xs font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                    Correct Derivation &amp; Conceptual Fix
                  </p>
                  <div className="text-xs text-on-surface-variant leading-relaxed min-w-0">
                    <FormulaText text={item.explanation} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <span className="text-[11px] text-on-surface-variant">
                  {item.solved && item.solvedAt
                    ? `Solved on ${item.solvedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : "Understood the solution? Clear your doubt, then mark it solved."}
                </span>
                <MistakeSolveButton mistakeKey={item.key} solved={item.solved} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
