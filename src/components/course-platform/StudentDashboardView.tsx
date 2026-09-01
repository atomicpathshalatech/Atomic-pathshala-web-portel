"use client";

import React from "react";
import Link from "next/link";

export function StudentDashboardView({ studentName = "Aman Sharma" }: { studentName?: string }) {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#031635] tracking-tight">
            Welcome back, {studentName.split(" ")[0]}.
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ready to crush your NEET prep today? Keep up the 5-day study streak!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-[#9ff5c1] text-[#005231] font-extrabold text-xs flex items-center gap-1 shadow-sm">
            <span className="material-symbols-outlined text-sm">local_fire_department</span>
            <span>5 Day Streak</span>
          </span>
          <span className="px-3 py-1.5 rounded-full bg-[#e7eeff] text-[#031635] font-bold text-xs">
            NEET 2027 Aspirant
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Continue Learning Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm hover:shadow-md transition">
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="w-full sm:w-44 aspect-video sm:aspect-square bg-slate-900 rounded-2xl overflow-hidden relative shrink-0">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCtOovoDGl3x0qk01hoCTXmjxdedWnL1nXWDoXRCLuNpaT8cVcIo5iCfisJXXKyBNNMLCFSUHLYAkc0kHcmnZx74iRe8uV2UlK9b6A2NNbeuk0DabOQPkUJRTEOB1YSMgbjLcTT3H5rPqiobQUYY3ASWzZWXYqL8YcU1aSsckW7TbXwvpucjTWwDVuiaWv5wom_iEsiB_GkrcaRe3_UfF65PV_7aq3dqUPgZdeGMVhoCRzAukN3SqqJ2g"
                  alt="Physics mastery"
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute top-2.5 left-2.5 bg-[#031635] text-white text-[10px] font-black px-2 py-0.5 rounded">
                  PHYSICS
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-600 tracking-wider">
                    CURRENT IN PROGRESS
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[#031635]">
                    NEET Physics Mastery: Target 180
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chapter 4: Laws of Motion — Friction Concepts & Free Body Diagrams
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>Overall Progress</span>
                    <span className="text-purple-600">32% Completed</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#6b46c1] rounded-full" style={{ width: "32%" }} />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href="/courses"
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#031635] hover:bg-[#1a2b4b] text-white font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">play_arrow</span>
                    <span>Resume Lecture</span>
                  </Link>

                  <Link
                    href="/courses"
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition"
                  >
                    View Syllabus
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming & Recent Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Upcoming Class */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
                <span className="material-symbols-outlined text-lg">event</span>
                <span>Upcoming Live Class</span>
              </div>

              <h4 className="font-bold text-sm text-[#031635]">
                Chemical Bonding & Molecular Structure
              </h4>
              <p className="text-xs text-slate-500">Live Lecture • Chemistry • By Sonu Bhaiya</p>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                <span>Tomorrow, 07:00 PM (2 hrs)</span>
              </div>

              <button
                type="button"
                className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">notifications</span>
                <span>Set Class Reminder</span>
              </button>
            </div>

            {/* Recent Tests */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                    <span className="material-symbols-outlined text-lg">assignment_turned_in</span>
                    <span>Recent Test Result</span>
                  </div>
                  <Link href="/tests" className="text-xs font-bold text-purple-600 hover:underline">
                    View All
                  </Link>
                </div>

                <div className="mt-3 space-y-2.5 divide-y divide-slate-100">
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-[#031635]">Mock Test 4: Botany</p>
                      <p className="text-[10px] text-slate-400">Completed Yesterday</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-600 text-sm">320 / 360</p>
                      <p className="text-[10px] text-purple-600 font-bold">Rank: 45 / 1200</p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-[#031635]">Part Test: Zoology</p>
                      <p className="text-[10px] text-slate-400">3 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[#031635] text-sm">305 / 360</p>
                      <p className="text-[10px] text-purple-600 font-bold">Rank: 89 / 1200</p>
                    </div>
                  </div>
                </div>
              </div>

              <Link
                href="/tests"
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#031635] font-bold text-xs transition text-center block"
              >
                Analyze Performance
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar Column (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Announcements Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-3">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
              <span className="material-symbols-outlined text-lg">campaign</span>
              <span>Announcements</span>
            </div>

            <ul className="space-y-3 divide-y divide-slate-100 text-xs">
              <li className="pt-1">
                <p className="font-bold text-[#031635]">Revised Schedule for Organic Chemistry</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Due to faculty traveling, this Friday&apos;s class is shifted to Saturday 5:00 PM.
                </p>
              </li>
              <li className="pt-2.5">
                <p className="font-bold text-[#031635]">NEET Mock Test #05 is Live</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  All-India ranking active until Sunday 11:59 PM.
                </p>
              </li>
            </ul>
          </div>

          {/* Doubt Resolution CTA Card */}
          <div className="bg-gradient-to-br from-[#031635] to-[#1a2b4b] text-white rounded-3xl p-5 space-y-3 shadow-md">
            <span className="material-symbols-outlined text-3xl text-purple-400">forum</span>
            <h3 className="text-base font-bold">Stuck on a Problem?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Our expert faculty and AI Co-Pilot resolve your doubts 24/7 with step-by-step video & text solutions.
            </p>
            <button
              type="button"
              className="w-full py-2.5 rounded-xl bg-white text-[#031635] font-extrabold text-xs hover:bg-slate-100 transition shadow"
            >
              Ask a Doubt Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}