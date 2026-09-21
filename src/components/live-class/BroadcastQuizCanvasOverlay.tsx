"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";

export type BroadcastQuizOption = {
  key: string;
  label: string;
};

export type BroadcastQuizData = {
  id: string;
  questionText: string | null;
  options: BroadcastQuizOption[];
  timeLimitSec: number;
  status: "ACTIVE" | "REVEALED" | "CLOSED";
  correctOption?: string | null;
  startedAt?: string | null;
};

export type BroadcastQuizCanvasOverlayProps = {
  activeQuiz: BroadcastQuizData;
  quizMetrics: { counts: Record<string, number>; totalResponses: number } | null;
  onReveal?: (chosenCorrectOption?: string) => void;
  onClose?: () => void;
  containerWidth?: number;
  containerHeight?: number;
};

export function BroadcastQuizCanvasOverlay({
  activeQuiz,
  quizMetrics,
  onReveal,
  onClose,
  containerWidth,
  containerHeight,
}: BroadcastQuizCanvasOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number>(activeQuiz.timeLimitSec);
  const [selectedReveal, setSelectedRevealOption] = useState<string>(
    activeQuiz.correctOption || "A"
  );

  // Position state (relative to stage container)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync default position to top-right corner if not yet set
  useEffect(() => {
    if (!pos && containerWidth && containerHeight) {
      const defaultWidth = 360;
      setPos({
        x: Math.max(20, containerWidth - defaultWidth - 28),
        y: 28,
      });
    }
  }, [containerWidth, containerHeight, pos]);

  // Sync selected reveal option if activeQuiz has one
  useEffect(() => {
    if (activeQuiz.correctOption) {
      setSelectedRevealOption(activeQuiz.correctOption);
    }
  }, [activeQuiz.correctOption]);

  // Countdown timer logic
  useEffect(() => {
    if (activeQuiz.status !== "ACTIVE") {
      return;
    }

    const computeTime = () => {
      if (activeQuiz.startedAt) {
        const startMs = new Date(activeQuiz.startedAt).getTime();
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        return Math.max(0, activeQuiz.timeLimitSec - elapsed);
      }
      return null;
    };

    const initial = computeTime();
    if (initial !== null) {
      setRemainingSec(initial);
    } else {
      setRemainingSec(activeQuiz.timeLimitSec);
    }

    const interval = setInterval(() => {
      setRemainingSec((prev) => {
        const accurate = computeTime();
        if (accurate !== null) return accurate;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeQuiz.id, activeQuiz.status, activeQuiz.startedAt, activeQuiz.timeLimitSec]);

  // Pointer drag handling
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
      return;
    }
    e.stopPropagation();
    const currentX = pos?.x ?? 28;
    const currentY = pos?.y ?? 28;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: currentX,
      origY: currentY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = Math.max(10, (containerWidth ? Math.min(containerWidth - 100, dragRef.current.origX + dx) : dragRef.current.origX + dx));
    const newY = Math.max(10, (containerHeight ? Math.min(containerHeight - 80, dragRef.current.origY + dy) : dragRef.current.origY + dy));
    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      e.stopPropagation();
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const totalVotes = quizMetrics?.totalResponses ?? 0;
  const isRevealed = activeQuiz.status === "REVEALED";
  const isTimeUp = remainingSec <= 0 && activeQuiz.status === "ACTIVE";

  const optionPercentages = useMemo(() => {
    const p: Record<string, number> = {};
    activeQuiz.options.forEach((o) => {
      const count = quizMetrics?.counts[o.key] ?? 0;
      p[o.key] = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    });
    return p;
  }, [activeQuiz.options, quizMetrics?.counts, totalVotes]);

  const stylePosition = pos
    ? { left: `${pos.x}px`, top: `${pos.y}px` }
    : { right: "24px", top: "24px" };

  if (isMinimized) {
    return (
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={stylePosition}
        className="absolute z-40 select-none cursor-move animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-950/95 border-2 border-indigo-500/80 text-white shadow-2xl backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold font-mono tracking-tight">
            {isRevealed
              ? "Poll: Answer Revealed"
              : isTimeUp
              ? "Poll: Time's Up"
              : `Poll: ⏳ ${remainingSec}s`}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-mono">
            {totalVotes} {totalVotes === 1 ? "Vote" : "Votes"}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(false);
            }}
            className="p-1 hover:bg-slate-800 rounded-full text-slate-300 hover:text-white transition"
            title="Expand Poll Overlay"
          >
            <span className="material-symbols-outlined text-sm">open_in_full</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={stylePosition}
      className="absolute z-40 select-none w-88 sm:w-96 rounded-2xl bg-[#0a0c16]/95 border-2 border-indigo-500/85 text-white shadow-2xl p-4 flex flex-col gap-3 backdrop-blur-xl animate-in zoom-in-95 fade-in duration-200 cursor-move"
    >
      {/* Broadcast Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-red-600/20 border border-red-500/50 text-red-400 text-[11px] font-black uppercase tracking-wider shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE POLL
          </div>

          {isRevealed ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold shrink-0 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              Revealed
            </span>
          ) : isTimeUp ? (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-bold shrink-0">
              Time&apos;s Up
            </span>
          ) : (
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold shrink-0 border ${
                remainingSec <= 10
                  ? "bg-red-500/20 border-red-500/50 text-red-300 animate-pulse"
                  : "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
              }`}
            >
              ⏳ {remainingSec}s
            </span>
          )}
        </div>

        {/* Action icons: Minimize & Close */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Minimize to Pill"
          >
            <span className="material-symbols-outlined text-base">close_fullscreen</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
              title="Close Poll"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Question Text */}
      <div className="px-0.5 space-y-1.5">
        <h4 className="text-sm font-bold text-slate-100 leading-snug line-clamp-2">
          {activeQuiz.questionText || "Live Quick Quiz (Select Option)"}
        </h4>
        {activeQuiz.status === "ACTIVE" && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg px-2.5 py-1 flex items-center justify-between text-[11px] text-red-200">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              YouTube: Comment <strong>A, B, C, or D</strong> to vote
            </span>
            <span className="text-[10px] text-red-400 font-mono">Live</span>
          </div>
        )}
      </div>

      {/* Options List with Dynamic Vote Percentage Bars */}
      <div className="space-y-2">
        {activeQuiz.options.map((opt) => {
          const count = quizMetrics?.counts[opt.key] ?? 0;
          const pct = optionPercentages[opt.key] || 0;
          const isCorrect = isRevealed && activeQuiz.correctOption === opt.key;

          return (
            <div
              key={opt.key}
              onClick={(e) => {
                e.stopPropagation();
                if (activeQuiz.status === "ACTIVE") {
                  setSelectedRevealOption(opt.key);
                }
              }}
              className={`relative overflow-hidden rounded-xl border p-2.5 transition-all ${
                isCorrect
                  ? "border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-900/20"
                  : "border-slate-800/80 bg-[#101322]/80 hover:border-slate-700"
              }`}
            >
              {/* Dynamic Fill Bar */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${
                  isCorrect
                    ? "bg-emerald-500/30"
                    : "bg-indigo-600/25"
                }`}
                style={{ width: `${pct}%` }}
              />

              {/* Foreground Content */}
              <div className="relative flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-black font-mono text-xs shrink-0 shadow-sm ${
                      isRevealed && activeQuiz.correctOption === opt.key
                        ? "bg-emerald-500 text-slate-950 font-extrabold"
                        : isCorrect && activeQuiz.status === "ACTIVE"
                        ? "bg-emerald-600/80 text-white font-bold"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {opt.key}
                  </span>
                  <span
                    className={`font-semibold truncate ${
                      isRevealed && activeQuiz.correctOption === opt.key
                        ? "text-emerald-200 font-bold"
                        : "text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </span>
                  {isRevealed && activeQuiz.correctOption === opt.key && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[11px]">done</span>
                      Correct
                    </span>
                  )}
                </div>

                {/* Percentage & Count Badge */}
                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                  <span
                    className={`text-xs font-bold ${
                      isRevealed && activeQuiz.correctOption === opt.key
                        ? "text-emerald-300"
                        : "text-slate-200"
                    }`}
                  >
                    {pct}%
                  </span>
                  <span className="text-[10px] text-slate-400">({count})</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Stats & Quick Reveal Controls */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
          <span className="material-symbols-outlined text-sm text-indigo-400">how_to_vote</span>
          <span>
            Total Votes: <strong className="text-white">{totalVotes}</strong>
          </span>
        </div>

        {/* Quick Teacher Actions on Canvas */}
        {activeQuiz.status === "ACTIVE" && onReveal && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReveal(selectedReveal);
            }}
            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-md shadow-emerald-700/20 active:scale-95 transition"
          >
            <span className="material-symbols-outlined text-xs">visibility</span>
            Reveal ({selectedReveal})
          </button>
        )}

        {isRevealed && onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 transition"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
