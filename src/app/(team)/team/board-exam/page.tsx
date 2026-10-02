"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ExternalLink, Landmark, ListOrdered, Sparkles, Loader2, Play } from "lucide-react";
import {
  BOARDS,
  CLASSES,
  SUBJECTS_BY_CLASS,
  YEARS,
  MODES,
  type BoardClass,
  type BoardLanguage,
  type BoardMode,
  type BoardPaper,
} from "@/lib/ai-chat/boardExam";

const SECTIONS = [
  { name: "Section A", title: "Multiple choice", detail: "Q1 · 4 sub-parts × 1 mark, incl. one assertion–reason", marks: "4", tone: "text-blue-600 dark:text-blue-400" },
  { name: "Section B", title: "Very short answer", detail: "Q2 · 5 sub-parts × 1 mark — definitions, units, principles", marks: "5", tone: "text-amber-600 dark:text-amber-400" },
  { name: "Section C", title: "Short answer I", detail: "Q3 · 4–5 sub-parts × 2 marks — reasoning, short derivations", marks: "8–10", tone: "text-emerald-600 dark:text-emerald-400" },
  { name: "Section D", title: "Short answer II", detail: "Q4–Q6 · 3 marks each — diagram or passage based", marks: "9", tone: "text-violet-600 dark:text-violet-400" },
  { name: "Section E", title: "Long answer", detail: "Q7–Q9 · 5 marks each with an internal OR choice", marks: "15", tone: "text-rose-600 dark:text-rose-400" },
];

type Tab = "boards" | "pattern" | "generate";

export default function AdminBoardExamPage() {
  const [activeTab, setActiveTab] = useState<Tab>("boards");
  const [selectedClass, setSelectedClass] = useState<BoardClass>("12th");
  const [selectedBoard, setSelectedBoard] = useState("CBSE");
  const [selectedSubject, setSelectedSubject] = useState("Physics");
  const [selectedYear, setSelectedYear] = useState("2024");
  const [selectedMode, setSelectedMode] = useState<BoardMode>("pyq");
  const [selectedLang, setSelectedLang] = useState<BoardLanguage>("hindi");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewPaper, setPreviewPaper] = useState<BoardPaper | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleGeneratePreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/ai-chat/board-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: selectedBoard,
          className: selectedClass,
          subject: selectedSubject,
          language: selectedLang,
          mode: selectedMode,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.paper) throw new Error(data.error || "Failed to generate the paper.");
      setPreviewPaper(data.paper);
    } catch (err: any) {
      setPreviewError(err.message || "Failed to generate the paper.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "boards", label: `Boards & subjects`, icon: <Landmark className="w-3.5 h-3.5" /> },
    { key: "pattern", label: "Paper pattern", icon: <ListOrdered className="w-3.5 h-3.5" /> },
    { key: "generate", label: "Generate a paper", icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  const card = "bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl";
  const field =
    "w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Board Exam Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Class 10 &amp; 12 board practice — {BOARDS.length} boards, PYQ and model papers, {YEARS[YEARS.length - 1]?.value}–{YEARS[0]?.value}
          </p>
        </div>
        <Link
          href="/practice/board-exam"
          target="_blank"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Student view
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`-mb-px inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
              activeTab === t.key
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Boards & subjects */}
      {activeTab === "boards" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <section className={`${card} lg:col-span-3 p-4`}>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Boards</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Students can practise papers of every board below.</p>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BOARDS.map((b) => (
                <li key={b.value} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{b.label}</span>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">{b.value}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${card} lg:col-span-2 p-4 space-y-4`}>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Subjects</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Available for each class.</p>
            </div>
            {CLASSES.map((c) => (
              <div key={c.value}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{c.label}</span>
                  <span className="text-[11px] text-slate-400">{SUBJECTS_BY_CLASS[c.value].length} subjects</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SUBJECTS_BY_CLASS[c.value].map((sub) => (
                    <span key={sub} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {/* Paper pattern */}
      {activeTab === "pattern" && (
        <section className={`${card} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Paper pattern used for every generated paper</h2>
            <span className="text-[11px] text-slate-500">70 marks · 3 h 15 min</span>
          </div>
          <ol className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {SECTIONS.map((s) => (
              <li key={s.name} className="py-3 flex items-start gap-3">
                <span className={`w-20 shrink-0 text-xs font-semibold ${s.tone}`}>{s.name}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{s.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{s.detail}</div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{s.marks} M</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 leading-relaxed">
            Papers are written fully in the chosen language (no translated mix-ups), lean on the topics that repeat most in past years, and
            every question comes with a step-by-step marking scheme.
          </div>
        </section>
      )}

      {/* Generate a paper */}
      {activeTab === "generate" && (
        <div className="space-y-4">
          <section className={`${card} p-4 sm:p-5 space-y-4`}>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Generate a paper</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Check exactly what a student will get for these choices.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <label className="block">
                <span className="block text-[11px] font-medium text-slate-500 mb-1">Board</span>
                <select value={selectedBoard} onChange={(e) => setSelectedBoard(e.target.value)} className={field}>
                  {BOARDS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-slate-500 mb-1">Class</span>
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    const c = e.target.value as BoardClass;
                    setSelectedClass(c);
                    setSelectedSubject(SUBJECTS_BY_CLASS[c][0] || "Physics");
                  }}
                  className={field}
                >
                  {CLASSES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-slate-500 mb-1">Subject</span>
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className={field}>
                  {SUBJECTS_BY_CLASS[selectedClass].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-slate-500 mb-1">Mode</span>
                <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value as BoardMode)} className={field}>
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-slate-500 mb-1">Year</span>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={field}>
                  {YEARS.map((y) => (
                    <option key={y.value} value={y.value}>
                      {y.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium text-slate-500 mb-1">Language</span>
                <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value as BoardLanguage)} className={field}>
                  <option value="hindi">Hindi</option>
                  <option value="english">English</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={handleGeneratePreview}
              disabled={loadingPreview}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white shadow-sm transition"
            >
              {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {loadingPreview ? "Generating…" : "Generate paper"}
            </button>

            {previewError && (
              <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">{previewError}</div>
            )}
          </section>

          {previewPaper && (
            <section className={`${card} p-4 sm:p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {previewPaper.subject} · {previewPaper.board}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {previewPaper.totalMarks} marks · {previewPaper.timeAllowed}
                  </p>
                </div>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{previewPaper.questions.length} questions</span>
              </div>

              <div className="mt-3 space-y-3 text-xs">
                {previewPaper.questions.map((q) => (
                  <div key={q.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                    <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                      {q.sectionTitle} · Q{q.questionNumber}
                    </div>
                    {q.subParts.map((sp, idx) => (
                      <div key={idx} className="pl-2.5 border-l-2 border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="text-slate-800 dark:text-slate-100 leading-relaxed">
                          <span className="font-semibold">({sp.label})</span> {sp.text}{" "}
                          <span className="text-slate-400">[{sp.marks}M]</span>
                        </div>
                        {sp.answer && (
                          <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1.5 rounded-lg">
                            <span className="font-semibold">Solution:</span> {sp.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
