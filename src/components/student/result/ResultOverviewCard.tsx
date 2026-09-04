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
      {/* Top Banner: Score, Rank, Percentile, and NEET 2026 Prediction */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 text-white shadow-xl shadow-indigo-950/15 relative overflow-hidden border-2 border-indigo-400/30">
        {/* Subtle decorative circles */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left: Test Name, Raw Score & NEET Equivalent Score */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-mono font-bold tracking-wider uppercase">
                {analysis.targetExam || "NEET UG"} Official Scorecard
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Submitted on {new Date(analysis.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {analysis.testName}
            </h1>

            {/* Score & Normalized Scale */}
            <div className="space-y-1 pt-1">
              <div className="flex items-baseline gap-3">
                <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-white to-blue-300 font-mono">
                  {analysis.score}
                </div>
                <div className="text-lg sm:text-xl font-bold text-slate-400">
                  / {analysis.maxMarks} <span className="text-xs font-normal">Atomic test marks</span>
                </div>
                <div className="ml-2 px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
                  {analysis.percentage}%
                </div>
              </div>

              {isNormalized && (
                <div className="flex items-center gap-2 text-xs text-cyan-300 font-mono pt-1">
                  <span className="material-symbols-outlined text-sm">swap_horiz</span>
                  <span>
                    NEET-Equivalent Score: <b>{neetEqScore} / 720</b> (Normalized scale)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Atomic Test Rank + NEET 2026 AIR Predictor + Benchmark */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Atomic Test Rank Card */}
            <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 text-center min-w-[130px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                Atomic Test Rank
              </span>
              <div className="text-3xl font-black text-amber-300 font-mono">
                #{analysis.rank}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                out of {analysis.totalParticipants} candidate{analysis.totalParticipants > 1 ? "s" : ""}
              </span>
            </div>

            {/* Estimated NEET 2026 AIR Card (Data-Backed from NTA PDF) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/60 to-purple-900/60 backdrop-blur-md border border-indigo-400/40 text-center min-w-[170px] shadow-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200">
                  Estimated NEET AIR
                </span>
                <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 text-[9px] font-mono font-bold">
                  2026
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">
                {analysis.estimatedNeetAir ? `≈ ${analysis.estimatedNeetAir.toLocaleString("en-IN")}` : "≈ N/A"}
              </div>
              {analysis.estimatedNeetAirMin && analysis.estimatedNeetAirMax ? (
                <span className="text-[10px] text-slate-300 font-mono block mt-0.5">
                  Range: {analysis.estimatedNeetAirMin.toLocaleString("en-IN")} – {analysis.estimatedNeetAirMax.toLocaleString("en-IN")}
                </span>
              ) : (
                <span className="text-[10px] text-slate-300 font-medium">Predicted from NTA 2026 data</span>
              )}
            </div>

            {/* Anonymous NEET 2026 Rank 1 Benchmark */}
            <div className="p-4 rounded-2xl bg-blue-600/20 backdrop-blur-md border border-blue-500/30 text-center min-w-[140px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 block mb-1">
                NEET 2026 Rank 1
              </span>
              <div className="text-lg font-black text-white font-mono">
                720 <span className="text-xs font-normal text-slate-300">/ 720</span>
              </div>
              <span className="text-[10px] text-amber-300 font-bold block mt-0.5">
                Gap: {Math.max(0, 720 - neetEqScore)} marks
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">leaderboard</span>
              <span>Test Leaderboard</span>
            </button>
          </div>
        </div>

        {/* Source Transparency Bar */}
        <div className="mt-5 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-cyan-400">verified</span>
            <span>
              <b>NEET 2026 Prediction Source:</b> {analysis.neetPredictionSource || "Official National Testing Agency (NTA) NEET (UG)-2026 Dataset (Pages 1–15)"}
            </span>
          </div>
          <span className="text-slate-400 italic">
            *Estimated based on official reference points. Not an official NTA rank.
          </span>
        </div>
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
            <span className="material-symbols-outlined text-base text-indigo-500">target</span>
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
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
