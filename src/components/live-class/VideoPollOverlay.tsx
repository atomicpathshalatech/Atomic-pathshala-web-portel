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
  const [isLandscape, setIsLandscape] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Detect orientation (Portrait vs Landscape)
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === "undefined") return;
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth >= 640);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // Position initialized near bottom above video controls
  useEffect(() => {
    if (!pos && typeof window !== "undefined") {
      const cardW = isLandscape ? 360 : 310;
      setPos({
        x: Math.max(12, Math.floor((window.innerWidth - cardW) / 2)),
        y: Math.max(60, window.innerHeight - (isLandscape ? 210 : 280)),
      });
    }
  }, [pos, isLandscape]);

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
    const newX = Math.max(8, Math.min(window.innerWidth - 260, dragRef.current.origX + dx));
    const newY = Math.max(8, Math.min(window.innerHeight - 100, dragRef.current.origY + dy));
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

  // Synchronize countdown timer with server startedAt + timeLimitSec
  useEffect(() => {
    if (!poll || poll.status !== "ACTIVE") {
      setRemainingSec(0);
      return;
    }

    const calculateRemaining = () => {
      const startMs = new Date(poll.startedAt).getTime();
      const nowMs = Date.now();
      const elapsedSec = Math.floor((nowMs - startMs) / 1000);
      return Math.max(0, poll.timeLimitSec - elapsedSec);
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
  }, [poll?.startedAt, poll?.timeLimitSec, poll?.status]);

  // NOTE: Auto-dismiss removed! Results stay visible indefinitely until dismissed by teacher.

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

  // Minimized pill state
  if (isMinimized) {
    return (
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : { right: "16px", bottom: "80px" }}
        className="fixed z-[75] flex items-center gap-1.5 select-none cursor-move animate-in fade-in zoom-in-95"
        data-poll-id={poll.id}
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 hover:bg-slate-800 text-white text-xs font-bold shadow-2xl border border-blue-500/60 backdrop-blur-md transition-all active:scale-95"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>
            {isRevealed
              ? "📊 Poll Results"
              : mySelection
              ? `Voted (${remainingSec}s)`
              : `Live Poll (${remainingSec}s)`}
          </span>
          <span className="material-symbols-outlined text-sm">open_in_full</span>
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-7 h-7 rounded-full bg-slate-900/90 hover:bg-rose-900 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 shadow-xl text-xs transition active:scale-95 cursor-pointer"
            title="Minimize to side"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>
    );
  }

  // Floating Card Container (PART 3 & PART 5: Compact card positioned near bottom)
  return (
    <div
      data-poll-id={poll.id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={pos ? { left: `${pos.x}px`, top: `${pos.y}px` } : { bottom: "80px", left: "50%", transform: "translateX(-50%)" }}
      className={`fixed z-[75] ${
        isLandscape ? "w-[360px] max-w-[90vw]" : "w-[310px] max-w-[92vw]"
      } select-none cursor-move bg-[#0b0e17]/95 text-white border-2 border-blue-500/70 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] p-3 flex flex-col gap-2.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-slate-400 text-sm cursor-grab">drag_indicator</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            POLL
          </span>
          {isRevealed ? (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
              ✓ Result Published
            </span>
          ) : isTimeUp ? (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
              Time Expired
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-mono font-bold">
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
                setIsMinimized(true);
              }}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-rose-900/60 transition cursor-pointer"
              title="Minimize pill"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Question Text */}
      {poll.questionText && (
        <p className="text-xs font-semibold text-slate-100 line-clamp-3 px-0.5 leading-snug">
          {poll.questionText}
        </p>
      )}

      {/* Answer Feedback Banner on Reveal */}
      {isRevealed && (
        <div
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between ${
            mySelection === poll.correctOption
              ? "bg-emerald-950/80 border border-emerald-500/60 text-emerald-300"
              : mySelection
              ? "bg-rose-950/80 border border-rose-500/60 text-rose-300"
              : "bg-slate-800/80 border border-slate-700 text-slate-300"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">
              {mySelection === poll.correctOption ? "check_circle" : mySelection ? "cancel" : "info"}
            </span>
            {mySelection === poll.correctOption
              ? "Correct Answer!"
              : mySelection
              ? "Your answer was incorrect"
              : "Results Published"}
          </span>
          {poll.correctOption && (
            <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[11px]">
              Correct: Option {poll.correctOption}
            </span>
          )}
        </div>
      )}

      {/* PART 5: Options Layout - Vertical on Portrait, 2x2 Grid on Landscape */}
      <div className={`grid ${isLandscape ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
        {poll.options.map((opt) => {
          const isSelected = mySelection === opt.key;
          const isCorrect = isRevealed && poll.correctOption === opt.key;
          const isWrong = isRevealed && isSelected && poll.correctOption !== opt.key;
          const percentage = optionPercentages[opt.key];

          let btnStyle = "bg-[#131622] border-slate-800 text-slate-200 hover:border-blue-500/60 hover:bg-[#1a1f30]";
          if (isCorrect) {
            btnStyle = "border-emerald-500 bg-emerald-950/70 text-emerald-100 ring-1 ring-emerald-500/50";
          } else if (isWrong) {
            btnStyle = "border-rose-500 bg-rose-950/70 text-rose-200 ring-1 ring-rose-500/50";
          } else if (isSelected) {
            btnStyle = "border-blue-500 bg-blue-950/90 text-white shadow ring-2 ring-blue-500/50";
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
              className={`relative overflow-hidden min-h-[38px] px-2.5 py-1.5 rounded-xl border text-left font-medium transition-all active:scale-95 disabled:cursor-default flex items-center justify-between gap-2 ${btnStyle}`}
            >
              {/* Vote Percentage progress bar when revealed */}
              {isRevealed && percentage !== undefined && (
                <div
                  className={`absolute inset-0 opacity-25 pointer-events-none transition-all duration-500 ${
                    isCorrect ? "bg-emerald-400" : "bg-blue-500"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}

              <div className="relative z-10 flex items-center gap-2 min-w-0">
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                    isCorrect
                      ? "bg-emerald-500 text-slate-950"
                      : isWrong
                      ? "bg-rose-500 text-white"
                      : isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}
                >
                  {opt.key}
                </span>
                <span className="text-xs font-semibold truncate leading-none">
                  {opt.label !== opt.key ? opt.label : `Option ${opt.key}`}
                </span>
              </div>

              {isRevealed && percentage !== undefined ? (
                <span className="relative z-10 text-xs font-mono font-bold text-slate-200 shrink-0">
                  {percentage}%
                </span>
              ) : isSelected ? (
                <span className="material-symbols-outlined text-sm text-blue-400 shrink-0">
                  check_circle
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Footer Status */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5 pt-0.5">
        {mySelection ? (
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">done_all</span>
            Answer submitted ({mySelection})
          </span>
        ) : isTimeUp ? (
          <span className="text-amber-400">Time expired</span>
        ) : (
          <span className="text-slate-400">Select your answer</span>
        )}

        {isRevealed && totalVotes > 0 && (
          <span className="font-mono text-slate-300">
            {totalVotes} response{totalVotes === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error && (
        <p className="text-[11px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-900/50 rounded-lg p-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
