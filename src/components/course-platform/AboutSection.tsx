"use client";

import React from "react";

export function AboutSection({ course }: { course: any }) {
  const features = [
    {
      icon: "video_camera_front",
      title: "Live Interactive Classes",
      desc: "Daily 2-hour interactive sessions with real-time student doubt solving.",
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      icon: "quiz",
      title: "Standardized Mock Tests",
      desc: "21 Full syllabus & part tests strictly matching the latest NEET/JEE patterns.",
      color: "bg-purple-50 text-purple-600",
    },
    {
      icon: "menu_book",
      title: "Comprehensive Study Notes",
      desc: "High-yield digital theory notes, chapter-wise formula sheets, and DPP PDFs.",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: "forum",
      title: "24/7 Doubt Support",
      desc: "Ask unlimited doubts with step-by-step video & text solutions from top faculty.",
      color: "bg-amber-50 text-amber-600",
    },
    {
      icon: "history_edu",
      title: "15-Year PYQ Bank",
      desc: "Thoroughly solved past 15 years NEET/JEE questions categorized by topic.",
      color: "bg-blue-50 text-blue-600",
    },
    {
      icon: "insights",
      title: "AI Performance Analytics",
      desc: "Granular accuracy analysis, weak area detection, and expected All-India Rank.",
      color: "bg-rose-50 text-rose-600",
    },
  ];

  return (
    <section id="about" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-600">verified</span>
          <span>What&apos;s Included in this Batch</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Everything you need to secure a top 1000 rank in NEET/JEE 2027.
        </p>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#f0f3ff] border border-slate-200/60 text-center">
          <span className="text-2xl font-black text-[#031635] block">128+</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Live Classes</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#f0f3ff] border border-slate-200/60 text-center">
          <span className="text-2xl font-black text-[#031635] block">21</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Mock Tests</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#f0f3ff] border border-slate-200/60 text-center">
          <span className="text-2xl font-black text-[#031635] block">12 Mo</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Course Validity</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#f0f3ff] border border-slate-200/60 text-center">
          <span className="text-2xl font-black text-[#031635] block">5 / Wk</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Class Schedule</span>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {features.map((f) => (
          <div
            key={f.title}
            className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-sm transition flex items-start gap-3.5"
          >
            <div className={`p-2.5 rounded-xl ${f.color} flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined text-xl">{f.icon}</span>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#031635] mb-1">{f.title}</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}