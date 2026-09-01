"use client";

import React, { useState } from "react";

export function ClassesSection() {
  const [reminded, setReminded] = useState<Record<string, boolean>>({});

  const toggleReminder = (id: string) => {
    setReminded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const upcomingClasses = [
    {
      id: "cls-1",
      title: "Chemical Bonding — VSEPR Theory & Hybridization",
      subject: "Inorganic Chemistry",
      educator: "Sonu Bhaiya",
      date: "Tomorrow, 03 Sept",
      time: "07:00 PM - 09:00 PM",
      isLive: true,
      roomStatus: "Live Room Scheduled",
    },
    {
      id: "cls-2",
      title: "Thermodynamics — First Law & Enthalpy of Reactions",
      subject: "Physical Chemistry",
      educator: "Sonu Bhaiya",
      date: "Friday, 05 Sept",
      time: "07:00 PM - 09:00 PM",
      isLive: true,
      roomStatus: "Live Room Scheduled",
    },
    {
      id: "cls-3",
      title: "GOC — Resonance, Hyperconjugation & Stability of Intermediates",
      subject: "Organic Chemistry",
      educator: "Dr. Priya Sharma",
      date: "Saturday, 06 Sept",
      time: "05:00 PM - 07:00 PM",
      isLive: true,
      roomStatus: "Live Room Scheduled",
    },
  ];

  const recordedClasses = [
    {
      title: "Mole Concept — Mass Fraction, Molarity & Normality",
      chapter: "Some Basic Concepts of Chemistry",
      duration: "1h 45m",
      views: "1.2K views",
      status: "Recorded • 1080p HD",
    },
    {
      title: "Bohr Model & Spectrum of Hydrogen Atom",
      chapter: "Structure of Atom",
      duration: "2h 10m",
      views: "980 views",
      status: "Recorded • 1080p HD",
    },
  ];

  return (
    <section id="classes" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500">live_tv</span>
          <span>Live & Recorded Classes</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          High-definition interactive live classes with instant recording playback.
        </p>
      </div>

      {/* Upcoming Live Classes */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
          Upcoming Live Sessions
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {upcomingClasses.map((cls) => {
            const hasReminder = reminded[cls.id];
            return (
              <div
                key={cls.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-500 text-white flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      LIVE SOON
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">{cls.subject}</span>
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm text-[#031635] line-clamp-2 mb-2">
                    {cls.title}
                  </h4>
                  <p className="text-[11px] text-[#6b46c1] font-bold mb-3">By {cls.educator}</p>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-100 space-y-1 mb-3 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                      <span>{cls.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                      <span>{cls.time}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleReminder(cls.id)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                      hasReminder
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {hasReminder ? "notifications_active" : "notifications"}
                    </span>
                    <span>{hasReminder ? "Reminder Set" : "Set Reminder"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recorded Replay Library */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
          Recent Recorded Lectures (Sample)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recordedClasses.map((rec) => (
            <div
              key={rec.title}
              className="p-4 rounded-2xl bg-white border border-slate-200 flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <span className="material-symbols-outlined">play_arrow</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs text-[#031635] line-clamp-1">{rec.title}</h4>
                <p className="text-[11px] text-slate-500">{rec.chapter}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                  <span>{rec.duration}</span>
                  <span>•</span>
                  <span>{rec.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}