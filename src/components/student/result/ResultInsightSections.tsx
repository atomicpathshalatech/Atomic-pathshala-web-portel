"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { NcertRecommendation } from "@/lib/test-engine/analysis-engine";
import { buildImprovementPlan, type Bucket, type ResultInsights } from "@/lib/test-engine/result-insights";

/**
 * Result-page analysis built from this attempt's real per-question data
 * (see result-insights.ts): what each subject / question type cost, how the
 * exam was played (guesses, time, easy misses), what to revise in NCERT and
 * a short, ordered plan.
 */

const fmtTime = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 ${className}`}>{children}</div>;
}

function Heading({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
        <span className="material-symbols-outlined text-slate-700 dark:text-slate-200">{icon}</span>
        {title}
      </h3>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

const accTone = (a: number) => (a >= 80 ? "bg-emerald-500" : a >= 60 ? "bg-amber-500" : "bg-rose-500");

function Numbers({ b }: { b: Bucket }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        ["Correct", b.correct, "text-emerald-600"],
        ["Wrong", b.incorrect, "text-rose-600"],
        ["Skipped", b.skipped, "text-slate-500"],
        ["Avg time", fmtTime(b.avgTimeSec), "text-slate-700 dark:text-slate-200"],
      ].map(([l, v, c]) => (
        <div key={l as string} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 py-2">
          <p className={`text-sm font-black font-mono ${c}`}>{v}</p>
          <p className="text-[10px] text-slate-500">{l}</p>
        </div>
      ))}
    </div>
  );
}

export function SubjectInsights({ insights }: { insights: ResultInsights }) {
  return (
    <div>
      <Heading icon="donut_large" title="Subject analysis" sub="Weakest subject first — where the most marks were left" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {insights.subjects.map((s) => (
          <Card key={s.key} className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-black text-slate-900 dark:text-white">{s.key}</p>
              <p className="font-mono text-sm font-black text-slate-900 dark:text-white">
                {s.score}
                <span className="text-slate-400 font-bold"> / {s.max}</span>
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Accuracy {s.accuracy}%</span>
                <span>Attempted {s.attemptRate}%</span>
              </div>
              <Bar value={s.accuracy} tone={accTone(s.accuracy)} />
            </div>
            <Numbers b={s} />
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-xl border border-rose-100 dark:border-rose-900/50 px-2.5 py-1.5">
                <span className="text-slate-500">Lost to negatives</span>
                <p className="font-black text-rose-600 font-mono">−{s.negative}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5">
                <span className="text-slate-500">Marks left</span>
                <p className="font-black text-slate-900 dark:text-white font-mono">{s.missed}</p>
              </div>
            </div>
            {s.weakChapters.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Fix first</p>
                <ul className="space-y-1">
                  {s.weakChapters.map((c) => (
                    <li key={c.key} className="flex justify-between gap-2 text-xs">
                      <span className="truncate text-slate-800 dark:text-slate-200">{c.chapter}</span>
                      <span className="shrink-0 font-mono font-bold text-rose-600">{c.missed} marks</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2">{s.verdict}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function QuestionTypeInsights({ insights }: { insights: ResultInsights }) {
  return (
    <div>
      <Heading icon="category" title="Question types" sub="How each type of question went, most marks lost first" />
      <div className="space-y-2">
        {insights.types.map((t) => (
          <Card key={t.key} className="!p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-white">{t.label}</p>
                <p className="text-[11px] text-slate-500">
                  {t.total} Q · {t.correct} right · {t.incorrect} wrong · {t.skipped} skipped
                  {t.attempted < 3 ? " · few questions, read with care" : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-black font-mono ${t.accuracy >= 80 ? "text-emerald-600" : t.accuracy >= 60 ? "text-amber-600" : "text-rose-600"}`}>{t.accuracy}%</p>
                <p className="text-[10px] text-slate-500">{t.missed} marks left</p>
              </div>
            </div>
            <div className="mt-2">
              <Bar value={t.accuracy} tone={accTone(t.accuracy)} />
            </div>
            {t.incorrect > 0 && <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">💡 {t.tip}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ExamPatternInsights({ insights }: { insights: ResultInsights }) {
  const p = insights.pattern;
  const qList = (qs: { questionNumber: number }[]) => (qs.length ? `Q${qs.map((q) => q.questionNumber).slice(0, 12).join(", Q")}${qs.length > 12 ? "…" : ""}` : "none");
  const tiles: { label: string; value: string; note: string; tone: string }[] = [
    { label: "Negative marks", value: `−${p.negative}`, note: `Score would be ${p.scoreIfNoWrong} with those left blank`, tone: "text-rose-600" },
    { label: "Quick wrong answers", value: String(p.rushedWrong.length), note: qList(p.rushedWrong), tone: "text-amber-600" },
    { label: "Easy questions missed", value: String(p.easyWrong.length + p.easySkipped.length), note: qList([...p.easyWrong, ...p.easySkipped]), tone: "text-rose-600" },
    { label: "Very slow questions", value: String(p.slow.length), note: `${p.slowWrong.length} of them still wrong · avg ${fmtTime(p.avgTimeSec)}/Q`, tone: "text-slate-900 dark:text-white" },
  ];
  return (
    <div className="space-y-4">
      <Heading icon="insights" title="Exam pattern" sub="How you played the paper — guessing, time and easy marks" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Card key={t.label} className="!p-3">
            <p className="text-[11px] font-bold text-slate-500">{t.label}</p>
            <p className={`text-2xl font-black font-mono ${t.tone}`}>{t.value}</p>
            <p className="text-[10px] text-slate-500 leading-snug break-words">{t.note}</p>
          </Card>
        ))}
      </div>
      {p.byDifficulty.length > 0 && (
        <Card>
          <p className="text-xs font-black text-slate-700 dark:text-slate-200 mb-2">By difficulty</p>
          <div className="space-y-2.5">
            {p.byDifficulty.map((d) => (
              <div key={d.key}>
                <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 mb-1">
                  <span className="font-bold capitalize">{d.key.toLowerCase()}</span>
                  <span>
                    {d.correct}/{d.total} right · {d.accuracy}% accuracy · {d.skipped} skipped
                  </span>
                </div>
                <Bar value={d.accuracy} tone={accTone(d.accuracy)} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function NcertRevisionPlan({ ncertPlan, insights, storageKey }: { ncertPlan: NcertRecommendation[]; insights: ResultInsights; storageKey: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(storageKey) || "{}"));
    } catch {}
  }, [storageKey]);
  const toggle = (k: string) =>
    setDone((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });

  // One entry per chapter (most marks lost first) with its topics and pages.
  const byChapter = insights.chapters
    .filter((c) => c.missed > 0)
    .map((c) => ({
      ...c,
      refs: ncertPlan.filter((n) => n.chapter === c.chapter && n.subject === c.subject),
    }));
  if (byChapter.length === 0) {
    return <Card className="text-center text-sm text-slate-500">Nothing to revise from this test — every question was right. 🎉</Card>;
  }
  const doneCount = byChapter.filter((c) => done[c.key]).length;
  return (
    <div>
      <Heading icon="menu_book" title="NCERT revision" sub={`Read these, most marks first · ${doneCount}/${byChapter.length} done`} />
      <div className="space-y-2">
        {byChapter.map((c) => {
          const pages = c.refs.filter((r) => r.ncertReference.isMapped);
          const reads = c.incorrect + c.skipped >= 3 ? "Read twice + 10 questions" : "Read once + 5 questions";
          return (
            <Card key={c.key} className={`!p-3 ${done[c.key] ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${done[c.key] ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 dark:border-slate-600"}`}
                  aria-label="Mark revised"
                >
                  {done[c.key] && <span className="material-symbols-outlined text-[16px]">check</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`font-bold text-sm text-slate-900 dark:text-white ${done[c.key] ? "line-through" : ""}`}>
                      {c.chapter} <span className="text-slate-400 font-medium">· {c.subject}</span>
                    </p>
                    <span className="shrink-0 text-[11px] font-mono font-bold text-rose-600">{c.missed} marks</span>
                  </div>
                  {c.topics.length > 0 && <p className="text-[11px] text-slate-600 dark:text-slate-300">Topics: {c.topics.slice(0, 4).join(", ")}</p>}
                  {pages.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      NCERT:{" "}
                      {pages
                        .map((r) => [r.ncertReference.book, r.ncertReference.pageNumber && `p. ${r.ncertReference.pageNumber}`, r.ncertReference.sectionHeading].filter(Boolean).join(" · "))
                        .join(" | ")}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    {reads} · from Q{c.questionNumbers.join(", Q")}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function ImprovementPlanView({ insights }: { insights: ResultInsights }) {
  const steps = buildImprovementPlan(insights);
  const total = steps.reduce((s, x) => s + x.minutes, 0);
  return (
    <div>
      <Heading icon="rocket_launch" title="Improvement plan" sub={`Made from this test · about ${Math.round(total / 6) / 10} hours in all`} />
      <ol className="relative space-y-3 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-700">
        {steps.map((s, i) => (
          <li key={i} className="relative flex gap-3">
            <span className="relative z-10 w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[17px]">{s.icon}</span>
            </span>
            <Card className="!p-3 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{s.when}</span>
                <span className="text-[10px] text-slate-500">{s.minutes} min</span>
              </div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">{s.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{s.detail}</p>
            </Card>
          </li>
        ))}
      </ol>
      <Link href="/mistakes" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white underline">
        Open Mistake Book
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
      </Link>
    </div>
  );
}
