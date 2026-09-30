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

/**
 * The quiz leaderboard the teacher publishes — shown as the same popup to
 * the students AND the teacher, closing itself after `durationSec`.
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

  // Restart the countdown for every new publish (a re-publish replaces the old one).
  useEffect(() => {
    setLeft(duration);
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [leaderboard, duration]);

  useEffect(() => {
    if (left <= 0) onClose();
  }, [left, onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-label="Class quiz leaderboard"
    >
      <div className="bg-[#121420] border border-[#2b3046] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white">
        <div className="px-5 py-4 bg-gradient-to-r from-blue-950 via-[#171a2b] to-[#121420] border-b border-[#25283a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow">
              <span className="material-symbols-outlined text-xl">military_tech</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Class Quiz Leaderboard</h3>
              <p className="text-[11px] text-slate-400">
                {leaderboard.scope === "chapter" ? "Chapter Progression" : "Live Session Performance"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-mono font-bold">
              <span className="material-symbols-outlined text-xs">timelapse</span>
              <span>{left}s</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close Leaderboard"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {leaderboard.stats && (
          <div className="px-5 py-2 bg-[#0c0d15] border-b border-[#1f2233] flex items-center justify-between text-xs text-slate-400">
            <span>{leaderboard.stats.totalParticipants} Students</span>
            <span>{leaderboard.stats.totalPolls} Questions</span>
            <span className="text-emerald-400 font-bold">{leaderboard.stats.averageAccuracy}% Class Avg</span>
          </div>
        )}

        <div className="p-4 space-y-2 overflow-y-auto flex-1 text-xs">
          {leaderboard.rankings.length === 0 && (
            <p className="text-center text-slate-400 py-6">No answers yet.</p>
          )}
          {leaderboard.rankings.map((student) => {
            const medal = student.rank === 1 ? "🥇" : student.rank === 2 ? "🥈" : student.rank === 3 ? "🥉" : null;
            return (
              <div
                key={student.studentId}
                className={`flex items-center justify-between p-3 rounded-xl border transition ${
                  student.rank === 1
                    ? "bg-gradient-to-r from-amber-500/15 via-[#181a28] to-[#121420] border-amber-500/40 shadow-sm"
                    : student.rank === 2
                    ? "bg-gradient-to-r from-slate-400/10 via-[#181a28] to-[#121420] border-slate-400/30"
                    : student.rank === 3
                    ? "bg-gradient-to-r from-amber-700/10 via-[#181a28] to-[#121420] border-amber-700/30"
                    : "bg-[#161826] border-[#25283a]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center font-black font-mono text-xs shrink-0 bg-black/40 border border-white/10">
                    {medal || student.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                      <span className="truncate">{student.name}</span>
                      {student.source === "YOUTUBE" && <YouTubeBadge />}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {student.correctCount}/{student.totalAttempted} correct · {(student.avgResponseTimeMs / 1000).toFixed(1)}s avg
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-black text-emerald-400 shrink-0">{student.accuracyPct}%</span>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-[#0d0f17] border-t border-[#1f2233] flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Auto-closing in {left}s</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
