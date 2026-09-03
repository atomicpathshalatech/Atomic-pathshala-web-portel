"use client";

import React, { useState } from "react";
import { QuestionReviewItem } from "@/lib/test-engine/analysis-engine";
import { FormulaText } from "@/components/test-portal/FormulaText";

export function QuestionReviewSection({
  questions,
}: {
  questions: QuestionReviewItem[];
}) {
  const [filter, setFilter] = useState<"ALL" | "CORRECT" | "INCORRECT" | "UNATTEMPTED">("ALL");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [lang, setLang] = useState<"EN" | "HI">("EN");

  const subjects = Array.from(new Set(questions.map((q) => q.subject)));

  const filteredQuestions = questions.filter((q) => {
    if (filter === "CORRECT" && q.isCorrect !== true) return false;
    if (filter === "INCORRECT" && q.isCorrect !== false) return false;
    if (filter === "UNATTEMPTED" && q.isAnswered) return false;
    if (subjectFilter !== "ALL" && q.subject !== subjectFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">fact_check</span>
            <span>Question-by-Question Solution &amp; Review</span>
          </h3>
          <p className="text-xs text-slate-500">
            Full explanation, formula derivations, and step-by-step concepts
          </p>
        </div>

        {/* Language & Subject Filters */}
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

          {/* Status Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Status ({questions.length})</option>
            <option value="CORRECT">Correct ({questions.filter((q) => q.isCorrect === true).length})</option>
            <option value="INCORRECT">Incorrect ({questions.filter((q) => q.isCorrect === false).length})</option>
            <option value="UNATTEMPTED">Unattempted ({questions.filter((q) => !q.isAnswered).length})</option>
          </select>

          {/* Subject Filter */}
          {subjects.length > 1 && (
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Question Cards List */}
      <div className="space-y-6">
        {filteredQuestions.map((q) => {
          const statement = lang === "HI" && q.statementHi ? q.statementHi : q.statementEn;
          const options = lang === "HI" && q.optionsHi && Object.keys(q.optionsHi).length > 0 ? q.optionsHi : q.optionsEn;
          const solution = lang === "HI" && q.solutionHi ? q.solutionHi : q.solutionEn;

          return (
            <div
              key={q.questionId}
              className={`p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border shadow-sm space-y-5 transition ${
                q.isCorrect === true
                  ? "border-emerald-200 dark:border-emerald-950/80"
                  : q.isCorrect === false
                  ? "border-red-200 dark:border-red-950/80"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {/* Question Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-mono font-black text-xs flex items-center justify-center">
                    Q{q.questionNumber}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold font-mono">
                    {q.subject}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {q.chapter} &middot; {q.topic}
                  </span>
                </div>

                {/* Score & Status Badge */}
                <div className="flex items-center gap-2">
                  {q.isCorrect === true ? (
                    <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1 font-mono">
                      <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                      <span>+{q.marksObtained} Marks (Correct)</span>
                    </span>
                  ) : q.isCorrect === false ? (
                    <span className="px-3 py-1 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs font-bold flex items-center gap-1 font-mono">
                      <span className="material-symbols-outlined text-sm text-red-500">cancel</span>
                      <span>{q.marksObtained} Marks (Incorrect)</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold flex items-center gap-1 font-mono">
                      <span className="material-symbols-outlined text-sm text-slate-400">help_outline</span>
                      <span>0 Marks (Unattempted)</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Statement */}
              <div>
                <FormulaText
                  text={statement}
                  className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed block"
                />
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {["A", "B", "C", "D"].map((key) => {
                  const optVal = options[key];
                  if (!optVal && optVal !== "") return null;

                  const isUserPick = q.userSelectedOptions.includes(key);
                  const isCorrectPick = q.correctOptions.includes(key);

                  let cardStyle = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300";
                  let badgeStyle = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";

                  if (isCorrectPick) {
                    cardStyle = "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold ring-1 ring-emerald-500/20";
                    badgeStyle = "bg-emerald-600 text-white";
                  } else if (isUserPick && !isCorrectPick) {
                    cardStyle = "bg-red-50/80 dark:bg-red-950/40 border-red-500 text-red-950 dark:text-red-100 font-bold ring-1 ring-red-500/20";
                    badgeStyle = "bg-red-600 text-white";
                  }

                  return (
                    <div
                      key={key}
                      className={`p-3.5 rounded-2xl border text-xs flex items-center gap-3 transition ${cardStyle}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${badgeStyle}`}
                      >
                        {key}
                      </span>
                      <div className="flex-1 min-w-0">
                        <FormulaText text={optVal} className="block" />
                      </div>
                      {isCorrectPick && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0 font-mono">
                          ✓ Correct
                        </span>
                      )}
                      {isUserPick && !isCorrectPick && (
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 shrink-0 font-mono">
                          ✗ Your Pick
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Solution & Explanation Box */}
              {solution && (
                <div className="p-5 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider font-mono text-[11px]">
                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                    <span>Step-by-Step Solution &amp; Conceptual Analysis</span>
                  </div>
                  <FormulaText
                    text={solution}
                    className="text-slate-800 dark:text-slate-200 leading-relaxed block"
                  />
                </div>
              )}

              {/* Recommended Action */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-sm text-amber-500">psychology</span>
                  <span>{q.recommendedAction}</span>
                </span>
                {q.timeTakenSec > 0 && (
                  <span className="font-mono text-slate-400">
                    Time spent: {q.timeTakenSec}s
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
