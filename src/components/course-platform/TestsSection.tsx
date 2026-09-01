"use client";

import React from "react";
import Link from "next/link";

export function TestsSection() {
  const tests = [
    {
      id: "mock-01",
      title: "NEET Full Syllabus Mock Test #01",
      type: "Full Syllabus Mock Test",
      questions: 180,
      duration: "180 mins",
      marks: 720,
      startDate: "Available Now",
      status: "AVAILABLE",
      isFree: true,
    },
    {
      id: "part-01",
      title: "Physical Chemistry Unit Test: Mole Concept & Thermodynamics",
      type: "Unit Test",
      questions: 45,
      duration: "45 mins",
      marks: 180,
      startDate: "Available Now",
      status: "AVAILABLE",
      isFree: false,
    },
    {
      id: "mock-02",
      title: "NEET All-India Major Test #02 (Class 11 + 12 Revision)",
      type: "Major Test",
      questions: 180,
      duration: "180 mins",
      marks: 720,
      startDate: "Live on 15 Sept 2026",
      status: "UPCOMING",
      isFree: false,
    },
  ];

  return (
    <section id="tests" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600">quiz</span>
            <span>All-India Mock Test Series</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            21 High-fidelity test papers with All-India Rank, percentile, and step-by-step video analysis.
          </p>
        </div>

        <span className="text-xs font-bold text-[#005231] bg-[#9ff5c1] px-3 py-1 rounded-full self-start sm:self-auto">
          21 Tests Included
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tests.map((test) => (
          <div
            key={test.id}
            className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                  {test.type}
                </span>
                {test.isFree ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#9ff5c1] text-[#005231]">
                    FREE ATTEMPT
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">lock</span>
                    <span>Enrolled Only</span>
                  </span>
                )}
              </div>

              <h3 className="font-extrabold text-xs sm:text-sm text-[#031635] line-clamp-2">
                {test.title}
              </h3>

              {/* Stats Box */}
              <div className="grid grid-cols-3 gap-1 p-2.5 rounded-xl bg-white border border-slate-100 text-center text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Questions</span>
                  <span className="font-bold text-[#031635]">{test.questions}</span>
                </div>
                <div className="border-x border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Duration</span>
                  <span className="font-bold text-[#031635]">{test.duration}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Total Marks</span>
                  <span className="font-bold text-[#031635]">{test.marks}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-200/60">
              {test.isFree ? (
                <Link
                  href={`/tests`}
                  className="w-full py-2.5 rounded-xl bg-[#031635] hover:bg-[#1a2b4b] text-white font-bold text-xs shadow transition text-center flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  <span>Attempt Free Test</span>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-2 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center gap-1 cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">lock</span>
                  <span>Unlock on Enrollment</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}