"use client";

import { useEffect, useMemo, useState } from "react";
import { MathText } from "@/components/ai-chat/MathText";
import { useUrlParams } from "@/lib/navigation/use-url-params";

type Overview = {
  subjects: {
    name: string;
    count: number;
    papers: { examId: string; examName: string; year: number; count: number }[];
    chapters: { name: string; count: number }[];
  }[];
};
type Q = { id: string; type: string; statement: string; imageUrl: string | null; options: { key: string; text: string }[]; label: string | null };
type Result = { questionId: string; correct: boolean; correctKeys: string[]; solution: string | null };

const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/**
 * PYQ practice: subject → Year-wise (a whole paper) or Chapter-wise (one
 * chapter's PYQs) → test mode (question palette, timer, submit) → result
 * with the right answers and solutions. Each step is in the URL, so the
 * phone's Back key steps back through them.
 */
export function PyqPractice() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useUrlParams(["ps", "pm", "pe", "py", "pc"] as const);

  useEffect(() => {
    fetch("/api/student/pyq", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.success ? setOverview(j.data) : setError(j.error || "Could not load PYQs.")))
      .catch(() => setError("Could not load PYQs. Check your connection."));
  }, []);

  const subject = overview?.subjects.find((s) => s.name === step.ps) ?? overview?.subjects[0] ?? null;
  const mode = step.pm === "chapter" ? "chapter" : "year";
  const running = Boolean(step.pc || (step.pe && step.py));

  if (error) return <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>;
  if (!overview) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (overview.subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
        <span className="material-symbols-outlined text-3xl text-slate-300">history_edu</span>
        <p className="mt-2 text-sm font-semibold text-slate-600">PYQs will appear here soon.</p>
      </div>
    );
  }

  if (running && subject) {
    const paper = subject.papers.find((p) => p.examId === step.pe && String(p.year) === step.py);
    const title = step.pc ? step.pc : paper ? `${paper.examName} ${paper.year}` : "PYQs";
    return <PyqRunner key={`${subject.name}|${step.pe}|${step.py}|${step.pc}`} subject={subject.name} examId={step.pe} year={step.py} chapter={step.pc} title={title} />;
  }

  return (
    <div className="space-y-4">
      {/* Subject */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {overview.subjects.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setStep({ ps: s.name, pe: null, py: null, pc: null })}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition ${s.name === subject?.name ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
          >
            {s.name} <span className="opacity-70">· {s.count}</span>
          </button>
        ))}
      </div>

      {/* Year-wise | Chapter-wise */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(["year", "chapter"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setStep({ ps: subject?.name ?? null, pm: m === "chapter" ? "chapter" : null })}
            className={`rounded-lg py-2 text-sm font-bold transition ${mode === m ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
          >
            {m === "year" ? "Year-wise" : "Chapter-wise"}
          </button>
        ))}
      </div>

      {mode === "year" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(subject?.papers ?? []).map((p) => (
            <button
              key={`${p.examId}:${p.year}`}
              type="button"
              onClick={() => setStep({ ps: subject!.name, pm: null, pe: p.examId, py: String(p.year), pc: null })}
              className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-400"
            >
              <span className="block text-lg font-black text-slate-900">{p.year}</span>
              <span className="block text-xs font-semibold text-slate-600">{p.examName}</span>
              <span className="mt-1 block text-[11px] text-slate-400">{p.count} questions</span>
            </button>
          ))}
          {(subject?.papers.length ?? 0) === 0 && <p className="col-span-full text-sm text-slate-500">No year-wise papers for this subject yet.</p>}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {(subject?.chapters ?? []).map((c) => (
            <li key={c.name}>
              <button
                type="button"
                onClick={() => setStep({ ps: subject!.name, pm: "chapter", pe: null, py: null, pc: c.name })}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="truncate text-sm font-semibold text-slate-900">{c.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{c.count} Qs</span>
              </button>
            </li>
          ))}
          {(subject?.chapters.length ?? 0) === 0 && <li className="px-4 py-3 text-sm text-slate-500">No chapter-wise PYQs for this subject yet.</li>}
        </ul>
      )}
    </div>
  );
}

function PyqRunner({ subject, examId, year, chapter, title }: { subject: string; examId: string | null; year: string | null; chapter: string | null; title: string }) {
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<Record<string, Result> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const qs = new URLSearchParams({ subject });
    if (chapter) qs.set("chapter", chapter);
    if (examId) qs.set("exam", examId);
    if (year) qs.set("year", year);
    fetch(`/api/student/pyq/questions?${qs}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.success ? setQuestions(j.data.questions) : setError(j.error || "Could not load the questions.")))
      .catch(() => setError("Could not load the questions."));
  }, [subject, examId, year, chapter]);

  useEffect(() => {
    if (!questions || results) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [questions, results]);

  const score = useMemo(() => {
    if (!results) return null;
    const list = Object.values(results);
    const correct = list.filter((r) => r.correct).length;
    const attempted = Object.values(answers).filter((a) => a.length > 0).length;
    return { correct, wrong: attempted - correct, skipped: (questions?.length ?? 0) - attempted };
  }, [results, answers, questions]);

  if (error) return <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>;
  if (!questions) return <div className="h-60 animate-pulse rounded-2xl bg-slate-100" />;
  if (questions.length === 0) return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No questions here yet.</p>;

  const q = questions[index]!;
  const multi = q.type === "MULTIPLE_CORRECT";
  const numeric = q.type === "INTEGER" || q.type === "NUMERIC";
  const chosen = answers[q.id] ?? [];
  const result = results?.[q.id];

  const choose = (key: string) => {
    if (results) return;
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      const next = multi ? (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]) : cur[0] === key ? [] : [key];
      return { ...prev, [q.id]: next };
    });
  };

  const submit = async () => {
    const attempted = Object.values(answers).filter((a) => a.length > 0).length;
    if (!window.confirm(`Submit? ${attempted} of ${questions.length} answered.`)) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/pyq/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: questions.map((x) => ({ questionId: x.id, selected: answers[x.id] ?? [] })) }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Could not check the answers.");
      setResults(Object.fromEntries((j.data.results as Result[]).map((r) => [r.questionId, r])));
      setIndex(0);
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">{title}</p>
          <p className="text-[11px] text-slate-500">{subject} · {questions.length} questions</p>
        </div>
        {results && score ? (
          <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
            ✓ {score.correct} · ✗ {score.wrong} · – {score.skipped}
          </span>
        ) : (
          <span className="shrink-0 font-mono text-sm font-bold text-slate-700">{fmt(seconds)}</span>
        )}
      </div>

      {/* Question palette */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {questions.map((x, i) => {
          const r = results?.[x.id];
          const answered = (answers[x.id] ?? []).length > 0;
          const tone = r ? (r.correct ? "bg-emerald-500 text-white" : answered ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-600") : answered ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200";
          return (
            <button key={x.id} type="button" onClick={() => setIndex(i)} className={`h-8 min-w-8 shrink-0 rounded-lg px-2 text-xs font-bold ${tone} ${i === index ? "ring-2 ring-blue-300" : ""}`}>
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-bold">Q{index + 1}{multi ? " · more than one correct" : numeric ? " · numerical" : ""}</span>
          {q.label && <span className="truncate">{q.label}</span>}
        </div>
        <div className="text-sm text-slate-900">
          <MathText text={q.statement} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- question figure from storage */}
        {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-64 rounded-lg border border-slate-100" />}

        {numeric ? (
          <input
            inputMode="decimal"
            value={chosen[0] ?? ""}
            disabled={Boolean(results)}
            onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value.trim() ? [e.target.value.trim()] : [] }))}
            placeholder="Your answer"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        ) : (
          <div className="space-y-2">
            {q.options.map((o) => {
              const isChosen = chosen.includes(o.key);
              const isRight = result?.correctKeys.map((k) => k.toUpperCase()).includes(o.key.toUpperCase());
              const tone = result
                ? isRight
                  ? "border-emerald-500 bg-emerald-50"
                  : isChosen
                  ? "border-rose-400 bg-rose-50"
                  : "border-slate-200"
                : isChosen
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300";
              return (
                <button key={o.key} type="button" onClick={() => choose(o.key)} className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm ${tone}`}>
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">{o.key}</span>
                  <span className="min-w-0 flex-1">
                    <MathText text={o.text} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {result && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className={`font-bold ${result.correct ? "text-emerald-700" : "text-rose-700"}`}>
              {result.correct ? "Correct" : `Answer: ${result.correctKeys.join(", ") || "—"}`}
            </p>
            {result.solution && (
              <div className="mt-1 text-slate-700">
                <MathText text={result.solution} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">
          Previous
        </button>
        {!results && (
          <button type="button" disabled={submitting} onClick={submit} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {submitting ? "Checking…" : "Submit"}
          </button>
        )}
        <button type="button" disabled={index === questions.length - 1} onClick={() => setIndex((i) => i + 1)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}
