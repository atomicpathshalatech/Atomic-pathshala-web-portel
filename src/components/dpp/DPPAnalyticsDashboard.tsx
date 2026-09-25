"use client";

import React from "react";

export interface DPPAnalyticsData {
  totalAssigned: number;
  totalAttempted: number;
  totalCompleted: number;
  overallAccuracy: number; // 0 - 100%
  averageTimePerQuestionSec: number;
  currentStreakDays: number;
  subjectBreakdown: Array<{
    subject: string;
    attempted: number;
    accuracy: number;
    color: string;
  }>;
  difficultyAccuracy: {
    easy: number;
    medium: number;
    hard: number;
  };
}

export interface DPPAnalyticsDashboardProps {
  data: DPPAnalyticsData;
  className?: string;
}

export function DPPAnalyticsDashboard({ data, className = "" }: DPPAnalyticsDashboardProps) {
  const completionRate =
    data.totalAssigned > 0
      ? Math.round((data.totalCompleted / data.totalAssigned) * 100)
      : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Header Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Attempted & Completion */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 to-slate-900/60 border border-blue-500/20 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
              Completion
            </span>
            <span className="material-symbols-outlined text-blue-400 text-lg">
              task_alt
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {completionRate}%
            </span>
            <span className="text-xs text-slate-400">
              ({data.totalCompleted}/{data.totalAssigned})
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, completionRate)}%` }}
            />
          </div>
        </div>

        {/* Overall Accuracy */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900/60 border border-emerald-500/20 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
              Accuracy
            </span>
            <span className="material-symbols-outlined text-emerald-400 text-lg">
              check_circle
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {data.overallAccuracy}%
            </span>
            <span className="text-xs text-slate-400">Target: 85%+</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, data.overallAccuracy)}%` }}
            />
          </div>
        </div>

        {/* Average Speed */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 to-slate-900/60 border border-purple-500/20 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
              Avg Speed
            </span>
            <span className="material-symbols-outlined text-purple-400 text-lg">
              speed
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-white">
              {data.averageTimePerQuestionSec}s
            </span>
            <span className="text-xs text-slate-400">/ question</span>
          </div>
          <p className="text-[11px] text-purple-300/80 mt-2 font-medium">
            {data.averageTimePerQuestionSec < 90
              ? "⚡ Excellent Pace for JEE/NEET"
              : "⏱ Aim for under 90s"}
          </p>
        </div>

        {/* Active Practice Streak */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900/60 border border-amber-500/20 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
              Practice Streak
            </span>
            <span className="material-symbols-outlined text-amber-400 text-lg">
              local_fire_department
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-400">
              {data.currentStreakDays}
            </span>
            <span className="text-xs text-slate-400">days active</span>
          </div>
          <p className="text-[11px] text-amber-300/80 mt-2 font-medium">
            🔥 Keep the momentum going!
          </p>
        </div>
      </div>

      {/* 2. Subject Breakdown & Difficulty Mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Subject Mastery */}
        <div className="p-5 rounded-2xl bg-[#0e121e] border border-slate-800 shadow-lg space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400 text-base">
              menu_book
            </span>
            <span>Subject-wise Accuracy</span>
          </h4>
          <div className="space-y-3">
            {data.subjectBreakdown.map((subj) => (
              <div key={subj.subject} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-300">{subj.subject}</span>
                  <span className="font-bold text-white">
                    {subj.accuracy}% ({subj.attempted} DPPs)
                  </span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, subj.accuracy)}%`,
                      backgroundColor: subj.color || "#3b82f6",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty Mastery */}
        <div className="p-5 rounded-2xl bg-[#0e121e] border border-slate-800 shadow-lg space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-base">
              tune
            </span>
            <span>Difficulty Breakdown</span>
          </h4>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            {/* Easy */}
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
              <span className="text-[11px] font-bold text-emerald-400 block mb-1">
                EASY
              </span>
              <span className="text-xl font-extrabold text-white">
                {data.difficultyAccuracy.easy}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Foundation
              </span>
            </div>

            {/* Medium */}
            <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/20">
              <span className="text-[11px] font-bold text-blue-400 block mb-1">
                MEDIUM
              </span>
              <span className="text-xl font-extrabold text-white">
                {data.difficultyAccuracy.medium}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Standard
              </span>
            </div>

            {/* Hard */}
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/20">
              <span className="text-[11px] font-bold text-rose-400 block mb-1">
                HARD
              </span>
              <span className="text-xl font-extrabold text-white">
                {data.difficultyAccuracy.hard}%
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Advanced
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
