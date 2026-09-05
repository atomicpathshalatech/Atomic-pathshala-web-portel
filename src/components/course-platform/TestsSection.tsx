"use client";

import React from "react";
import Link from "next/link";
import { TestPdfDownloadModal } from "@/components/test-portal/TestPdfDownloadModal";

export function TestsSection({ course }: { course?: any }) {
  const tests = course?.tests || [];

  return (
    <section id="tests" className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-black text-[#031635] flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600">quiz</span>
            <span>Batch Tests &amp; Assessments</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Standardized test papers and assessment series for this batch.
          </p>
        </div>

        {tests.length > 0 && (
          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full self-start sm:self-auto">
            {tests.length} Test{tests.length === 1 ? "" : "s"} Available
          </span>
        )}
      </div>

      {tests.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 text-center text-slate-500 text-xs">
          Mock tests and chapter practice papers will be published as the batch progresses.
        </div>
      ) : (
        <div className="space-y-2.5">
          {tests.map((test: any) => (
            <div
              key={test.id}
              className="p-3.5 sm:px-4 sm:py-3 rounded-xl bg-white border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 hover:shadow-2xs transition"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
                    Assessment
                  </span>
                  <h3 className="font-bold text-xs sm:text-sm text-[#031635] truncate">{test.title || test.name}</h3>
                </div>
                <p className="text-[11px] text-slate-500">
                  {test.durationMins || test.durationMin || 180} Mins &middot; {test.totalMarks || 720} Marks
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <TestPdfDownloadModal
                  testId={test.id}
                  testName={test.title || test.name}
                  triggerButton={
                    <button
                      type="button"
                      title="Download Test PDF"
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-indigo-600">picture_as_pdf</span>
                      <span>Download PDF</span>
                    </button>
                  }
                />

                <Link
                  href={`/tests/${test.id}/attempt`}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-2xs transition text-center self-start sm:self-auto shrink-0"
                >
                  Attempt Test
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
