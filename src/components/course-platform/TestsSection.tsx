"use client";

import React from "react";
import Link from "next/link";

export function TestsSection({ course }: { course?: any }) {
  const tests = course?.tests || [];

  return (
    <section id="tests" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600">quiz</span>
            <span>Batch Tests &amp; Assessments</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Standardized test papers and assessment series for this batch.
          </p>
        </div>

        {tests.length > 0 && (
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full self-start sm:self-auto">
            {tests.length} Test{tests.length === 1 ? "" : "s"} Available
          </span>
        )}
      </div>

      {tests.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500 text-xs">
          Mock tests and chapter practice papers will be published as the batch progresses.
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test: any) => (
            <div
              key={test.id}
              className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-200 transition"
            >
              <div className="space-y-1">
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
                  Assessment
                </span>
                <h3 className="font-bold text-xs sm:text-sm text-[#031635] dark:text-white">{test.title}</h3>
                <p className="text-[11px] text-slate-400">
                  {test.durationMins || 180} Mins &middot; {test.totalMarks || 720} Marks
                </p>
              </div>

              <Link
                href={`/tests/${test.id}/attempt`}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition text-center self-start sm:self-auto shrink-0"
              >
                Attempt Test
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
