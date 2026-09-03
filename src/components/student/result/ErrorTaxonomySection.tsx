"use client";

import React from "react";
import { ErrorTaxonomyStat, LosingMarkArea } from "@/lib/test-engine/analysis-engine";

export function ErrorTaxonomySection({
  errorBreakdown,
  losingMarkAreas,
}: {
  errorBreakdown: ErrorTaxonomyStat[];
  losingMarkAreas: LosingMarkArea[];
}) {
  const getErrorIcon = (cat: string) => {
    switch (cat) {
      case "CONCEPTUAL_ERROR":
        return { icon: "psychology", color: "text-blue-500 bg-blue-50 dark:bg-blue-950/60" };
      case "DEEP_CONCEPT_ERROR":
        return { icon: "hub", color: "text-purple-500 bg-purple-50 dark:bg-purple-950/60" };
      case "STATEMENT_MISINTERPRETATION":
        return { icon: "menu_book", color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60" };
      case "CALCULATION_ERROR":
        return { icon: "calculate", color: "text-amber-500 bg-amber-50 dark:bg-amber-950/60" };
      case "SILLY_MISTAKE":
        return { icon: "bolt", color: "text-orange-500 bg-orange-50 dark:bg-orange-950/60" };
      default:
        return { icon: "help", color: "text-slate-500 bg-slate-50 dark:bg-slate-800" };
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. "Where You Are Losing Marks" Impact Header */}
      {losingMarkAreas.length > 0 && (
        <div className="bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent p-6 rounded-3xl border border-red-200/60 dark:border-red-900/40 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-lg">trending_down</span>
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Where You Are Losing Marks
              </h3>
              <p className="text-xs text-slate-500">
                Highest-impact improvement opportunities ranked by negative mark impact
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {losingMarkAreas.slice(0, 6).map((area, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Opportunity #{idx + 1}
                  </span>
                  <span className="text-xs font-mono font-bold text-red-500">
                    ~{area.marksLost} marks impact
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                  {area.area}
                </h4>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {area.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Structured Error Taxonomy Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">bug_report</span>
              <span>Evidence-Based Error Taxonomy</span>
            </h3>
            <p className="text-xs text-slate-500">
              Categorized pattern diagnosis based on question complexity, format, and time spent
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {errorBreakdown.map((err) => {
            const iconObj = getErrorIcon(err.category);
            return (
              <div
                key={err.category}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${iconObj.color}`}>
                      <span className="material-symbols-outlined text-sm">{iconObj.icon}</span>
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {err.label}
                    </h4>
                  </div>
                  <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                    {err.count}
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-snug">
                  {err.description}
                </p>

                {err.percentageOfErrors > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-400">
                      <span>Share of Mistakes</span>
                      <span>{err.percentageOfErrors}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${err.percentageOfErrors}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
