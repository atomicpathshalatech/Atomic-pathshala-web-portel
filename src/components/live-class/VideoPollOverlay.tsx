"use client";

import { useState, useEffect, useMemo, useRef, type PointerEvent } from "react";

export type VideoPollOption = {
  key: string;
  label: string;
};

export type VideoPollData = {
  id: string;
  questionText: string;
  options: VideoPollOption[];
  correctOption?: string;
  timeLimitSec: number;
  startedAt: string;
  status: "ACTIVE" | "REVEALED" | "ENDED";
  counts?: Record<string, number>;
  totalVotes?: number;
  mySelection?: string | null;
};

export type VideoPollOverlayProps = {
  poll: VideoPollData | null;
  onVote: (optionKey: string) => Promise<void> | void;
  onDismiss?: () => void;
  voting?: boolean;
  fixedLayer?: boolean;
  error?: string | null;
};

export function VideoPollOverlay({
  poll,
  onVote,
  onDismiss,
  voting = false,
  error = null,
}: VideoPollOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Position initialized nicely on screen (upper-right floating area)
  useEffect(() => {
    if (!pos && typeof window !== "undefined") {
      setPos({
        x: Math.max(12, window.innerWidth - 260),
        y: Math.max(60, Math.floor(window.innerHeight * 0.12)),
      });
    }
  }, [pos]);

  // Pointer drag handling
  const handlePointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    e.stopPropagation();
    const currentX = pos?.x ?? 20;
    const currentY = pos?.y ?? 60;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: currentX,
      origY: currentY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragRef.current || typeof window === "undefined") return;
    e.stopPropagation();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const newX = Math.max(8, Math.min(window.innerWidth - 250, dragRef.current.origX + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - 140, dragRef.current.origY + dy));
    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (dragRef.current) {
      e.stopPropagation();
      dragRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Calculate countdown timer
  useEffect(() => {
    if (!poll || poll.status !== "ACTIVE") {
      setRemainingSec(0);
      return;
    }

    const calculateRemaining = () => {
      const startMs = new Date(poll.startedAt).getTime();
      const nowMs = Date.now();
      const elapsedSec = Math.floor((nowMs - startMs) / 1000);
      const left = Math.max(0, poll.timeLimitSec - elapsedSec);
      return left;
    };

    setRemainingSec(calculateRemaining());

    const timer = setInterval(() => {
      const left = calculateRemaining();
      setRemainingSec(left);
      if (left <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [poll]);

  // Auto-dismiss 6s after revealed so results don't block display
  useEffect(() => {
    if (poll?.status === "REVEALED") {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [poll?.status, onDismiss]);

  // Reset minimized when a new poll arrives
  useEffect(() => {
    if (poll?.id) {
      setIsMinimized(false);
    }
  }, [poll?.id]);

  const totalVotes = poll?.totalVotes || 0;
  const pollCounts = poll?.counts;
  const optionPercentages = useMemo(() => {
    const p: Record<string, number> = {};
    if (!pollCounts || totalVotes === 0) return p;
    for (const [key, count] of Object.entries(pollCounts)) {
      p[key] = Math.round((count / totalVotes) * 100);
    }
    return p;
  }, [pollCounts, totalVotes]);

  if (!poll || poll.status === "ENDED") {
    return null;
  }

  const isRevealed = poll.status === "REVEALED";
  const mySelection = poll.mySelection;
  const isTimeUp = remainingSec <= 0 && poll.status === "ACTIVE";

  // Minimized pill state (movable)
  if (isMinimized) {
    return (
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : { right: "12px", top: "70px" }}
        className="fixed z-[75] flex items-center gap-1 select-none cursor-move animate-in fade-in zoom-in-95"
        data-poll-id={poll.id}
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-900/95 hover:bg-slate-800 text-white text-[11px] font-bold shadow-xl border border-amber-500/60 backdrop-blur-md transition-all active:scale-95"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>
            {isRevealed
              ? "Result"
              : mySelection
              ? `Voted (${remainingSec}s)`
              : `Poll (${remainingSec}s)`}
          </span>
          <span className="material-symbols-outlined text-xs">open_in_full</span>
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-6 h-6 rounded-full bg-slate-900/90 hover:bg-rose-900 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 shadow-xl text-xs transition active:scale-95 cursor-pointer"
            title="Dismiss poll"
          >
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        )}
      </div>
    );
  }

  // 1/4th Compact Size Card with Draggable Header
  return (
    <div
      data-poll-id={poll.id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : { right: "12px", top: "70px" }}
      className="fixed z-[75] w-60 sm:w-64 select-none cursor-move bg-[#0c0e18]/95 text-white border-2 border-indigo-500/80 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-2.5 flex flex-col gap-2 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header with Drag Grip, Timer & Actions */}
      <div className="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-slate-400 text-sm cursor-grab">drag_indicator</span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            POLL
          </span>
          {isRevealed ? (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              Revealed
            </span>
          ) : isTimeUp ? (
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
              Time Up
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
              ⏳ {remainingSec}s
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
            title="Minimize"
          >
            <span className="material-symbols-outlined text-sm">remove</span>
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-rose-900/60 transition cursor-pointer"
              title="Close"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Question Text (Compact 1-2 lines) */}
      {poll.questionText && (
        <p className="text-[11px] font-medium text-slate-200 line-clamp-2 px-0.5 leading-snug">
          {poll.questionText}
        </p>
      )}

      {/* Answer Feedback Banner on Reveal */}
      {isRevealed && (
        <div
          className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-between ${
            mySelection === poll.correctOption
              ? "bg-emerald-950/80 border border-emerald-500/60 text-emerald-300"
              : mySelection
              ? "bg-rose-950/80 border border-rose-500/60 text-rose-300"
              : "bg-slate-800 border border-slate-700 text-slate-300"
          }`}
        >
          <span>
            {mySelection === poll.correctOption ? "🎉 Correct!" : mySelection ? "❌ Wrong" : "Ended"}
          </span>
          {poll.correctOption && (
            <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 font-black">
              Ans: {poll.correctOption}
            </span>
          )}
        </div>
      )}

      {/* Options Grid (Super Compact 2x2 layout) */}
      <div className={`grid ${poll.options.length <= 4 ? "grid-cols-2" : "grid-cols-1"} gap-1.5`}>
        {poll.options.map((opt) => {
          const isSelected = mySelection === opt.key;
          const isCorrect = isRevealed && poll.correctOption === opt.key;
          const isWrong = isRevealed && isSelected && poll.correctOption !== opt.key;
          const percentage = optionPercentages[opt.key];

          let btnBg = "bg-slate-900/90 border-slate-700/80 text-slate-200 hover:bg-slate-800";
          if (isCorrect) {
            btnBg = "border-emerald-400 bg-emerald-900/70 text-emerald-100 shadow-sm";
          } else if (isWrong) {
            btnBg = "border-rose-500 bg-rose-950/70 text-rose-200";
          } else if (isSelected) {
            btnBg = "border-indigo-400 bg-indigo-950/90 text-white shadow ring-2 ring-indigo-500/50";
          }

          return (
            <button
              key={opt.key}
              type="button"
              disabled={Boolean(mySelection) || isRevealed || isTimeUp || voting}
              onClick={(e) => {
                e.stopPropagation();
                onVote(opt.key);
              }}
              className={`relative overflow-hidden h-9 px-2 rounded-xl border text-left font-medium transition-all active:scale-95 disabled:cursor-default flex items-center justify-between gap-1.5 ${btnBg}`}
            >
              {/* Vote Percentage background fill when revealed */}
              {isRevealed && percentage !== undefined && (
                <div
                  className={`absolute inset-0 opacity-25 pointer-events-none transition-all duration-500 ${
                    isCorrect ? "bg-emerald-400" : "bg-indigo-400"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}

              <div className="relative z-10 flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-black text-[11px] shrink-0 ${
                    isCorrect
                      ? "bg-emerald-500 text-slate-950"
                      : isWrong
                      ? "bg-rose-500 text-white"
                      : isSelected
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {opt.key}
                </span>
                <span className="text-[11px] font-semibold truncate leading-none">
                  {opt.label !== opt.key ? opt.label : `Opt ${opt.key}`}
                </span>
              </div>

              {isRevealed && percentage !== undefined ? (
                <span className="relative z-10 text-[10px] font-mono font-bold text-slate-300 shrink-0">
                  {percentage}%
                </span>
              ) : isSelected ? (
                <span className="material-symbols-outlined text-xs text-indigo-400 shrink-0">
                  check
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Compact Footer Status */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5 pt-0.5">
        {mySelection ? (
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">done</span>
            Voted ({mySelection})
          </span>
        ) : isTimeUp ? (
          <span className="text-amber-400">Time expired</span>
        ) : (
          <span className="text-slate-400">Tap to answer</span>
        )}

        {isRevealed && totalVotes > 0 && (
          <span className="font-mono text-slate-400">
            {totalVotes} vote{totalVotes === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {error && <p className="text-[10px] font-semibold text-rose-400">{error}</p>}
    </div>
  );
}
