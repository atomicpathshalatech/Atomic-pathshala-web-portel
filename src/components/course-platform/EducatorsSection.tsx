"use client";

import React from "react";
import Link from "next/link";

export function EducatorsSection({ course }: { course?: any }) {
  const teachers = course?.teachers || [];

  return (
    <section id="educators" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-600">psychology</span>
          <span>Batch Educators</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Expert faculty assigned to lead this batch.
        </p>
      </div>

      {teachers.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500 text-xs">
          Educators for this batch will be announced by the academic team soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teachers.map((edu: any) => (
            <div
              key={edu.id || edu.name}
              className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 transition flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  {edu.photoUrl || edu.imageUrl ? (
                    <img
                      src={edu.photoUrl || edu.imageUrl}
                      alt={edu.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg border border-primary/20">
                      {edu.name ? edu.name.charAt(0) : "T"}
                    </div>
                  )}
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-[#031635] dark:text-white">{edu.name}</h3>
                    <p className="text-xs text-[#6b46c1] dark:text-purple-400 font-bold">{edu.role || edu.subject || "Faculty"}</p>
                    {edu.experience && <p className="text-[11px] text-slate-500">{edu.experience}</p>}
                  </div>
                </div>

                {edu.bio && <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{edu.bio}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
