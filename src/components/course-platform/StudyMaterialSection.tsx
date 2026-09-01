"use client";

import React from "react";

export function StudyMaterialSection() {
  const materials = [
    {
      title: "Chemical Bonding Master Class Notes",
      chapter: "Chemical Bonding",
      type: "PDF Document",
      size: "4.2 MB",
      pages: "28 Pages",
      isSample: true,
    },
    {
      title: "Daily Practice Problem (DPP #01) — Mole Concept",
      chapter: "Some Basic Concepts",
      type: "DPP Worksheet",
      size: "1.8 MB",
      pages: "15 Problems + Key",
      isSample: true,
    },
    {
      title: "Thermodynamics Comprehensive Formula Sheet",
      chapter: "Thermodynamics",
      type: "Formula Sheet",
      size: "2.4 MB",
      pages: "8 Pages",
      isSample: false,
    },
    {
      title: "NEET Past 15-Year Topicwise Solved PYQs (Chemistry)",
      chapter: "Entire Syllabus",
      type: "PYQ Archive",
      size: "14.5 MB",
      pages: "140 Pages",
      isSample: false,
    },
  ];

  return (
    <section id="material" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">folder_open</span>
            <span>Study Material & Digital Notes</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Printable handwritten notes, formula cheat-sheets, and categorized DPPs.
          </p>
        </div>

        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
          50+ High-Yield PDFs
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {materials.map((mat) => (
          <div
            key={mat.title}
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3 hover:border-slate-300 transition"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">description</span>
              </div>

              <div>
                <h4 className="font-bold text-xs sm:text-sm text-[#031635] line-clamp-1">{mat.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{mat.chapter}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                  <span>{mat.type}</span>
                  <span>•</span>
                  <span>{mat.size}</span>
                  <span>•</span>
                  <span>{mat.pages}</span>
                </div>
              </div>
            </div>

            {mat.isSample ? (
              <button
                type="button"
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Sample</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold shrink-0">
                <span className="material-symbols-outlined text-sm">lock</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}