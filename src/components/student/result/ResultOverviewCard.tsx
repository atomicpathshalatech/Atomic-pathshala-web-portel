"use client";

import React from "react";
import { FullTestAnalysisResult } from "@/lib/test-engine/analysis-engine";

export function ResultOverviewCard({
  analysis,
  onOpenLeaderboard,
}: {
  analysis: FullTestAnalysisResult;
  onOpenLeaderboard: () => void;
}) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const isNormalized = analysis.maxMarks !== 720 && analysis.maxMarks > 0;
  const neetEqScore = analysis.neetEquivalentScore ?? (isNormalized ? Math.round((analysis.score / analysis.maxMarks) * 720) : analysis.score);

  return (
    <div className="space-y-6">
      {/* Scorecard: compact, one aligned row of rank / AIR / gap */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {analysis.targetExam || "NEET UG"} scorecard ·{" "}
              {new Date(analysis.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">{analysis.testName}</h1>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono">{analysis.score}</span>
              <span className="text-sm font-bold text-slate-400">/ {analysis.maxMarks}</span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono">
                {analysis.percentage}%
              </span>
              {isNormalized && <span className="text-[11px] text-slate-500 font-mono">≈ {neetEqScore}/720 NEET scale</span>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:w-[420px] shrink-0">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Test rank</p>
              <p className="text-xl font-black text-slate-900 dark:text-white font-mono leading-tight">#{analysis.rank}</p>
              <p className="text-[10px] text-slate-500">of {analysis.totalParticipants}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Est. NEET AIR</p>
              <p className="text-xl font-black text-indigo-700 dark:text-indigo-300 font-mono leading-tight">
                {analysis.estimatedNeetAir ? analysis.estimatedNeetAir.toLocaleString("en-IN") : "—"}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {analysis.estimatedNeetAirMin && analysis.estimatedNeetAirMax
                  ? `${analysis.estimatedNeetAirMin.toLocaleString("en-IN")}–${analysis.estimatedNeetAirMax.toLocaleString("en-IN")}`
                  : "estimate"}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Gap to 720</p>
              <p className="text-xl font-black text-amber-700 dark:text-amber-300 font-mono leading-tight">{Math.max(0, 720 - neetEqScore)}</p>
              <p className="text-[10px] text-slate-500">marks</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">leaderboard</span>
            Leaderboard
          </button>
        </div>
        <p className="mt-3 text-[10px] text-slate-400">
          *NEET AIR is an estimate from {analysis.neetPredictionSource || "NTA NEET (UG) reference data"} — not an official NTA rank.
        </p>
      </div>

      {/* Grid: Counter Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Correct */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-950/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Correct</span>
            <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {analysis.correct}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">+{analysis.correct * 4} marks</span>
        </div>

        {/* Incorrect */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-950/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Incorrect</span>
            <span className="material-symbols-outlined text-base text-red-500">cancel</span>
          </div>
          <div className="mt-2 text-2xl font-black text-red-500 font-mono">
            {analysis.incorrect}
          </div>
          <span className="text-[10px] text-red-400 font-medium">-{analysis.incorrect * 1} negative marks</span>
        </div>

        {/* Unattempted */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Unattempted</span>
            <span className="material-symbols-outlined text-base text-slate-400">help_outline</span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-700 dark:text-slate-300 font-mono">
            {analysis.unattempted}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">0 marks lost</span>
        </div>

        {/* Attempted */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Attempted</span>
            <span className="material-symbols-outlined text-base text-blue-500">edit_note</span>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {analysis.attempted} <span className="text-xs font-normal text-slate-400">/ {analysis.totalQuestions}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {Math.round((analysis.attempted / Math.max(analysis.totalQuestions, 1)) * 100)}% attempt rate
          </span>
        </div>

        {/* Accuracy */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Accuracy</span>
            <span className="material-symbols-outlined text-base text-blue-500">target</span>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {analysis.accuracy}%
          </div>
          <span className="text-[10px] text-slate-400 font-medium">precision on attempted</span>
        </div>

        {/* Time Taken */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Time Taken</span>
            <span className="material-symbols-outlined text-base text-amber-500">timer</span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatTime(analysis.timeTakenSec)}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            ~{Math.round(analysis.timeTakenSec / Math.max(analysis.totalQuestions, 1))}s per question
          </span>
        </div>
      </div>
    </div>
  );
}
