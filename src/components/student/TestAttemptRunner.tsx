"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  order: number;
  body: string;
  type: "MCQ" | "INTEGER";
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  mySelection: string | null;
};

type AttemptData = {
  attempt: { id: string; status: string; startedAt: string; deadlineAt: string };
  test: { id: string; title: string; instructions: string | null; durationMin: number };
  questions: Question[];
};

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function formatClock(totalSec: number) {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export function TestAttemptRunner({ testId }: { testId: string }) {
  const router = useRouter();
  const [data, setData] = useState<AttemptData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tests/${testId}/attempts/my`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setLoadError(json.error ?? "Could not load this test.");
        return;
      }
      const d: AttemptData = json.data;
      if (d.attempt.status !== "IN_PROGRESS") {
        router.replace(`/tests/${testId}/result`);
        return;
      }
      setData(d);
      const initial: Record<string, string | null> = {};
      d.questions.forEach((q) => (initial[q.id] = q.mySelection));
      setAnswers(initial);
    } catch {
      setLoadError("Could not reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [testId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/tests/${testId}/attempts/my/submit`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSubmitError(json.error ?? "Could not submit. Please try again.");
        submittedRef.current = false;
        return;
      }
      router.replace(`/tests/${testId}/result`);
    } catch {
      setSubmitError("Could not reach the server. Please try again.");
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [testId, router]);

  // Countdown — server owns the real deadline; this is display-only, and
  // reaching zero here just triggers the same submit call the button does.
  useEffect(() => {
    if (!data) return;
    const deadlineMs = new Date(data.attempt.deadlineAt).getTime();
    const tick = () => {
      const secLeft = Math.round((deadlineMs - Date.now()) / 1000);
      setRemainingSec(Math.max(0, secLeft));
      if (secLeft <= 0) doSubmit();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data, doSubmit]);

  function scheduleSave(questionId: string, value: string | null) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (saveTimers.current[questionId]) clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => saveAnswer(questionId, value), 500);
  }

  async function saveAnswer(questionId: string, value: string | null) {
    setSavingIds((prev) => new Set(prev).add(questionId));
    try {
      await fetch(`/api/tests/${testId}/attempts/my/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, selectedOption: value }),
      });
    } catch {
      // best-effort autosave — the student can still re-pick to retry
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  }

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v !== null && v !== "").length,
    [answers]
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center text-on-surface-variant font-body-md">
        Loading test…
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="glass-card rounded-2xl p-10 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-error">error</span>
          <p className="font-headline-md text-headline-md text-on-surface">{loadError ?? "Something went wrong."}</p>
        </div>
      </div>
    );
  }

  const question = data.questions[currentIndex];
  const totalQuestions = data.questions.length;

  return (
    <div className="max-w-5xl mx-auto space-y-stack-md pb-24">
      <div className="sticky top-[73px] z-40 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20 -mx-margin-mobile md:-mx-margin-desktop px-margin-mobile md:px-margin-desktop py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface">{data.test.title}</h1>
            <p className="text-label-sm text-on-surface-variant">
              {answeredCount}/{totalQuestions} answered
            </p>
          </div>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-headline-md text-headline-md ${
              remainingSec <= 60 ? "bg-error/10 text-error" : "bg-primary/10 text-primary"
            }`}
          >
            <span className="material-symbols-outlined">timer</span>
            {formatClock(remainingSec)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-md">
        <aside className="lg:col-span-3 order-2 lg:order-1">
          <div className="glass-card rounded-xl p-4 lg:sticky lg:top-40">
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-3">Questions</h3>
            <div className="grid grid-cols-6 lg:grid-cols-4 gap-2">
              {data.questions.map((q, i) => {
                const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] !== "";
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(i)}
                    className={`h-9 rounded-lg text-label-sm font-bold transition-all ${
                      isCurrent
                        ? "bg-primary text-on-primary ring-2 ring-primary/40"
                        : isAnswered
                        ? "bg-secondary/10 text-secondary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="lg:col-span-9 order-1 lg:order-2 space-y-stack-md">
          {question && (
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-label-sm text-on-surface-variant">
                  Question {currentIndex + 1} of {totalQuestions}
                </p>
                {savingIds.has(question.id) && (
                  <span className="text-label-sm text-on-surface-variant">Saving…</span>
                )}
              </div>
              <p className="font-body-md text-body-lg text-on-surface whitespace-pre-wrap">{question.body}</p>

              {question.type === "MCQ" ? (
                <div className="space-y-2">
                  {OPTION_KEYS.map((key) => {
                    const label = (question as unknown as Record<string, string | null>)[`option${key}`];
                    if (!label) return null;
                    const selected = answers[question.id] === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => scheduleSave(question.id, key)}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-label-md transition-colors ${
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-outline-variant hover:bg-surface-container-high text-on-surface"
                        }`}
                      >
                        <span className="font-bold mr-2">{key}.</span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  value={answers[question.id] ?? ""}
                  onChange={(e) => scheduleSave(question.id, e.target.value === "" ? null : e.target.value)}
                  placeholder="Type your numeric answer"
                  className="w-full max-w-xs rounded-lg border border-outline-variant bg-surface-container-lowest py-2.5 px-4 text-body-md outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}

              {(answers[question.id] !== null && answers[question.id] !== undefined && answers[question.id] !== "") && (
                <button
                  type="button"
                  onClick={() => scheduleSave(question.id, null)}
                  className="text-label-sm text-on-surface-variant hover:text-error hover:underline"
                >
                  Clear answer
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface font-label-md hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            {currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md hover:opacity-90 transition-all"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingSubmit(true)}
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md hover:opacity-90 transition-all"
              >
                Review &amp; Submit
              </button>
            )}
          </div>
        </section>
      </div>

      {confirmingSubmit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-headline-md text-headline-md text-on-surface">Submit this test?</h3>
            <p className="text-body-md text-on-surface-variant">
              You&apos;ve answered {answeredCount} of {totalQuestions} questions. Once submitted, you
              can&apos;t change your answers.
            </p>
            {submitError && <p className="text-label-sm text-error">{submitError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmingSubmit(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface font-label-md hover:bg-surface-container-high disabled:opacity-60 transition-all"
              >
                Keep Reviewing
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={doSubmit}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
