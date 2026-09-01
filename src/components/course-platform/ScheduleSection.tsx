"use client";

import React, { useState } from "react";

export function ScheduleSection() {
  const [filterSubject, setFilterSubject] = useState("All");

  const timetable = [
    {
      date: "03 Sept",
      day: "Wednesday",
      time: "07:00 PM",
      subject: "Physical Chemistry",
      chapter: "Chemical Bonding — Molecular Orbitals",
      teacher: "Sonu Bhaiya",
      type: "Live Lecture",
    },
    {
      date: "04 Sept",
      day: "Thursday",
      time: "05:00 PM",
      subject: "Organic Chemistry",
      chapter: "GOC — Inductive & Mesomeric Effects",
      teacher: "Dr. Priya Sharma",
      type: "Live Lecture",
    },
    {
      date: "05 Sept",
      day: "Friday",
      time: "07:00 PM",
      subject: "Physical Chemistry",
      chapter: "Thermodynamics — Enthalpy of Formation",
      teacher: "Sonu Bhaiya",
      type: "Live Lecture",
    },
    {
      date: "06 Sept",
      day: "Saturday",
      time: "06:00 PM",
      subject: "Physical Chemistry",
      chapter: "Live Doubt Resolution & PYQ Session",
      teacher: "Sonu Bhaiya",
      type: "Doubt Class",
    },
  ];

  const filtered =
    filterSubject === "All"
      ? timetable
      : timetable.filter((item) => item.subject.includes(filterSubject));

  return (
    <section id="schedule" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">calendar_month</span>
            <span>Weekly Live Class Schedule</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Structured timetable designed for balanced school and competitive prep.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto">
          {["All", "Physical", "Organic"].map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => setFilterSubject(sub)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                filterSubject === sub
                  ? "bg-[#031635] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
        {filtered.map((item, idx) => (
          <div
            key={idx}
            className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#e7eeff] border border-slate-200/60 flex flex-col items-center justify-center text-center shrink-0">
                <span className="text-xs font-bold text-[#6b46c1] uppercase">{item.day.slice(0, 3)}</span>
                <span className="text-sm font-black text-[#031635]">{item.date}</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    {item.subject}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">• {item.type}</span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-[#031635]">{item.chapter}</h4>
                <p className="text-xs text-slate-500">
                  By {item.teacher} • <span className="font-semibold text-slate-700">{item.time}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              className="self-start sm:self-auto px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">notifications</span>
              <span>Set Reminder</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}