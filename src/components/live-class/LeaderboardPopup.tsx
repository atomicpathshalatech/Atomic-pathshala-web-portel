"use client";

import { useEffect, useState } from "react";

export interface PublishedLeaderboard {
  rankings: Array<{
    studentId: string;
    name: string;
    photoUrl: string | null;
    totalAttempted: number;
    correctCount: number;
    accuracyPct: number;
    avgResponseTimeMs: number;
    rank: number;
    /** "YOUTUBE" = answered in the YouTube live chat. */
    source?: "APP" | "YOUTUBE";
  }>;
  stats?: {
    totalParticipants: number;
    totalPolls: number;
    averageAccuracy: number;
  };
  scope?: string;
  durationSec?: number;
  publishedAt?: string;
}

/** Marks someone who answered in the YouTube chat (not an enrolled student in the app). */
export function YouTubeBadge() {
  return (
    <span
      className="shrink-0 px-1.5 py-px rounded bg-red-600/90 text-white text-[9px] font-bold tracking-wide"
      title="Answered in the YouTube chat"
    >
      YouTube
    </span>
  );
}

/** True if a realtime payload is a usable leaderboard. */
export function isPublishedLeaderboard(data: unknown): data is PublishedLeaderboard {
  return Boolean(data && Array.isArray((data as PublishedLeaderboard).rankings));
}

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * The quiz leaderboard the teacher publishes — shown to the students AND the
 * teacher, closing itself after `durationSec`. A compact card in the corner
 * (it used to darken the whole screen and hide the board), which can be
 * folded down to a small chip and opened again.
 */
export function LeaderboardPopup({
  leaderboard,
  onClose,
}: {
  leaderboard: PublishedLeaderboard;
  onClose: () => void;
}) {
  const duration = typeof leaderboard.durationSec === "number" && leaderboard.durationSec > 0 ? leaderboard.durationSec : 30;
  const [left, setLeft] = useState(duration);
  const [minimized, setMinimized] = useState(false);

  // Restart the countdown for every new publish (a re-publish replaces the old one).
  useEffect(() => {
    setLeft(duration);
    setMinimized(false);
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [leaderboard, duration]);

  useEffect(() => {
    if (left <= 0) onClose();
  }, [left, onClose]);

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 px-3 py-2 rounded-full bg-[#121420] border border-amber-500/40 text-white text-xs font-bold shadow-xl hover:bg-[#1a1d2e] transition"
        title="Show the leaderboard"
      >
        <span className="material-symbols-outlined text-base text-amber-400">military_tech</span>
        Leaderboard
        <span className="font-mono text-blue-300">{left}s</span>
      </button>
    );
  }

  const top = leaderboard.rankings.slice(0, 3);
  const rest = leaderboard.rankings.slice(3);

  return (
    <div
      className="fixed bottom-4 right-4 z-[70] w-[min(22rem,calc(100vw-2rem))] bg-[#121420] border border-[#2b3046] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh] text-white animate-in fade-in slide-in-from-bottom-2 duration-200"
      role="dialog"
      aria-label="Class quiz leaderboard"
    >
      <div className="px-3 py-2.5 bg-gradient-to-r from-blue-950 via-[#171a2b] to-[#121420] border-b border-[#25283a] flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-amber-400">military_tech</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-xs text-white leading-tight">Class Quiz Leaderboard</h3>
          <p className="text-[10px] text-slate-400 leading-tight">
            {leaderboard.scope === "chapter" ? "Chapter" : "This class"}
            {leaderboard.stats &&
              ` · ${leaderboard.stats.totalParticipants} students · ${leaderboard.stats.totalPolls} questions · ${leaderboard.stats.averageAccuracy}% avg`}
          </p>
        </div>
        <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-mono font-bold">{left}s</span>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Minimize"
        >
          <span className="material-symbols-outlined text-base">remove</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Close Leaderboard"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      <div className="p-2.5 space-y-1.5 overflow-y-auto text-xs">
        {leaderboard.rankings.length === 0 && <p className="text-center text-slate-400 py-4">No answers yet.</p>}
        {top.map((student, i) => (
          <div
            key={student.studentId}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border ${
              i === 0 ? "bg-amber-500/10 border-amber-500/40" : i === 1 ? "bg-slate-400/10 border-slate-400/30" : "bg-amber-700/10 border-amber-700/30"
            }`}
          >
            <span className="text-lg leading-none shrink-0" aria-label={`Rank ${student.rank}`}>{MEDALS[i]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white truncate flex items-center gap-1.5">
                <span className="truncate">{student.name}</span>
                {student.source === "YOUTUBE" && <YouTubeBadge />}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                {student.correctCount}/{student.totalAttempted} correct · {(student.avgResponseTimeMs / 1000).toFixed(1)}s avg
              </p>
            </div>
            <span className="font-mono font-black text-emerald-400 shrink-0">{student.accuracyPct}%</span>
          </div>
        ))}
        {rest.map((student) => (
          <div key={student.studentId} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-[#161826]">
            <span className="w-5 text-center font-mono font-bold text-slate-400 shrink-0">{student.rank}</span>
            <span className="flex-1 min-w-0 truncate text-slate-200 flex items-center gap-1.5">
              <span className="truncate">{student.name}</span>
              {student.source === "YOUTUBE" && <YouTubeBadge />}
            </span>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">{student.correctCount}/{student.totalAttempted}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
