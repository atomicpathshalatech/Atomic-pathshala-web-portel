"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils/date";
import { TestPdfDownloadModal } from "@/components/test-portal/TestPdfDownloadModal";

export function TestsSection({ course }: { course?: any }) {
  const [filter, setFilter] = useState<"ALL" | "PRESENT" | "UPCOMING" | "PAST">("ALL");
  const tests: any[] = course?.tests || [];

  const filteredTests = tests.filter((t: any) => {
    if (filter === "ALL") return true;
    return t.timingState === filter;
  });

  return (
    <section id="tests" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-[#031635] flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">quiz</span>
            <span>Batch Tests &amp; Assessments</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Minor, Major, Mock tests and practice assessments for this batch.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold self-start sm:self-auto">
          {(
            [
              { id: "ALL", label: `All (${tests.length})` },
              { id: "PRESENT", label: "Live / Today" },
              { id: "UPCOMING", label: "Upcoming" },
              { id: "PAST", label: "Completed" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === tab.id
                  ? "bg-white text-blue-600 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredTests.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 text-center text-slate-500 text-xs">
          No {filter !== "ALL" ? filter.toLowerCase() : ""} tests found for this batch right now.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTests.map((test: any) => (
            <div
              key={test.id}
              className="p-4 rounded-2xl bg-white border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 hover:shadow-2xs transition"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                    Assessment
                  </span>

                  {test.timingState === "PRESENT" && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold animate-pulse">
                      Live Now
                    </span>
                  )}
                  {test.timingState === "UPCOMING" && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Upcoming
                    </span>
                  )}
                  {test.timingState === "PAST" && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                      {test.isSubmitted ? "Submitted" : "Concluded"}
                    </span>
                  )}

                  {test.testSeriesName && (
                    <span className="text-[11px] font-bold text-slate-500 truncate">
                      • {test.testSeriesName}
                    </span>
                  )}
                </div>

                <Link
                  href={test.isSubmitted ? `/tests/${test.id}/result` : `/tests/${test.id}/attempt`}
                  className="font-bold text-xs sm:text-sm text-[#031635] hover:text-blue-600 transition block truncate"
                >
                  {test.title || test.name}
                </Link>

                <p className="text-[11px] text-slate-500">
                  {test.openTime ? `${formatDateTime(test.openTime)} • ` : ""}
                  {test.durationMins || test.durationMin || 180} Mins &middot; {test.totalMarks || 720} Marks
                  {test.isSubmitted && test.score !== null ? ` • Score: ${test.score} / 720` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                <a
                  href={`/api/tests/${test.id}/syllabus-pdf?download=true`}
                  target="_blank"
                  rel="noreferrer"
                  title="Download Syllabus PDF"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">description</span>
                  <span>Syllabus</span>
                </a>

                {(test.isSubmitted || test.timingState === "PAST" || test.isCompleted || test.status === "COMPLETED") && (
                  <TestPdfDownloadModal
                    testId={test.id}
                    testName={test.title || test.name}
                    triggerButton={
                      <button
                        type="button"
                        title="Download Test PDF"
                        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px] text-blue-600">picture_as_pdf</span>
                        <span>PDF</span>
                      </button>
                    }
                  />
                )}

                <Link
                  href={test.isSubmitted ? `/tests/${test.id}/result` : `/tests/${test.id}/attempt`}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 ${
                    test.isSubmitted
                      ? "bg-slate-800 hover:bg-slate-900 text-white"
                      : test.timingState === "PRESENT"
                      ? "bg-violet-600 hover:bg-violet-700 text-white animate-pulse"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  }`}
                >
                  {test.isSubmitted
                    ? "View Result"
                    : test.timingState === "PRESENT"
                    ? "Start Test Now"
                    : "Attempt Test"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
