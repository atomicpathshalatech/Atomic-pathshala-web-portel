"use client";

import React from "react";
import { QuestionTypeStat } from "@/lib/test-engine/analysis-engine";

export function QuestionTypeAnalysisSection({
  questionTypes,
}: {
  questionTypes: QuestionTypeStat[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">category</span>
            <span>Question-Type Format Analysis</span>
          </h3>
          <p className="text-xs text-slate-500">
            Error Rate formula: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">(Incorrect / Attempted) × 100</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {questionTypes.map((qt) => {
          const isHighError = qt.errorRate >= 40 && qt.attempted > 0;
          return (
            <div
              key={qt.type}
              className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition-all ${
                isHighError
                  ? "border-amber-300 dark:border-amber-900/60 shadow-sm"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {qt.label}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {qt.totalQuestions} Total Questions
                  </span>
                </div>

                {qt.sampleStatus === "LIMITED_DATA" ? (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                    Limited Data
                  </span>
                ) : isHighError ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                    High Error Rate
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                    Stable Accuracy
                  </span>
                )}
              </div>

              {/* Progress & Error Rate */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">Error Rate</span>
                  <span
                    className={`font-mono font-black ${
                      qt.errorRate >= 40
                        ? "text-red-600 dark:text-red-400"
                        : qt.errorRate >= 20
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {qt.errorRate}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Attempted</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {qt.attempted}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">Correct</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {qt.correct}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-red-500 block font-medium">Incorrect</span>
                    <span className="font-bold text-red-500 font-mono">
                      {qt.incorrect}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Accuracy: <b className="text-slate-700 dark:text-slate-200">{qt.accuracy}%</b></span>
                  <span>Unattempted: <b className="text-slate-700 dark:text-slate-200">{qt.unattempted}</b></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
