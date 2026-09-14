import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { toLegacyQuestion } from "@/lib/questions/legacy";

export const metadata: Metadata = {
  title: "Mistake Book",
};

interface UnifiedMistake {
  id: string;
  source: "TEST_SERIES" | "ATOMIC_GURU";
  sourceName: string;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  body: string;
  options: { key: string; label: string; isCorrect: boolean; isStudentChoice: boolean }[];
  explanation?: string | null;
  attemptCount: number;
  date: Date;
}

export default async function MistakeBookPage({
  searchParams,
}: {
  searchParams?: { subject?: string; source?: string };
}) {
  const { student, session } = await requireStudentSession();
  const filterSubject = searchParams?.subject;
  const filterSource = searchParams?.source || "ALL";

  // 1. Retrieve test series mistakes (finalized attempts, isCorrect: false)
  const testMistakesRaw = await prisma.attemptAnswer.findMany({
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

  const testMistakes: UnifiedMistake[] = testMistakesRaw
    .map((w): UnifiedMistake | null => {
      const selected = Array.isArray(w.selectedOptionIds)
        ? (w.selectedOptionIds as string[])[0] ?? null
        : null;
      if (!selected) return null;
      const leg = toLegacyQuestion(w.question);
      const options = ["A", "B", "C", "D"]
        .map((key) => {
          const label = String((leg as any)[`option${key}`] || "");
          return {
            key,
            label,
            isCorrect: leg.correctOption === key,
            isStudentChoice: selected === key,
          };
        })
        .filter((opt) => !!opt.label);

      return {
        id: `test_${w.id}`,
        source: "TEST_SERIES",
        sourceName: w.attempt.test?.name ?? "Mock Test",
        subject: leg.subject || "General",
        chapter: leg.chapter || null,
        topic: null,
        body: leg.body,
        options,
        explanation: leg.explanation || null,
        attemptCount: 1,
        date: w.updatedAt,
      };
    })
    .filter((item): item is UnifiedMistake => item !== null);

  // 2. Retrieve Atomic Guru practice mistakes (de-duplicated by questionId, latest attempt is wrong)
  const guruAnswersRaw = await prisma.quizAttemptAnswer.findMany({
    where: {
      attempt: {
        userId: session.user.id,
      },
    },
    include: {
      attempt: true,
    },
    orderBy: { lastAttemptedAt: "desc" },
  });

  // De-duplicate: Keep only the latest attempt per questionId
  const latestGuruByQ = new Map<string, (typeof guruAnswersRaw)[0]>();
  for (const ans of guruAnswersRaw) {
    if (!latestGuruByQ.has(ans.questionId)) {
      latestGuruByQ.set(ans.questionId, ans);
    }
  }

  const guruMistakes: UnifiedMistake[] = Array.from(latestGuruByQ.values())
    .filter((a) => a.isCorrect === false) // only latest incorrect answers!
    .map((a) => {
      const rawOpts = Array.isArray(a.options) ? (a.options as string[]) : [];
      const options = rawOpts.map((optText, idx) => {
        const letter = String.fromCharCode(65 + idx);
        return {
          key: letter,
          label: String(optText),
          isCorrect: a.correctAnswer === letter,
          isStudentChoice: a.selectedAnswer === letter,
        };
      });

      return {
        id: `guru_${a.id}`,
        source: "ATOMIC_GURU" as const,
        sourceName: a.attempt.subject || "Atomic Guru Practice",
        subject: a.subject || a.attempt.subject || "General",
        chapter: a.chapter || null,
        topic: a.topic || a.attempt.topic || null,
        body: a.questionText || "Question description",
        options,
        explanation: a.solution || null,
        attemptCount: a.attemptCount || 1,
        date: a.lastAttemptedAt || a.answeredAt,
      };
    });

  // 3. Combine both mistake sources
  const allMistakes: UnifiedMistake[] = [...testMistakes, ...guruMistakes].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  // Apply filters
  let filtered = allMistakes;
  if (filterSource === "TESTS") {
    filtered = filtered.filter((m) => m.source === "TEST_SERIES");
  } else if (filterSource === "GURU") {
    filtered = filtered.filter((m) => m.source === "ATOMIC_GURU");
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
            {allMistakes.length} Mistakes to Review
          </div>
        </div>
      </header>

      {/* Source Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-outline-variant/30 pb-3">
        <Link
          href={`/mistakes?${filterSubject ? `subject=${encodeURIComponent(filterSubject)}&` : ""}source=ALL`}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
            filterSource === "ALL"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-xs"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          All Sources ({allMistakes.length})
        </Link>
        <Link
          href={`/mistakes?${filterSubject ? `subject=${encodeURIComponent(filterSubject)}&` : ""}source=TESTS`}
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
          href={`/mistakes?${filterSubject ? `subject=${encodeURIComponent(filterSubject)}&` : ""}source=GURU`}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            filterSource === "GURU"
              ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-sm">psychology</span>
          <span>Atomic Guru ({guruMistakes.length})</span>
        </Link>
      </div>

      {/* Subject Filter Tabs */}
      {subjects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link
            href={`/mistakes?${filterSource !== "ALL" ? `source=${filterSource}` : ""}`}
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
              href={`/mistakes?subject=${encodeURIComponent(s)}${
                filterSource !== "ALL" ? `&source=${filterSource}` : ""
              }`}
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
          <h2 className="font-headline-md text-on-surface">Your mistake book is clean!</h2>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto">
            {filterSubject
              ? `No mistakes found under ${filterSubject}.`
              : "You haven't made any mistakes on submitted tests or Atomic Guru practice yet, or previous errors were corrected."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item, i) => (
            <div
              key={item.id}
              className="glass-card rounded-2xl p-6 space-y-4 border border-amber-400/30 shadow-sm bg-gradient-to-br from-amber-500/5 via-surface to-surface"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-600 dark:text-amber-400">
                    Mistake #{i + 1}
                  </span>
                  {item.source === "ATOMIC_GURU" ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-400/30">
                      Atomic Guru Practice
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

              <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
                {item.body}
              </p>

              {/* Options Review */}
              {item.options.length > 0 && (
                <div className="space-y-2">
                  {item.options.map((opt) => (
                    <div
                      key={opt.key}
                      className={`px-4 py-2.5 rounded-xl text-xs flex items-center justify-between border ${
                        opt.isCorrect
                          ? "border-secondary bg-secondary/10 text-secondary font-semibold"
                          : opt.isStudentChoice
                          ? "border-error bg-error/10 text-error font-medium"
                          : "border-outline-variant/30 text-on-surface-variant"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{opt.key}.</span>
                        <span>{opt.label}</span>
                      </div>
                      {opt.isCorrect && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                          ✓ Correct Answer
                        </span>
                      )}
                      {opt.isStudentChoice && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-error">
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
                  <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                    {item.explanation}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
