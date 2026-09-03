"use client";

import React from "react";
import { toast } from "sonner";
import { NcertRecommendation } from "@/lib/test-engine/analysis-engine";

export function NcertRevisionSection({
  ncertPlan,
}: {
  ncertPlan: NcertRecommendation[];
}) {
  const handleAddToRevision = (topic: string) => {
    toast.success(`"${topic}" added to your My Revision Deck!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">menu_book</span>
            <span>Personalized NCERT Revision Plan</span>
          </h3>
          <p className="text-xs text-slate-500">
            Targeted NCERT textbook sections and recommended practice mapped directly to your test errors
          </p>
        </div>
      </div>

      {ncertPlan.length === 0 ? (
        <div className="p-8 rounded-3xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 text-center space-y-2">
          <span className="material-symbols-outlined text-3xl text-emerald-600">verified</span>
          <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-300">
            Exceptional Performance!
          </h4>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            No critical NCERT theory weaknesses detected on this test attempt. Keep up periodic practice!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {ncertPlan.map((plan, idx) => {
            const isHigh = plan.severity === "HIGH";
            const isMed = plan.severity === "MEDIUM";

            return (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold font-mono">
                        {plan.subject}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isHigh
                            ? "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                            : isMed
                            ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                            : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                        }`}
                      >
                        Priority {idx + 1} ({plan.severity} Severity &middot; {plan.errorCount} Error{plan.errorCount > 1 ? "s" : ""})
                      </span>
                    </div>

                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                      {plan.chapter} &rarr; <span className="text-blue-600 dark:text-blue-400">{plan.topic}</span>
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToRevision(plan.topic)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <span className="material-symbols-outlined text-sm text-emerald-600">bookmark_add</span>
                    <span>Add to Revision Deck</span>
                  </button>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {plan.actionText}
                </p>

                {/* NCERT Exact Mapped Reference Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-base text-emerald-600">auto_stories</span>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                        NCERT Section to Revisit
                      </span>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {plan.ncertReference.isMapped ? (
                          <>
                            {plan.ncertReference.chapterName || plan.chapter}
                            {plan.ncertReference.sectionHeading ? ` — Section: ${plan.ncertReference.sectionHeading}` : ""}
                            {plan.ncertReference.pageNumber ? ` (Page ${plan.ncertReference.pageNumber})` : ""}
                          </>
                        ) : (
                          <span className="text-slate-500 italic font-normal">
                            NCERT line/page reference not mapped yet for this question topic.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:text-right text-xs">
                    <span className="text-[10px] text-slate-400 block font-medium">Recommended Frequency</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                      {plan.revisionFrequency}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
