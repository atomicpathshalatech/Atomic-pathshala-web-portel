"use client";

import React, { useState, useEffect } from "react";

export type TeacherPollControlPanelProps = {
  activeQuiz: {
    id: string;
    questionText?: string | null;
    options: Array<{ key: string; label: string }>;
    correctOption?: string | null;
    status: "ACTIVE" | "REVEALED" | "CLOSED";
    startedAt?: string | null;
    timeLimitSec: number;
  };
  quizMetrics: {
    counts: Record<string, number>;
    totalResponses: number;
    youtubeResponses?: number;
  } | null;
  onReveal: (correctOption?: string) => void;
  onDismiss: () => void;
  onNewPoll: () => void;
  onClosePanel?: () => void;
};

export function TeacherPollControlPanel({
  activeQuiz,
  quizMetrics,
  onReveal,
  onDismiss,
  onNewPoll,
  onClosePanel,
}: TeacherPollControlPanelProps) {
  // CRITICAL REQUIREMENT 6: Do NOT pre-select or pre-color any option as correct before reveal
  const [selectedRevealOption, setSelectedRevealOption] = useState<string | null>(
    activeQuiz.correctOption || null
  );
  const [remainingSec, setRemainingSec] = useState<number>(0);

  const isRevealed = activeQuiz.status === "REVEALED";
  const total = quizMetrics?.totalResponses ?? 0;
  const counts = quizMetrics?.counts ?? {};

  // Server-authoritative timer countdown
  useEffect(() => {
    if (activeQuiz.status !== "ACTIVE" || !activeQuiz.startedAt) {
      setRemainingSec(0);
      return;
    }

    const computeLeft = () => {
      const startMs = new Date(activeQuiz.startedAt!).getTime();
      const deadlineMs = startMs + activeQuiz.timeLimitSec * 1000;
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      return left;
    };

    setRemainingSec(computeLeft());

    const timer = setInterval(() => {
      const left = computeLeft();
      setRemainingSec(left);
      if (left <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeQuiz.startedAt, activeQuiz.timeLimitSec, activeQuiz.status]);

  const isTimeUp = activeQuiz.status === "ACTIVE" && remainingSec <= 0;
  const formattedMinutes = String(Math.floor(remainingSec / 60)).padStart(2, "0");
  const formattedSeconds = String(remainingSec % 60).padStart(2, "0");

  return (
    <div className="w-full bg-[#0d0f1a] border border-[#23273c] rounded-2xl shadow-2xl p-3 text-white flex flex-col gap-2 max-w-sm sm:max-w-md mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1f2336] pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-blue-400 text-base">how_to_vote</span>
          <h4 className="text-xs font-bold text-gray-100 truncate">
            {isRevealed ? "Poll Results (Published)" : "Live Poll in Progress"}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              isRevealed
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                : isTimeUp
                ? "bg-rose-950/60 text-rose-400 border-rose-800"
                : "bg-blue-950/60 text-blue-400 border-blue-800"
            }`}
          >
            {isRevealed ? "REVEALED" : isTimeUp ? "TIME UP" : "ACTIVE"}
          </span>
          {onClosePanel && (
            <button
              type="button"
              onClick={onClosePanel}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#232738] transition cursor-pointer"
              title="Close panel"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Timer & Status Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#141726] border border-[#22273a] text-xs">
        <div className="flex items-center gap-1.5">
          {isRevealed ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              RESULT PUBLISHED
            </span>
          ) : isTimeUp ? (
            <span className="text-rose-400 font-bold flex items-center gap-1 text-[11px]">
              <span className="material-symbols-outlined text-sm">timer_off</span>
              TIME UP (Submissions Closed)
            </span>
          ) : (
            <span className="text-amber-300 font-mono font-bold flex items-center gap-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              ⏳ {formattedMinutes}:{formattedSeconds}
            </span>
          )}
        </div>

        <div className="text-gray-300 font-medium text-[11px]">
          Responses: <span className="text-white font-bold font-mono">{total}</span>
          {(quizMetrics?.youtubeResponses ?? 0) > 0 && (
            <span className="text-red-400 text-[10px]"> ({quizMetrics?.youtubeResponses} YT)</span>
          )}
        </div>
      </div>

      {/* Question Text */}
      {activeQuiz.questionText && (
        <div className="bg-[#121422] border border-[#202436] p-2 rounded-lg">
          <p className="text-xs font-semibold text-gray-100 line-clamp-2 leading-snug">
            {activeQuiz.questionText}
          </p>
        </div>
      )}

      {/* When ACTIVE: Neutral Correct answer selector before reveal */}
      {!isRevealed && (
        <div className="bg-[#121422] border border-[#22273a] p-2 rounded-lg space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
            <span>SET CORRECT OPTION:</span>
            <span className="text-gray-300 font-mono font-bold">
              {selectedRevealOption ? `Option ${selectedRevealOption}` : "(Optional - Select below)"}
            </span>
          </div>
          {/* Neutral option pills - NO blue/green pre-color before reveal */}
          <div className="grid grid-cols-4 gap-1">
            {activeQuiz.options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setSelectedRevealOption(o.key)}
                className={`py-1 rounded-md text-xs font-bold font-mono transition border cursor-pointer ${
                  selectedRevealOption === o.key
                    ? "bg-slate-700 text-white border-slate-400 shadow-xs"
                    : "bg-[#181c2c] text-gray-300 border-[#2a2f44] hover:border-slate-500"
                }`}
              >
                {o.key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Options List with response counts and percentage bars */}
      <div className="space-y-1">
        {activeQuiz.options.map((o) => {
          const count = counts[o.key] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isCorrect = isRevealed && activeQuiz.correctOption === o.key;

          return (
            <div
              key={o.key}
              className={`relative overflow-hidden rounded-lg border transition ${
                isCorrect
                  ? "border-emerald-500/80 bg-[#0f1717] ring-1 ring-emerald-500/50"
                  : "border-[#202436] bg-[#121422]"
              }`}
            >
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                  isCorrect ? "bg-emerald-500/25" : "bg-slate-700/20"
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-2.5 py-1.5 text-xs">
                <span
                  className={`font-semibold flex items-center gap-1.5 ${
                    isCorrect ? "text-emerald-300" : "text-gray-200"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded text-center leading-4 font-mono text-[10px] font-bold ${
                      isCorrect ? "bg-emerald-600 text-white" : "bg-[#202436] text-gray-300"
                    }`}
                  >
                    {o.key}
                  </span>
                  <span className="truncate max-w-[150px] text-xs">{o.label}</span>
                  {isCorrect && (
                    <span className="text-[9px] text-emerald-400 font-bold ml-1">✓ Correct</span>
                  )}
                </span>
                <span className="font-mono text-[11px] text-gray-300">
                  {count} {total > 0 ? `(${pct}%)` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Control Actions */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-[#1f2336]">
        {!isRevealed ? (
          <>
            <button
              type="button"
              onClick={() => onReveal(selectedRevealOption || undefined)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              Publish Result {selectedRevealOption ? `(${selectedRevealOption})` : ""}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 bg-[#1a1d2e] hover:bg-rose-950 hover:text-rose-200 text-gray-300 rounded-lg text-xs font-bold transition cursor-pointer"
              title="Dismiss poll"
            >
              Dismiss
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">cancel</span>
              Dismiss Poll
            </button>
            <button
              type="button"
              onClick={onNewPoll}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              New Poll
            </button>
          </>
        )}
      </div>
    </div>
  );
}
