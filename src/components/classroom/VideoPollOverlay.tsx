"use client";

import React, { useState, useEffect, useMemo } from "react";

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
};

export function VideoPollOverlay({
  poll,
  onVote,
  onDismiss,
  voting = false,
}: VideoPollOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number>(0);

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

  // Reset minimized when a new poll arrives
  useEffect(() => {
    if (poll?.id) {
      setIsMinimized(false);
    }
  }, [poll?.id]);

  if (!poll || poll.status === "ENDED") {
    return null;
  }

  const isRevealed = poll.status === "REVEALED";
  const mySelection = poll.mySelection;
  const isTimeUp = remainingSec <= 0 && poll.status === "ACTIVE";

  // Calculate vote percentages if counts exist
  const totalVotes = poll.totalVotes || 0;
  const optionPercentages = useMemo(() => {
    const p: Record<string, number> = {};
    if (!poll.counts || totalVotes === 0) return p;
    for (const [key, count] of Object.entries(poll.counts)) {
      p[key] = Math.round((count / totalVotes) * 100);
    }
    return p;
  }, [poll.counts, totalVotes]);

  // Minimized pill state
  if (isMinimized) {
    return (
      <div className="absolute bottom-14 right-4 z-40 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-bold shadow-xl border border-amber-500/50 backdrop-blur-md transition-all active:scale-95"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>
            {isRevealed
              ? "View Poll Results"
              : mySelection
              ? `Voted (${remainingSec}s left)`
              : `Poll Active (${remainingSec}s)`}
          </span>
          <span className="material-symbols-outlined text-sm">open_in_full</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-[2px] transition-all">
      <div className="pointer-events-auto w-full max-w-md bg-[#0e111d]/95 text-white border-2 border-indigo-500/80 rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col gap-3.5 animate-in zoom-in-95 fade-in duration-200 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Live Poll
            </span>
            {isRevealed ? (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold shrink-0">
                Revealed
              </span>
            ) : isTimeUp ? (
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[11px] font-bold shrink-0">
                Time&apos;s Up
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[11px] font-mono font-bold shrink-0">
                ⏳ {remainingSec}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Minimize over video"
            >
              <span className="material-symbols-outlined text-base">expand_more</span>
            </button>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="Close"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Question Text */}
        <div className="space-y-1">
          <p className="text-sm sm:text-base font-bold text-slate-100 leading-snug break-words">
            {poll.questionText || "Select the correct option:"}
          </p>
        </div>

        {/* Revealed Status Banner */}
        {isRevealed && (
          <div
            className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in duration-200 ${
              mySelection === poll.correctOption
                ? "bg-emerald-950/80 border border-emerald-500/60 text-emerald-200"
                : mySelection
                ? "bg-rose-950/80 border border-rose-500/60 text-rose-200"
                : "bg-slate-800/80 border border-slate-700 text-slate-200"
            }`}
          >
            <span>
              {mySelection === poll.correctOption
                ? "🎉 Correct Answer!"
                : mySelection
                ? "❌ Incorrect"
                : "Poll Ended"}
            </span>
            {poll.correctOption && (
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[11px]">
                Option {poll.correctOption} is correct
              </span>
            )}
          </div>
        )}

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {poll.options.map((opt) => {
            const isSelected = mySelection === opt.key;
            const isCorrect = isRevealed && poll.correctOption === opt.key;
            const isWrong = isRevealed && isSelected && poll.correctOption !== opt.key;
            const percentage = optionPercentages[opt.key];

            let buttonClass =
              "relative overflow-hidden p-3 rounded-xl border-2 text-left font-medium transition-all active:scale-[0.98] disabled:cursor-default";

            if (isCorrect) {
              buttonClass += " border-emerald-400 bg-emerald-900/60 text-emerald-100 shadow-md";
            } else if (isWrong) {
              buttonClass += " border-rose-500 bg-rose-950/60 text-rose-200";
            } else if (isSelected) {
              buttonClass += " border-indigo-400 bg-indigo-950/80 text-white shadow-md ring-2 ring-indigo-500/40";
            } else {
              buttonClass += " border-slate-700/80 bg-slate-900/80 hover:bg-slate-800/90 text-slate-200";
            }

            return (
              <button
                key={opt.key}
                type="button"
                disabled={Boolean(mySelection) || isRevealed || isTimeUp || voting}
                onClick={() => onVote(opt.key)}
                className={buttonClass}
              >
                {/* Vote Percentage background bar when revealed */}
                {isRevealed && percentage !== undefined && (
                  <div
                    className={`absolute inset-0 opacity-20 pointer-events-none transition-all duration-500 ${
                      isCorrect ? "bg-emerald-400" : "bg-indigo-400"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                )}

                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
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
                    <span className="text-xs sm:text-sm font-semibold truncate">
                      {opt.label}
                    </span>
                  </div>

                  {isRevealed && percentage !== undefined && (
                    <span className="text-xs font-mono font-bold text-slate-400 shrink-0">
                      {percentage}%
                    </span>
                  )}

                  {!isRevealed && isSelected && (
                    <span className="material-symbols-outlined text-sm text-indigo-400 shrink-0">
                      check_circle
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          {mySelection ? (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">done</span>
              Your vote has been submitted ({mySelection})
            </span>
          ) : isTimeUp ? (
            <span className="text-amber-400 font-medium">Time has expired for this question</span>
          ) : (
            <span>Tap an option to submit your answer</span>
          )}

          {isRevealed && totalVotes > 0 && (
            <span className="font-medium text-slate-400">
              {totalVotes} {totalVotes === 1 ? "student voted" : "students voted"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
