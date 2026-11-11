"use client";

import React, { useState } from "react";

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
  const [selectedRevealOption, setSelectedRevealOption] = useState<string>(
    activeQuiz.correctOption || "A"
  );

  const isRevealed = activeQuiz.status === "REVEALED";
  const total = quizMetrics?.totalResponses ?? 0;
  const counts = quizMetrics?.counts ?? {};

  return (
    <div className="w-full bg-[#11131f] border border-[#272b3c] rounded-2xl shadow-2xl p-4 text-white flex flex-col gap-3 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232738] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-400 text-lg">how_to_vote</span>
          <h4 className="text-xs font-bold text-gray-100">
            {isRevealed ? "Poll Results (Published)" : "Live Poll in Progress"}
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isRevealed
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                : "bg-blue-950/60 text-blue-400 border-blue-800"
            }`}
          >
            {activeQuiz.status}
          </span>
          {onClosePanel && (
            <button
              type="button"
              onClick={onClosePanel}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#232738] transition"
              title="Close panel"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Question Text */}
      {activeQuiz.questionText && (
        <p className="text-xs font-semibold text-gray-200 line-clamp-2 px-0.5">
          {activeQuiz.questionText}
        </p>
      )}

      {/* When ACTIVE: Correct answer selection selector before reveal */}
      {!isRevealed && (
        <div className="bg-[#161927] border border-[#2b3047] p-2.5 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
            <span>SET CORRECT OPTION:</span>
            <span className="text-blue-400 font-mono font-bold">
              Option {selectedRevealOption}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {activeQuiz.options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setSelectedRevealOption(o.key)}
                className={`py-1.5 rounded-lg text-xs font-bold font-mono transition border cursor-pointer ${
                  selectedRevealOption === o.key
                    ? "bg-blue-600 text-white border-blue-400 shadow-xs"
                    : "bg-[#1c2032] text-gray-300 border-[#2d334d] hover:border-blue-400"
                }`}
              >
                {o.key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Options List with response counts and percentage bars */}
      <div className="space-y-1.5">
        {activeQuiz.options.map((o) => {
          const count = counts[o.key] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isCorrect = isRevealed && activeQuiz.correctOption === o.key;

          return (
            <div
              key={o.key}
              className={`relative overflow-hidden rounded-xl border transition ${
                isCorrect
                  ? "border-emerald-500/80 bg-[#121820] ring-1 ring-emerald-500/50"
                  : "border-[#272b3d] bg-[#141724]"
              }`}
            >
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                  isCorrect ? "bg-emerald-500/25" : "bg-blue-500/15"
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2 text-xs">
                <span
                  className={`font-semibold flex items-center gap-2 ${
                    isCorrect ? "text-emerald-300" : "text-gray-200"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-md text-center leading-5 font-mono text-xs font-bold ${
                      isCorrect ? "bg-emerald-600 text-white" : "bg-[#252a3d] text-gray-300"
                    }`}
                  >
                    {o.key}
                  </span>
                  <span className="truncate max-w-[180px]">{o.label}</span>
                  {isCorrect && (
                    <span className="text-[10px] text-emerald-400 font-bold">✓ Correct</span>
                  )}
                </span>
                <span className="font-mono text-xs text-gray-300">
                  {count} {total > 0 ? `(${pct}%)` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total responses summary */}
      <p className="text-[11px] text-gray-400 text-center">
        {total} total response{total === 1 ? "" : "s"}
        {(quizMetrics?.youtubeResponses ?? 0) > 0 && (
          <span className="text-red-400">
            {" "}· {quizMetrics?.youtubeResponses} from YouTube chat
          </span>
        )}
      </p>

      {/* Control Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#232738]">
        {!isRevealed ? (
          <>
            <button
              type="button"
              onClick={() => onReveal(selectedRevealOption)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              Publish Result ({selectedRevealOption})
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-2 bg-[#202436] hover:bg-rose-950 hover:text-rose-200 text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Dismiss poll without publishing results"
            >
              Dismiss
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">cancel</span>
              Dismiss Poll
            </button>
            <button
              type="button"
              onClick={onNewPoll}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
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
