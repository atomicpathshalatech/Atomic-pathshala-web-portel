"use client";

import React from "react";
import { SubjectStat } from "@/lib/test-engine/analysis-engine";

export function SubjectAnalysisSection({
  subjects,
}: {
  subjects: SubjectStat[];
}) {
  const getSubjectColorTheme = (name: string) => {
    const low = name.toLowerCase();
    if (low.includes("bio") || low.includes("botany") || low.includes("zoology")) {
      return {
        badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        bar: "bg-emerald-500",
        icon: "psychiatry",
      };
    }
    if (low.includes("chem")) {
      return {
        badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        bar: "bg-amber-500",
        icon: "science",
      };
    }
    return {
      badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      bar: "bg-blue-500",
      icon: "bolt",
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">donut_large</span>
            <span>Subject-Wise Performance Breakdown</span>
          </h3>
          <p className="text-xs text-slate-500">
            Granular diagnostics across Biology, Chemistry, and Physics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {subjects.map((sub) => {
          const theme = getSubjectColorTheme(sub.subject);
          return (
            <div
              key={sub.subject}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-5"
            >
              {/* Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold border ${theme.badge}`}>
                      <span className="material-symbols-outlined text-sm">{theme.icon}</span>
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                      {sub.subject}
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {sub.score} / {sub.maxMarks} marks
                  </span>
                </div>

                {/* Accuracy Bar */}
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span>Accuracy</span>
                    <span>{sub.accuracy}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${theme.bar} transition-all duration-500`}
                      style={{ width: `${Math.min(sub.accuracy, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 4-cell Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Questions</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                    {sub.totalQuestions}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Attempted</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">
                    {sub.attempted}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">Correct</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                    {sub.correct}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
                  <span className="text-[10px] text-red-500 block font-medium">Incorrect</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400 font-mono">
                    {sub.incorrect}
                  </span>
                </div>
              </div>

              {/* Strong & Weak Areas */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                {sub.strongAreas.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                      Strong Areas
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {sub.strongAreas.map((area) => (
                        <span
                          key={area}
                          className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium"
                        >
                          ✓ {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {sub.weakAreas.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                      Weak Areas
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {sub.weakAreas.map((area) => (
                        <span
                          key={area}
                          className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-medium"
                        >
                          ⚠ {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {sub.topicsForRevision.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">
                      Topics Requiring Revision
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                      {sub.topicsForRevision.slice(0, 3).join(", ")}
                      {sub.topicsForRevision.length > 3 ? ` +${sub.topicsForRevision.length - 3} more` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
