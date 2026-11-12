"use client";

import React, { useState, useEffect, useMemo, useRef, type PointerEvent } from "react";

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
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [localSelection, setLocalSelection] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Restore persisted student vote from localStorage on mount / poll change
  useEffect(() => {
    if (!poll?.id) {
      setLocalSelection(null);
      setPendingSelection(null);
      setIsMinimized(false);
      return;
    }
    try {
      const persisted = localStorage.getItem(`atomic_poll_vote_${poll.id}`);
      if (persisted) {
        setLocalSelection(persisted);
        setPendingSelection(persisted);
      } else if (poll.mySelection) {
        setLocalSelection(poll.mySelection);
        setPendingSelection(poll.mySelection);
      } else {
        setLocalSelection(null);
        setPendingSelection(null);
      }
    } catch {
      setLocalSelection(poll.mySelection || null);
      setPendingSelection(poll.mySelection || null);
    }
  }, [poll?.id, poll?.mySelection]);

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

  // Compute compact card dimensions (~25% viewport footprint)
  const cardWidth = useMemo(() => {
    if (typeof window === "undefined") return 270;
    return Math.min(280, Math.max(250, Math.round(window.innerWidth * 0.25)));
  }, [isLandscape]);

  // Position initialized safely on screen (default right side or bottom right)
  useEffect(() => {
    if (!pos && typeof window !== "undefined") {
      setPos({
        x: Math.max(12, window.innerWidth - cardWidth - 20),
        y: Math.max(70, Math.min(180, Math.floor(window.innerHeight * 0.2))),
      });
    }
  }, [pos, cardWidth]);

  // Reset bounds on window resize
  useEffect(() => {
    if (pos && typeof window !== "undefined") {
      const maxX = Math.max(8, window.innerWidth - cardWidth - 8);
      const maxY = Math.max(8, window.innerHeight - 100);
      if (pos.x > maxX || pos.y > maxY) {
        setPos({
          x: Math.min(pos.x, maxX),
          y: Math.min(pos.y, maxY),
        });
      }
    }
  }, [cardWidth, pos]);

  // Dedicated header drag handling
  const handleHeaderPointerDown = (e: PointerEvent<HTMLDivElement>) => {
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

  const handleHeaderPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || typeof window === "undefined") return;
    e.stopPropagation();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const maxX = Math.max(8, window.innerWidth - cardWidth - 8);
    const maxY = Math.max(8, window.innerHeight - 80);
    const newX = Math.max(8, Math.min(maxX, dragRef.current.origX + dx));
    const newY = Math.max(8, Math.min(maxY, dragRef.current.origY + dy));
    setPos({ x: newX, y: newY });
  };

  const handleHeaderPointerUp = (e: PointerEvent<HTMLDivElement>) => {
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
  const mySelection = localSelection || poll.mySelection || null;
  const isTimeUp = remainingSec <= 0 && poll.status === "ACTIVE";
  const hasSubmitted = Boolean(mySelection);

  // If student minimized, show a persistent floating recoverable pill
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: "fixed",
          top: pos ? `${pos.y}px` : "75px",
          right: "16px",
          zIndex: 9999,
          pointerEvents: "auto",
        }}
        className="cursor-pointer bg-[#0a0d18]/95 hover:bg-[#14192d] border border-blue-500/80 text-white px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold transition-transform transform hover:scale-105 active:scale-95 select-none backdrop-blur-md"
        title="Click to restore active poll"
      >
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span>📊 Poll</span>
        {!isRevealed && !isTimeUp && (
          <span className="font-mono text-blue-300">⏳ {remainingSec}s</span>
        )}
        {isRevealed && <span className="text-emerald-400 text-[10px]">Result</span>}
        <span className="text-slate-400 text-[10px] underline ml-0.5">Open</span>
      </div>
    );
  }

  const handleConfirmSubmit = () => {
    if (!pendingSelection || hasSubmitted || isRevealed || isTimeUp || voting) return;
    setLocalSelection(pendingSelection);
    try {
      if (poll?.id) {
        localStorage.setItem(`atomic_poll_vote_${poll.id}`, pendingSelection);
      }
    } catch {}
    onVote(pendingSelection);
  };

  return (
    <div
      ref={cardRef}
      data-poll-id={poll.id}
      style={{
        width: `${cardWidth}px`,
        pointerEvents: "auto",
        zIndex: 9999,
        ...(pos
          ? { left: `${pos.x}px`, top: `${pos.y}px` }
          : { top: "15%", right: "20px" }),
      }}
      className="fixed select-none bg-[#0a0d18]/95 text-white border-2 border-blue-500/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-2.5 flex flex-col gap-2 backdrop-blur-xl"
    >
      {/* Header Bar - Dedicated Drag Handle */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className="flex items-center justify-between gap-1 border-b border-slate-800/80 pb-1 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-slate-400 text-xs">drag_indicator</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            LIVE POLL
          </span>

          {isRevealed ? (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold shrink-0">
              Result
            </span>
          ) : isTimeUp ? (
            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[9px] font-bold shrink-0">
              Expired
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[9px] font-mono font-bold shrink-0">
              ⏳ {remainingSec}s
            </span>
          )}
        </div>

        {/* Action buttons: Minimize and Dismiss */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="w-5 h-5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center cursor-pointer shrink-0"
            title="Minimize poll to floating pill"
          >
            <span className="material-symbols-outlined text-xs">minimize</span>
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!hasSubmitted && !isRevealed && !isTimeUp) {
                  setIsMinimized(true);
                } else {
                  onDismiss();
                }
              }}
              className="w-5 h-5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center cursor-pointer shrink-0"
              title="Close"
            >
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Question Text */}
      {poll.questionText && (
        <p className="text-[11px] font-semibold text-slate-100 line-clamp-2 px-0.5 leading-tight">
          {poll.questionText}
        </p>
      )}

      {/* Answer Feedback Banner on Reveal */}
      {isRevealed && (
        <div
          className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center justify-between transition-all ${
            mySelection === poll.correctOption
              ? "bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 shadow-sm"
              : mySelection
              ? "bg-rose-950/80 border border-rose-500/60 text-rose-300 shadow-sm"
              : "bg-slate-800/80 border border-slate-700 text-slate-300"
          }`}
        >
          <span className="flex items-center gap-1 truncate">
            <span className="material-symbols-outlined text-xs">
              {mySelection === poll.correctOption ? "check_circle" : mySelection ? "cancel" : "info"}
            </span>
            {mySelection === poll.correctOption
              ? "Correct!"
              : mySelection
              ? `Incorrect (Chose ${mySelection})`
              : "Results Published"}
          </span>
          {poll.correctOption && (
            <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 font-black text-[9px] shrink-0">
              Ans: {poll.correctOption}
            </span>
          )}
        </div>
      )}

      {/* Options List */}
      <div className="grid grid-cols-1 gap-1.5">
        {poll.options.map((opt) => {
          const isSelected = (mySelection || pendingSelection) === opt.key;
          const isConfirmed = mySelection === opt.key;
          const isCorrect = isRevealed && poll.correctOption === opt.key;
          const isWrong = isRevealed && isConfirmed && poll.correctOption !== opt.key;
          const percentage = optionPercentages[opt.key];

          let btnStyle = "bg-[#141828] border-slate-800 text-slate-200 hover:border-blue-500/60 hover:bg-[#1a2035] cursor-pointer";
          if (isCorrect) {
            btnStyle = "border-emerald-500 bg-emerald-950/80 text-emerald-100 ring-1 ring-emerald-500/60 cursor-default";
          } else if (isWrong) {
            btnStyle = "border-rose-500 bg-rose-950/80 text-rose-200 ring-1 ring-rose-500/60 cursor-default";
          } else if (isConfirmed) {
            btnStyle = "border-blue-500 bg-blue-950/90 text-white shadow ring-2 ring-blue-500/60 cursor-default";
          } else if (isSelected) {
            btnStyle = "border-blue-400 bg-blue-900/50 text-white ring-1 ring-blue-400";
          } else if (hasSubmitted || isTimeUp || isRevealed) {
            btnStyle = "bg-[#141828]/60 border-slate-800/60 text-slate-400 cursor-default";
          }

          return (
            <button
              key={opt.key}
              type="button"
              disabled={hasSubmitted || isRevealed || isTimeUp || voting}
              style={{ touchAction: "manipulation", pointerEvents: "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                if (!hasSubmitted && !isRevealed && !isTimeUp) {
                  setPendingSelection(opt.key);
                }
              }}
              className={`relative overflow-hidden min-h-[30px] px-2 py-1 rounded-xl border text-left font-medium transition-all active:scale-95 disabled:pointer-events-none flex items-center justify-between gap-1.5 ${btnStyle}`}
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

              <div className="relative z-10 flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center font-mono font-black text-[10px] shrink-0 ${
                    isCorrect
                      ? "bg-emerald-500 text-slate-950"
                      : isWrong
                      ? "bg-rose-500 text-white"
                      : isConfirmed || isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}
                >
                  {opt.key}
                </span>
                <span className="text-[11px] font-semibold truncate leading-none">
                  {opt.label !== opt.key ? opt.label : `Option ${opt.key}`}
                </span>
              </div>

              {isRevealed && percentage !== undefined ? (
                <span className="relative z-10 text-[10px] font-mono font-bold text-slate-200 shrink-0">
                  {percentage}%
                </span>
              ) : isConfirmed ? (
                <span className="material-symbols-outlined text-xs text-blue-400 shrink-0">
                  check_circle
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Submit Button (Step 2 of selection flow) */}
      {!hasSubmitted && !isRevealed && !isTimeUp && (
        <button
          type="button"
          disabled={!pendingSelection || voting}
          onClick={handleConfirmSubmit}
          className={`w-full py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md ${
            pendingSelection && !voting
              ? "bg-blue-600 hover:bg-blue-500 text-white active:scale-95 cursor-pointer"
              : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
          }`}
        >
          {voting ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Submitting…</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">send</span>
              <span>Submit Answer {pendingSelection ? `(${pendingSelection})` : ""}</span>
            </>
          )}
        </button>
      )}

      {/* Footer Status Message */}
      <div className="flex items-center justify-between text-[9px] text-slate-400 px-0.5 pt-0.5">
        {hasSubmitted && !isRevealed ? (
          <span className="text-blue-400 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">check</span>
            Submitted ({mySelection}) · Awaiting result
          </span>
        ) : isRevealed ? (
          <span className="text-slate-300 font-medium">
            Votes: {totalVotes}
          </span>
        ) : isTimeUp ? (
          <span className="text-rose-400 font-medium">
            Time expired
          </span>
        ) : (
          <span className="text-slate-400">
            Tap option then Submit
          </span>
        )}

        {error && <span className="text-rose-400 font-semibold">{error}</span>}
      </div>
    </div>
  );
}
