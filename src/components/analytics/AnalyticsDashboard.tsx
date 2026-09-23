"use client";

import React, { useState } from "react";
import { ActivityStreamTab } from "./ActivityStreamTab";
import { StaffPresenceTab } from "./StaffPresenceTab";
import { StudentPerformanceTab } from "./StudentPerformanceTab";
import { EducatorBenchmarkTab } from "./EducatorBenchmarkTab";
import { VisitorFunnelTab } from "./VisitorFunnelTab";

export type AnalyticsTab = "activity" | "staff" | "students" | "educators" | "visitors";

export function AnalyticsDashboard() {
  const [currentTab, setCurrentTab] = useState<AnalyticsTab>("activity");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Operations & Performance Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
              Live DB Telemetry
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time activity tracking, daily staff audit logs, student practice leaderboards, educator index, and high-intent visitor leads.
          </p>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setCurrentTab("activity")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            currentTab === "activity"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">radar</span>
          <span>🔴 Live Activity Stream</span>
        </button>

        <button
          onClick={() => setCurrentTab("staff")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            currentTab === "staff"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">badge</span>
          <span>👥 Staff & Teacher Daily Audit</span>
        </button>

        <button
          onClick={() => setCurrentTab("students")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            currentTab === "students"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">leaderboard</span>
          <span>🏆 Student Performance & Practice</span>
        </button>

        <button
          onClick={() => setCurrentTab("educators")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            currentTab === "educators"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">school</span>
          <span>👨‍🏫 Educator Benchmark & Ratings</span>
        </button>

        <button
          onClick={() => setCurrentTab("visitors")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            currentTab === "visitors"
              ? "bg-primary text-white shadow-md shadow-primary/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">local_fire_department</span>
          <span>🎯 Visitor Journey & Leads</span>
        </button>
      </div>

      {/* Tab Panels */}
      {currentTab === "activity" && <ActivityStreamTab />}
      {currentTab === "staff" && <StaffPresenceTab />}
      {currentTab === "students" && <StudentPerformanceTab />}
      {currentTab === "educators" && <EducatorBenchmarkTab />}
      {currentTab === "visitors" && <VisitorFunnelTab />}
    </div>
  );
}
