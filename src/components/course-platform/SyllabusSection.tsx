"use client";

import React, { useState } from "react";

export function SyllabusSection({ course }: { course?: any }) {
  const subjects = course?.subjects || [];
  const [openSubjectIndex, setOpenSubjectIndex] = useState<number>(0);

  return (
    <section id="syllabus" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600">menu_book</span>
          <span>Syllabus &amp; Chapters</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Structured curriculum and chapter roadmap covered in this batch.
        </p>
      </div>

      {subjects.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500 text-xs">
          Chapter roadmap and syllabus details will be published by faculty soon.
        </div>
      ) : (
        <div className="space-y-4">
          {subjects.map((subj: any, sIdx: number) => {
            const isOpen = openSubjectIndex === sIdx;
            const chapters = subj.chapters || [];

            return (
              <div
                key={subj.id || sIdx}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenSubjectIndex(isOpen ? -1 : sIdx)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      {sIdx + 1}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-[#031635] dark:text-white">{subj.title}</h3>
                      <p className="text-[11px] text-slate-500">{chapters.length} Chapters</p>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-lg transition-transform ${isOpen ? "rotate-180" : ""}`}>
                    keyboard_arrow_down
                  </span>
                </button>

                {isOpen && (
                  <div className="p-4 space-y-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                    {chapters.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2 text-center">No chapters added to this subject yet.</p>
                    ) : (
                      chapters.map((ch: any, cIdx: number) => (
                        <div
                          key={ch.id || cIdx}
                          className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-400">{(cIdx + 1).toString().padStart(2, "0")}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{ch.title}</span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {ch._count?.lectures || ch.lecturesCount || 0} Lectures
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
