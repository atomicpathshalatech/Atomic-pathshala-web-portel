"use client";

import React, { useState, useEffect } from "react";
import { TeacherTrackingRecord } from "@/app/api/team/faculty/tracking/route";

interface TrackingSummary {
  totalFaculty: number;
  totalScheduledClasses: number;
  totalConductedClasses: number;
  overallAttendancePct: number;
  totalTeachingWatchTimeMinutes: number;
  totalTeachingWatchTimeString: string;
}

export function TeacherTrackingTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TrackingSummary | null>(null);
  const [teachers, setTeachers] = useState<TeacherTrackingRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");

  async function loadTrackingData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team/faculty/tracking");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load faculty tracking data");
      }
      setSummary(json.data.summary);
      setTeachers(json.data.teachers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading tracking data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrackingData();
  }, []);

  const departments = Array.from(
    new Set(teachers.map((t) => t.department).filter((d): d is string => Boolean(d)))
  );

  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.employeeCode && t.employeeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.subjects.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDept = selectedDept === "ALL" || t.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* 1. Top Summary Metric Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Total Educators</span>
              <span className="material-symbols-outlined text-blue-500">groups</span>
            </div>
            <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {summary.totalFaculty}
            </p>
            <p className="text-[11px] text-slate-400">Tracked in live classroom</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Live Classes (Done/Total)</span>
              <span className="material-symbols-outlined text-emerald-500">co_present</span>
            </div>
            <p className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {summary.totalConductedClasses}{" "}
              <span className="text-sm font-normal text-slate-400">/ {summary.totalScheduledClasses}</span>
            </p>
            <p className="text-[11px] text-slate-400">Conducted vs Scheduled</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Faculty Attendance</span>
              <span className="material-symbols-outlined text-amber-500">fact_check</span>
            </div>
            <p className="text-2xl font-black font-mono text-emerald-500">
              {summary.overallAttendancePct}%
            </p>
            <p className="text-[11px] text-slate-400">Overall faculty fulfillment</p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Teaching Watch Time</span>
              <span className="material-symbols-outlined text-purple-500">timelapse</span>
            </div>
            <p className="text-lg font-black font-mono text-slate-900 dark:text-white truncate" title={summary.totalTeachingWatchTimeString}>
              {summary.totalTeachingWatchTimeString}
            </p>
            <p className="text-[11px] text-slate-400">Total verified teaching duration</p>
          </div>
        </div>
      )}

      {/* 2. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search faculty name, subject, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          {departments.length > 0 && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          onClick={loadTrackingData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
        >
          <span className={`material-symbols-outlined text-sm ${loading ? "animate-spin" : ""}`}>
            refresh
          </span>
          <span>Refresh</span>
        </button>
      </div>

      {/* 3. Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* 4. Tracking Table */}
      {loading && !teachers.length ? (
        <div className="py-20 text-center text-slate-400 text-xs space-y-2">
          <span className="material-symbols-outlined text-3xl text-blue-500 animate-spin">
            progress_activity
          </span>
          <p>Loading teacher attendance and teaching watch time metrics…</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-slate-400 text-xs">
          No faculty members match the filter criteria.
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 w-14 text-center">Rank</th>
                  <th className="py-3 px-4">Faculty Member</th>
                  <th className="py-3 px-4">Department &amp; Subjects</th>
                  <th className="py-3 px-4">Classes Conducted</th>
                  <th className="py-3 px-4">Attendance Rate</th>
                  <th className="py-3 px-4">Teaching Watch Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                {filteredTeachers.map((t) => {
                  const isTop3 = t.rank <= 3;
                  const rankBadge =
                    t.rank === 1
                      ? "bg-amber-500/20 text-amber-500 border-amber-400/40"
                      : t.rank === 2
                      ? "bg-slate-300/30 text-slate-300 border-slate-400/40"
                      : t.rank === 3
                      ? "bg-amber-800/20 text-amber-600 border-amber-700/40"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700";

                  const attendanceColor =
                    t.attendancePct >= 90
                      ? "text-emerald-600 dark:text-emerald-400"
                      : t.attendancePct >= 75
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400";

                  const progressBg =
                    t.attendancePct >= 90
                      ? "bg-emerald-500"
                      : t.attendancePct >= 75
                      ? "bg-amber-500"
                      : "bg-rose-500";

                  return (
                    <tr
                      key={t.teacherId}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Rank */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-mono font-black text-xs border ${rankBadge}`}
                        >
                          {t.rank}
                        </span>
                      </td>

                      {/* Faculty Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                            {t.photoUrl ? (
                              <img
                                src={t.photoUrl}
                                alt={t.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                                {t.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {t.name}
                              </span>
                              {t.isCurrentlyLive && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  Live
                                </span>
                              )}
                            </div>
                            {t.employeeCode && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{t.employeeCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department & Subjects */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {t.department || "Academic Faculty"}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate max-w-xs">
                            {t.subjects.length > 0 ? t.subjects.join(", ") : "General"}
                          </p>
                        </div>
                      </td>

                      {/* Scheduled vs Conducted */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 font-mono">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {t.conductedCount}
                          </span>
                          <span className="text-slate-400"> / {t.scheduledCount} scheduled</span>
                        </div>
                      </td>

                      {/* Attendance % */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5 max-w-[140px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={`font-mono font-bold ${attendanceColor}`}>
                              {t.attendancePct}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${progressBg}`}
                              style={{ width: `${t.attendancePct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Teaching Watch Time */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          {t.watchTimeFormatted}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
