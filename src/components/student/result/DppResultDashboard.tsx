"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { FullTestAnalysisResult, QuestionReviewItem } from "@/lib/test-engine/analysis-engine";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { CamDrawRenderer } from "@/components/camdraw/CamDrawRenderer";

export function DppResultDashboard({
  analysis,
}: {
  analysis: FullTestAnalysisResult;
}) {
  const [filter, setFilter] = useState<"ALL" | "INCORRECT" | "UNATTEMPTED" | "CORRECT">("ALL");
  const [lang, setLang] = useState<"EN" | "HI">("EN");

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const questions: QuestionReviewItem[] = analysis.questionReviews ?? [];

  // Difficulty level stats
  const difficultyStats = useMemo(() => {
    const map: Record<string, { total: number; correct: number; incorrect: number; unattempted: number }> = {
      EASY: { total: 0, correct: 0, incorrect: 0, unattempted: 0 },
      MEDIUM: { total: 0, correct: 0, incorrect: 0, unattempted: 0 },
      HARD: { total: 0, correct: 0, incorrect: 0, unattempted: 0 },
    };

    questions.forEach((q) => {
      const diff = (q.difficulty || "MEDIUM").toUpperCase();
      if (!map[diff]) map[diff] = { total: 0, correct: 0, incorrect: 0, unattempted: 0 };
      map[diff].total++;
      if (q.isCorrect === true) map[diff].correct++;
      else if (q.isCorrect === false) map[diff].incorrect++;
      else map[diff].unattempted++;
    });

    return Object.entries(map).filter(([, stat]) => stat.total > 0);
  }, [questions]);

  // Topic wise stats
  const topicStats = useMemo(() => {
    const map = new Map<string, { topic: string; chapter: string; total: number; correct: number; incorrect: number; unattempted: number }>();

    questions.forEach((q) => {
      const topicName = q.topic || q.chapter || "General Practice";
      const existing = map.get(topicName) || {
        topic: topicName,
        chapter: q.chapter || "General",
        total: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
      };
      existing.total++;
      if (q.isCorrect === true) existing.correct++;
      else if (q.isCorrect === false) existing.incorrect++;
      else existing.unattempted++;
      map.set(topicName, existing);
    });

    return Array.from(map.values());
  }, [questions]);

  // Improvement Areas (Topics with mistakes)
  const weakTopics = topicStats.filter((t) => t.incorrect > 0);

  // Filtered Questions for Review
  const filteredQuestions = questions.filter((q) => {
    if (filter === "CORRECT") return q.isCorrect === true;
    if (filter === "INCORRECT") return q.isCorrect === false;
    if (filter === "UNATTEMPTED") return !q.isAnswered;
    return true;
  });

  const dppPdfUrl = analysis.dppId ? `/api/team/dpp/${analysis.dppId}/pdf` : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-4 sm:px-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <Link href="/dpp" className="hover:text-blue-600 transition font-bold text-slate-600 dark:text-slate-400">
            Daily Practice Problems (DPP)
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs">
            {analysis.testName}
          </span>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
            Practice Review
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {dppPdfUrl && (
            <a
              href={dppPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
              <span>Download PDF</span>
            </a>
          )}

          <Link
            href="/dpp"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Back to DPPs</span>
          </Link>
        </div>
      </div>

      {/* Main Scorecard Banner (Clean, No Ranks or AIR) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                DAILY PRACTICE PROBLEM
              </span>
              <span className="text-xs text-slate-400">
                · Submitted on {new Date(analysis.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {analysis.testName}
            </h1>
            <p className="text-xs text-slate-500">
              Practice analysis focuses on learning accuracy, topic mastery, and resolving mistakes.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Your Score</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl font-black text-slate-900 dark:text-white font-mono">{analysis.score}</span>
                <span className="text-sm font-bold text-slate-400">/ {analysis.maxMarks}</span>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Accuracy</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {analysis.accuracy}%
              </p>
            </div>
            <div className="h-10 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Time Spent</p>
              <p className="text-base font-black text-slate-700 dark:text-slate-300 font-mono mt-1">
                {formatTime(analysis.timeTakenSec)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Counter Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Questions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Questions</span>
            <span className="material-symbols-outlined text-base text-slate-400">quiz</span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-200 font-mono">
            {analysis.totalQuestions}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Practice Sheet</span>
        </div>

        {/* Correct */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-950/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Correct</span>
            <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {analysis.correct}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">+{analysis.correct * 4} marks</span>
        </div>

        {/* Incorrect */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-950/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Incorrect (Galat)</span>
            <span className="material-symbols-outlined text-base text-red-500">cancel</span>
          </div>
          <div className="mt-2 text-2xl font-black text-red-500 font-mono">
            {analysis.incorrect}
          </div>
          <span className="text-[10px] text-red-500 font-medium">
            {analysis.incorrect > 0 ? `-${analysis.incorrect * 1} negative marks` : "Zero mistakes! 🎉"}
          </span>
        </div>

        {/* Unattempted */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Unattempted (Chhute)</span>
            <span className="material-symbols-outlined text-base text-slate-400">help_outline</span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-700 dark:text-slate-300 font-mono">
            {analysis.unattempted}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Skipped questions</span>
        </div>
      </div>

      {/* Grid: Level and Topic Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Difficulty Level Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-lg">tune</span>
            <span>Question Difficulty Levels</span>
          </h3>

          <div className="space-y-3">
            {difficultyStats.map(([level, stat]) => {
              const acc = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
              const colorCls =
                level === "EASY"
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : level === "MEDIUM"
                  ? "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                  : "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";

              return (
                <div key={level} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase border ${colorCls}`}>
                      {level}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {stat.total} Questions
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {stat.correct} Correct · {stat.incorrect} Wrong
                    </span>
                    <span className="text-[11px] text-slate-400 block font-mono">
                      {acc}% accuracy
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Topics Covered & Performance */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 text-lg">topic</span>
            <span>Topics Tested in this DPP</span>
          </h3>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {topicStats.map((t) => {
              const acc = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
              const isMastered = acc >= 75;

              return (
                <div key={t.topic} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {t.topic}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {t.total} Qs · {t.correct} Correct, {t.incorrect} Wrong
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                      isMastered
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {isMastered ? "Mastered" : "Needs Revision"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Improvement Area / Mistakes Section */}
      {weakTopics.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/60 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-xl">auto_fix_high</span>
            <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-300">
              Improvement Areas (Sudhar ke Kshetra)
            </h3>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
            Aapne in topics mein galatiyan ki hain. Next lecture ya test se pehle inke concepts aur solutions ko review karein:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {weakTopics.map((w) => (
              <div key={w.topic} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-900/50 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{w.topic}</span>
                <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 shrink-0">
                  {w.incorrect} mistake{w.incorrect > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question Review Section (All Solutions & Explanations) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6">
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-xl">fact_check</span>
              <span>Questions Review &amp; Step-by-Step Solutions</span>
            </h3>
            <p className="text-xs text-slate-500">
              Galat huye questions ke correct answers aur unke explanations ko dekhein
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Language Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setLang("EN")}
                className={`px-3 py-1 rounded-lg transition ${
                  lang === "EN" ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang("HI")}
                className={`px-3 py-1 rounded-lg transition ${
                  lang === "HI" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-slate-500"
                }`}
              >
                हिंदी
              </button>
            </div>

            {/* Filter Pill Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg transition ${filter === "ALL" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-bold" : "text-slate-600 dark:text-slate-400"}`}
              >
                All ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("INCORRECT")}
                className={`px-2.5 py-1 rounded-lg transition ${filter === "INCORRECT" ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold shadow-sm" : "text-slate-600 dark:text-slate-400"}`}
              >
                Incorrect ({analysis.incorrect})
              </button>
              <button
                type="button"
                onClick={() => setFilter("UNATTEMPTED")}
                className={`px-2.5 py-1 rounded-lg transition ${filter === "UNATTEMPTED" ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-bold" : "text-slate-600 dark:text-slate-400"}`}
              >
                Unattempted ({analysis.unattempted})
              </button>
              <button
                type="button"
                onClick={() => setFilter("CORRECT")}
                className={`px-2.5 py-1 rounded-lg transition ${filter === "CORRECT" ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm" : "text-slate-600 dark:text-slate-400"}`}
              >
                Correct ({analysis.correct})
              </button>
            </div>
          </div>
        </div>

        {/* Questions Cards List */}
        <div className="space-y-6">
          {filteredQuestions.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              No questions found for this filter.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const statement = lang === "HI" && q.statementHi ? q.statementHi : q.statementEn;
              const options = lang === "HI" && q.optionsHi && Object.keys(q.optionsHi).length > 0 ? q.optionsHi : q.optionsEn;
              const solution = lang === "HI" && q.solutionHi ? q.solutionHi : q.solutionEn;

              const isCorrect = q.isCorrect === true;
              const isIncorrect = q.isCorrect === false;
              const isUnattempted = !q.isAnswered;

              return (
                <div
                  key={q.questionId}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 ${
                    isCorrect
                      ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10"
                      : isIncorrect
                      ? "border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-7 h-7 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black text-xs flex items-center justify-center font-mono">
                        Q{q.questionNumber}
                      </span>

                      {q.difficulty && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {q.difficulty}
                        </span>
                      )}

                      {q.topic && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                          {q.topic}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isCorrect && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          Correct (+{q.maxMarks || 4})
                        </span>
                      )}
                      {isIncorrect && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          Incorrect (-{q.negativeMarks || 1})
                        </span>
                      )}
                      {isUnattempted && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">help_outline</span>
                          Unattempted (0)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Statement */}
                  <div className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                    <FormulaText text={statement} />
                  </div>

                  {/* Image or CamDraw Diagram */}
                  {q.imageUrl && (
                    <div className="my-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={q.imageUrl}
                        alt="Question Figure"
                        className="max-h-64 rounded-xl border border-slate-200 dark:border-slate-800 object-contain bg-white"
                      />
                    </div>
                  )}
                  {q.camDrawData && (
                    <div className="my-2">
                      <CamDrawRenderer document={q.camDrawData} />
                    </div>
                  )}

                  {/* Options List */}
                  {options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {["A", "B", "C", "D"].map((optKey) => {
                        const optVal = options[optKey];
                        if (!optVal) return null;

                        const isUserChoice = q.userSelectedOptions?.includes(optKey);
                        const isCorrectOpt = q.correctOptions?.includes(optKey);

                        let borderBg = "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-800 dark:text-slate-200";
                        if (isCorrectOpt) {
                          borderBg = "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold ring-1 ring-emerald-500";
                        } else if (isUserChoice && !isCorrectOpt) {
                          borderBg = "border-red-500 bg-red-50/80 dark:bg-red-950/60 text-red-900 dark:text-red-200 font-semibold ring-1 ring-red-500";
                        }

                        return (
                          <div
                            key={optKey}
                            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition ${borderBg}`}
                          >
                            <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center shrink-0 font-mono">
                              {optKey}
                            </span>
                            <div className="flex-1 min-w-0">
                              <FormulaText text={optVal} />
                            </div>
                            {isCorrectOpt && (
                              <span className="text-[10px] font-extrabold uppercase text-emerald-700 dark:text-emerald-400 shrink-0">
                                Correct Answer ✓
                              </span>
                            )}
                            {isUserChoice && !isCorrectOpt && (
                              <span className="text-[10px] font-extrabold uppercase text-red-600 dark:text-red-400 shrink-0">
                                Your Choice ✗
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Solution / Explanation */}
                  {solution && (
                    <div className="mt-3 p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold">
                        <span className="material-symbols-outlined text-base">lightbulb</span>
                        <span>Step-by-Step Solution &amp; Explanation:</span>
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                        <FormulaText text={solution} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
