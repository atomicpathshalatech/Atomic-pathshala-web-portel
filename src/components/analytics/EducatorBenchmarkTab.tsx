"use client";

import React, { useState, useEffect, useCallback } from "react";

interface EducatorRankingItem {
  rank: number;
  teacherId: string;
  userId: string;
  name: string;
  email: string;
  photoUrl: string | null;
  employeeCode: string | null;
  department: string | null;
  subjects: string[];
  scheduledCount: number;
  conductedCount: number;
  attendancePct: number;
  liveTeachingMinutes: number;
  totalLecturesCreated: number;
  totalStudentWatchCompletions: number;
  totalWatchHours: number;
  avgRating: number;
  testimonialCount: number;
  totalStudentsTaught: number;
  activeBatchesCount: number;
  performanceScore: number;
  badge: string;
}

export function EducatorBenchmarkTab() {
  const [rankings, setRankings] = useState<EducatorRankingItem[]>([]);
  const [summary, setSummary] = useState({
    totalTeachers: 0,
    totalWatchHoursDelivered: 0,
    avgPlatformRating: "5.0",
    totalClassesConducted: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchEducators = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/team/analytics/educators-performance?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setRankings(json.rankings || []);
        setSummary(json.summary);
      }
    } catch (err) {
      console.error("Failed to load educator performance data:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchEducators();
  }, [fetchEducators]);

  const getBadgeStyle = (badge: string) => {
    if (badge === "Master Educator") return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    if (badge === "Star Faculty") return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 mb-2">
            <span className="material-symbols-outlined text-lg">workspace_premium</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {rankings[0]?.name || "—"}
          </p>
          <p className="text-xs text-slate-500 font-medium">#1 Top Ranked Educator</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
            <span className="material-symbols-outlined text-lg">timelapse</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.totalWatchHoursDelivered.toLocaleString("en-IN")} hrs
          </p>
          <p className="text-xs text-slate-500 font-medium">Teaching Watch Hours</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="material-symbols-outlined text-lg">star</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            ⭐ {summary.avgPlatformRating} / 5.0
          </p>
          <p className="text-xs text-slate-500 font-medium">Average Student Rating</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
            <span className="material-symbols-outlined text-lg">video_camera_front</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.totalClassesConducted}
          </p>
          <p className="text-xs text-slate-500 font-medium">Live Classes Delivered</p>
        </div>
      </div>

      {/* Search and Refresh Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Educator Performance Benchmark & Rankings
          </h3>
          <p className="text-xs text-slate-500">
            Rankings computed from student watch time, class attendance, ratings, and course engagement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search faculty name, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            onClick={fetchEducators}
            disabled={loading}
            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* Rankings Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl animate-spin text-primary">
              progress_activity
            </span>
            <p className="text-xs font-medium">Computing educator benchmarks & ratings...</p>
          </div>
        ) : rankings.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
              school
            </span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No educator records found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {rankings.map((educator) => {
              const rankBadge =
                educator.rank === 1
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  : educator.rank === 2
                  ? "bg-slate-400 text-white shadow-md"
                  : educator.rank === 3
                  ? "bg-amber-700 text-white shadow-md"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";

              return (
                <div key={educator.teacherId} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  {/* Rank & Faculty Info */}
                  <div className="flex items-center gap-3 min-w-[280px]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${rankBadge}`}>
                      {educator.rank}
                    </div>

                    <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden font-bold text-xs text-slate-700 dark:text-slate-200">
                      {educator.photoUrl ? (
                        <img src={educator.photoUrl} alt={educator.name} className="w-full h-full object-cover" />
                      ) : (
                        educator.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{educator.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeStyle(educator.badge)}`}>
                          {educator.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {educator.department || "Faculty"} {educator.subjects.length > 0 ? `• ${educator.subjects.join(", ")}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Benchmark Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {/* Watch Hours */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-medium text-[10px]">Teaching Watch Time</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {educator.totalWatchHours} hrs
                      </p>
                    </div>

                    {/* Class Attendance */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-medium text-[10px]">Live Class Attendance</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {educator.attendancePct}% ({educator.conductedCount}/{educator.scheduledCount})
                      </p>
                    </div>

                    {/* Student Rating */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-medium text-[10px]">Student Rating</p>
                      <p className="font-bold text-amber-500 mt-0.5 flex items-center gap-1">
                        <span>⭐</span> {educator.avgRating} / 5.0
                      </p>
                    </div>

                    {/* Overall Performance Score */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-medium text-[10px]">Performance Score</p>
                      <p className="font-bold text-primary mt-0.5 font-mono">
                        {educator.performanceScore} / 1000
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
