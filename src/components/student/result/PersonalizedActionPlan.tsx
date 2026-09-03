"use client";

import React from "react";
import { ActionPlanItem } from "@/lib/test-engine/analysis-engine";

export function PersonalizedActionPlan({
  actionPlan,
}: {
  actionPlan: ActionPlanItem[];
}) {
  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case "NCERT_READ":
        return { icon: "menu_book", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60" };
      case "PRACTICE":
        return { icon: "edit_document", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/60" };
      case "FORMULA_REVISION":
        return { icon: "functions", color: "text-purple-600 bg-purple-50 dark:bg-purple-950/60" };
      case "RE_TEST":
        return { icon: "schedule", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/60" };
      default:
        return { icon: "check_circle", color: "text-slate-600 bg-slate-50 dark:bg-slate-800" };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600">rocket_launch</span>
            <span>Personalized Next-Steps Action Plan</span>
          </h3>
          <p className="text-xs text-slate-500">
            Scientifically spaced revision timeline to turn weak test concepts into strengths
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionPlan.map((item, idx) => {
          const iconObj = getActionTypeIcon(item.actionType);
          return (
            <div
              key={idx}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                    {item.timeframeLabel}
                  </span>
                  {item.durationMin && (
                    <span className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">timer</span>
                      <span>{item.durationMin} mins</span>
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <span className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold shrink-0 ${iconObj.color}`}>
                    <span className="material-symbols-outlined text-base">{iconObj.icon}</span>
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-snug">
                      {item.details}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
