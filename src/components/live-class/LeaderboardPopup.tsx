"use client";

import { useEffect, useRef, useState } from "react";

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
      className="shrink-0 px-1 py-px rounded bg-red-600 text-white text-[8px] font-bold tracking-wide leading-none"
      title="Answered in the YouTube chat"
    >
      YT
    </span>
  );
}

/** True if a realtime payload is a usable leaderboard. */
export function isPublishedLeaderboard(data: unknown): data is PublishedLeaderboard {
  return Boolean(data && Array.isArray((data as PublishedLeaderboard).rankings));
}

/**
 * Athletic Victory Podium Leaderboard for live class quizzes.
 * Floats on the display (movable/draggable anywhere by pointer/touch),
 * presents Top 3 on an Olympic/athletic victory podium (2nd on left, 1st elevated in center with crown, 3rd on right),
 * and lists subsequent ranks below in a compact scrollable list.
 *
 * CRITICAL REQUIREMENTS:
 * 1. Remains open until closed via (X). No auto-close timer.
 * 2. Displays the individual student's own actual rank even if outside the top 10.
 */
export function LeaderboardPopup({
  leaderboard,
  onClose,
  currentStudentId,
  currentStudentName,
}: {
  leaderboard: PublishedLeaderboard;
  onClose: () => void;
  currentStudentId?: string;
  currentStudentName?: string;
}) {
  const [minimized, setMinimized] = useState(false);

  // Drag state for moving over the screen/display
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !pos) {
      const cardWidth = Math.min(340, window.innerWidth - 24);
      const x = Math.max(12, Math.round((window.innerWidth - cardWidth) / 2));
      const y = Math.max(64, Math.round(window.innerHeight * 0.1));
      setPos({ x, y });
    }
  }, [pos]);

  useEffect(() => {
    setMinimized(false);
  }, [leaderboard]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (!pos) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const maxX = Math.max(12, window.innerWidth - 100);
    const maxY = Math.max(12, window.innerHeight - 80);
    setPos({
      x: Math.max(8, Math.min(maxX, dragRef.current.initX + dx)),
      y: Math.max(8, Math.min(maxY, dragRef.current.initY + dy)),
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  if (minimized) {
    return (
      <div
        style={pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="fixed z-[85] flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121420]/95 backdrop-blur-md border border-amber-500/50 text-white text-xs font-bold shadow-2xl cursor-move touch-none select-none animate-in fade-in duration-150"
      >
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-1.5 hover:text-amber-300 transition cursor-pointer"
          title="Maximize Leaderboard"
        >
          <span className="material-symbols-outlined text-base text-amber-400">military_tech</span>
          <span>Leaderboard</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-0.5 transition cursor-pointer"
          title="Close Leaderboard"
        >
          <span className="material-symbols-outlined text-xs">close</span>
        </button>
      </div>
    );
  }

  const rankings = leaderboard.rankings || [];
  const rank1 = rankings[0];
  const rank2 = rankings[1];
  const rank3 = rankings[2];
  const rest = rankings.slice(3);

  // Find current student's actual individual rank
  const myRankItem = (currentStudentId || currentStudentName)
    ? rankings.find(
        (r) =>
          (currentStudentId && (r.studentId === currentStudentId || (r as any).userId === currentStudentId)) ||
          (currentStudentName && r.name.toLowerCase() === currentStudentName.toLowerCase())
      )
    : null;

  return (
    <div
      style={pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : undefined}
      className="fixed z-[85] w-[min(22rem,calc(100vw-1.5rem))] bg-[#121420]/95 backdrop-blur-md border border-[#2e344e] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-white animate-in fade-in zoom-in-95 duration-150 select-none"
      role="dialog"
      aria-label="Class quiz leaderboard"
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="px-3 py-2 bg-gradient-to-r from-blue-950/90 via-[#171a2b] to-[#121420] border-b border-[#25283a] flex items-center gap-2 cursor-grab active:cursor-grabbing touch-none"
      >
        <span className="material-symbols-outlined text-base text-amber-400">military_tech</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-xs text-white leading-tight">Quiz Leaderboard</h3>
            <span className="material-symbols-outlined text-[13px] text-slate-500" title="Drag to move anywhere">drag_indicator</span>
          </div>
          <p className="text-[9px] text-slate-400 leading-tight truncate">
            {leaderboard.stats
              ? `${leaderboard.stats.totalParticipants} students · ${leaderboard.stats.averageAccuracy}% avg`
              : `${rankings.length} participants`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Minimize"
        >
          <span className="material-symbols-outlined text-xs">remove</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Close (X)"
        >
          <span className="material-symbols-outlined text-xs">close</span>
        </button>
      </div>

      {/* HIGHLIGHTED SECTION: Display Individual Student's Actual Rank */}
      <div className="px-3 pt-2.5 pb-1 bg-[#141829] border-b border-[#20253d]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-blue-950/90 to-indigo-950/90 border border-blue-500/40 text-xs shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-mono font-black text-xs shrink-0 shadow-xs">
              {myRankItem ? `YOUR RANK: #${myRankItem.rank}` : "YOUR RANK"}
            </span>
            <span className="truncate font-bold text-white text-xs">
              {myRankItem ? myRankItem.name : currentStudentName || "You"}
            </span>
          </div>
          {myRankItem ? (
            <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
              <span className="text-emerald-400 font-bold">{myRankItem.accuracyPct}%</span>
              <span className="text-slate-400">({myRankItem.correctCount}/{myRankItem.totalAttempted})</span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 italic shrink-0">
              Not ranked in this quiz
            </span>
          )}
        </div>
      </div>

      {rankings.length === 0 ? (
        <div className="p-6 text-center text-slate-400 text-xs">No answers submitted yet.</div>
      ) : (
        <div className="flex flex-col overflow-hidden">
          {/* Athletic Victory Podium for Top 3 */}
          <div className="px-3 pt-3 pb-2 bg-gradient-to-b from-[#181c2f]/60 to-[#0e101a]/80 border-b border-[#202438]">
            <div className="flex items-end justify-center gap-2 text-center">
              {/* Rank 2 (Silver) - Left */}
              <div className="flex-1 flex flex-col items-center min-w-0">
                {rank2 ? (
                  <>
                    <div className="w-9 h-9 rounded-full bg-slate-700 border-2 border-slate-300 flex items-center justify-center font-bold text-xs text-white shadow-md relative mb-1">
                      {rank2.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rank2.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        rank2.name.charAt(0).toUpperCase()
                      )}
                      <span className="absolute -bottom-1 -right-1 text-xs">🥈</span>
                    </div>
                    <p className="w-full truncate text-[11px] font-semibold text-slate-200 leading-tight">
                      {rank2.name}
                    </p>
                    {rank2.source === "YOUTUBE" && <YouTubeBadge />}
                    <span className="text-[10px] font-mono font-bold text-slate-300 mb-1">
                      {rank2.accuracyPct}%
                    </span>
                    {/* Podium Step 2 */}
                    <div className="w-full h-14 rounded-t-lg bg-gradient-to-t from-slate-700 to-slate-500/80 border-t-2 border-slate-300 flex flex-col items-center justify-center shadow-lg">
                      <span className="text-xl font-black text-slate-100 leading-none">2</span>
                      <span className="text-[8px] uppercase tracking-wider text-slate-300 font-bold">Silver</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-14 rounded-t-lg bg-slate-800/30 border-t border-slate-700/50 flex items-center justify-center text-slate-600 text-xs">
                    -
                  </div>
                )}
              </div>

              {/* Rank 1 (Gold) - Center (Elevated with Crown) */}
              <div className="flex-1 flex flex-col items-center min-w-0">
                {rank1 ? (
                  <>
                    {/* Crown on top */}
                    <span className="text-base leading-none -mb-1 animate-bounce duration-1000 select-none">👑</span>
                    <div className="w-11 h-11 rounded-full bg-amber-500/30 border-2 border-amber-400 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/30 flex items-center justify-center font-black text-sm text-amber-200 relative mb-1">
                      {rank1.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rank1.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        rank1.name.charAt(0).toUpperCase()
                      )}
                      <span className="absolute -bottom-1 -right-1 text-sm">🥇</span>
                    </div>
                    <p className="w-full truncate text-xs font-black text-amber-200 leading-tight">
                      {rank1.name}
                    </p>
                    {rank1.source === "YOUTUBE" && <YouTubeBadge />}
                    <span className="text-[11px] font-mono font-black text-amber-300 mb-1">
                      {rank1.accuracyPct}%
                    </span>
                    {/* Podium Step 1 (Highest) */}
                    <div className="w-full h-20 rounded-t-lg bg-gradient-to-t from-amber-700/90 via-amber-600/90 to-amber-400 border-t-2 border-amber-200 flex flex-col items-center justify-center shadow-xl shadow-amber-500/20">
                      <span className="text-2xl font-black text-slate-950 leading-none">1</span>
                      <span className="text-[8px] uppercase tracking-wider text-slate-900 font-black">Gold</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-20 rounded-t-lg bg-slate-800/30 border-t border-slate-700/50 flex items-center justify-center text-slate-600 text-xs">
                    -
                  </div>
                )}
              </div>

              {/* Rank 3 (Bronze) - Right */}
              <div className="flex-1 flex flex-col items-center min-w-0">
                {rank3 ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-amber-950 border-2 border-amber-700 flex items-center justify-center font-bold text-xs text-amber-300 shadow-md relative mb-1">
                      {rank3.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rank3.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        rank3.name.charAt(0).toUpperCase()
                      )}
                      <span className="absolute -bottom-1 -right-1 text-xs">🥉</span>
                    </div>
                    <p className="w-full truncate text-[11px] font-semibold text-slate-300 leading-tight">
                      {rank3.name}
                    </p>
                    {rank3.source === "YOUTUBE" && <YouTubeBadge />}
                    <span className="text-[10px] font-mono font-bold text-amber-400 mb-1">
                      {rank3.accuracyPct}%
                    </span>
                    {/* Podium Step 3 (Lowest) */}
                    <div className="w-full h-10 rounded-t-lg bg-gradient-to-t from-amber-950 to-amber-800/90 border-t-2 border-amber-600 flex flex-col items-center justify-center shadow">
                      <span className="text-lg font-black text-amber-200 leading-none">3</span>
                      <span className="text-[8px] uppercase tracking-wider text-amber-300/80 font-bold">Bronze</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-10 rounded-t-lg bg-slate-800/30 border-t border-slate-700/50 flex items-center justify-center text-slate-600 text-xs">
                    -
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subsequent Ranks (4, 5, 6...) */}
          {rest.length > 0 && (
            <div className="p-2 space-y-1 overflow-y-auto max-h-40 text-xs scrollbar-thin">
              <div className="px-1 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Other Ranks</span>
                <span>Accuracy</span>
              </div>
              {rest.map((student) => (
                <div
                  key={student.studentId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#161928]/80 hover:bg-[#1a1e32] border border-[#22273d] transition"
                >
                  <span className="w-5 text-center font-mono font-bold text-slate-400 text-[11px] shrink-0">
                    #{student.rank}
                  </span>
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="truncate text-slate-200 text-xs">{student.name}</span>
                    {student.source === "YOUTUBE" && <YouTubeBadge />}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0">
                    {student.accuracyPct}%
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono shrink-0">
                    {student.correctCount}/{student.totalAttempted}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
