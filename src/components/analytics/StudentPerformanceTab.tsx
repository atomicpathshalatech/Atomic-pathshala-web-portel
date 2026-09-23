"use client";

import React, { useState, useEffect, useCallback } from "react";

interface StudentMetric {
  studentId: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  rollNumber: string | null;
  targetExam: string | null;
  targetYear: number | null;
  batchNames: string;
  totalQuestionsAttempted: number;
  totalQuestionsCorrect: number;
  practiceAccuracy: number;
  totalStudyMinutes: number;
  studyHoursFormatted: string;
  lecturesWatchedCount: number;
  liveClassesAttendedCount: number;
  testsCompletedCount: number;
  totalTestScore: number;
  avgTestScore: number;
  compositeScore: number;
}

interface LeaderboardsData {
  practiceToppers: StudentMetric[];
  studyTimeToppers: StudentMetric[];
  scoreToppers: StudentMetric[];
  allRounderToppers: StudentMetric[];
}

export function StudentPerformanceTab() {
  const [timeframe, setTimeframe] = useState("today");
  const [activeLeaderboard, setActiveLeaderboard] = useState<"practice" | "study" | "score" | "allRounder">("practice");
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<LeaderboardsData | null>(null);
  const [summary, setSummary] = useState({
    totalStudents: 0,
    activePracticingStudents: 0,
    totalQuestionsPlatform: 0,
    totalStudyHoursPlatform: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStudentPerformance = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("timeframe", timeframe);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/team/analytics/students-performance?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setData(json.leaderboards);
        setSummary(json.summary);
      }
    } catch (err) {
      console.error("Failed to load student performance data:", err);
    } finally {
      setLoading(false);
    }
  }, [timeframe, searchQuery]);

  useEffect(() => {
    fetchStudentPerformance();
  }, [fetchStudentPerformance]);

  const getCurrentList = () => {
    if (!data) return [];
    if (activeLeaderboard === "practice") return data.practiceToppers;
    if (activeLeaderboard === "study") return data.studyTimeToppers;
    if (activeLeaderboard === "score") return data.scoreToppers;
    return data.allRounderToppers;
  };

  const currentList = getCurrentList();

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
            <span className="material-symbols-outlined text-lg">psychology</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.totalQuestionsPlatform.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-slate-500 font-medium">Questions Solved ({timeframe})</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="material-symbols-outlined text-lg">timelapse</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.totalStudyHoursPlatform.toLocaleString("en-IN")} hrs
          </p>
          <p className="text-xs text-slate-500 font-medium">Study & Watch Hours</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
            <span className="material-symbols-outlined text-lg">local_fire_department</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.activePracticingStudents.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-slate-500 font-medium">Active Students Today</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-2">
            <span className="material-symbols-outlined text-lg">school</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.totalStudents.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-slate-500 font-medium">Total Enrolled Aspirants</p>
        </div>
      </div>

      {/* Control & Sub-tabs Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Leaderboard View Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
          <button
            onClick={() => setActiveLeaderboard("practice")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeLeaderboard === "practice"
                ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">quiz</span>
            <span>Practice Leaders</span>
          </button>

          <button
            onClick={() => setActiveLeaderboard("study")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeLeaderboard === "study"
                ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">schedule</span>
            <span>Study Hours Toppers</span>
          </button>

          <button
            onClick={() => setActiveLeaderboard("score")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeLeaderboard === "score"
                ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">military_tech</span>
            <span>Test Score Rankers</span>
          </button>

          <button
            onClick={() => setActiveLeaderboard("allRounder")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeLeaderboard === "allRounder"
                ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-sm">workspace_premium</span>
            <span>All-Rounder Index</span>
          </button>
        </div>

        {/* Timeframe & Search */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(["today", "week", "month", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase ${
                  timeframe === t
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative flex-1 md:w-56">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Search student, batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            onClick={fetchStudentPerformance}
            disabled={loading}
            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-3xl animate-spin text-primary">
              progress_activity
            </span>
            <p className="text-xs font-medium">Computing student performance leaderboards...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
              leaderboard
            </span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No student activity recorded</p>
            <p className="text-xs text-slate-500">Practice questions, lecture sessions, and tests will rank students here automatically.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {currentList.map((student, idx) => {
              const rank = idx + 1;
              const rankBadge =
                rank === 1
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  : rank === 2
                  ? "bg-slate-400 text-white shadow-md"
                  : rank === 3
                  ? "bg-amber-700 text-white shadow-md"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";

              return (
                <div key={student.studentId} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  {/* Rank & Student Details */}
                  <div className="flex items-center gap-3 min-w-[260px]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${rankBadge}`}>
                      {rank}
                    </div>

                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden font-bold text-xs text-slate-700 dark:text-slate-200">
                      {student.photoUrl ? (
                        <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
                      ) : (
                        student.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{student.name}</h4>
                        {student.targetExam && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                            {student.targetExam}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate max-w-[220px]">
                        {student.batchNames}
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Metrics based on Tab */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {/* Questions Practiced */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-medium text-[10px]">Questions Practiced</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                        {student.totalQuestionsAttempted}{" "}
                        <span className="text-[10px] font-normal text-slate-400">
                          ({student.totalQuestionsCorrect} correct)
                        </span>
                      </p>
                    </div>

                    {/* Accuracy */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-medium text-[10px]">Practice Accuracy</p>
                      <p className={`font-bold mt-0.5 ${student.practiceAccuracy >= 75 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                        {student.practiceAccuracy}%
                      </p>
                    </div>

                    {/* Study & Watch Hours */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-medium text-[10px]">Study Duration</p>
                      <p className="font-bold text-primary mt-0.5">
                        {student.studyHoursFormatted}
                      </p>
                    </div>

                    {/* Composite / Score */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-400 font-medium text-[10px]">All-Round Score</p>
                      <p className="font-bold text-purple-600 dark:text-purple-400 mt-0.5 font-mono">
                        {student.compositeScore} / 1000
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
