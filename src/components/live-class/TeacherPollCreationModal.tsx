"use client";

import React, { useState } from "react";

export type TeacherPollForm = {
  questionText: string;
  options: string[];
  correctOption: string;
  timeLimitSec: number;
};

export type TeacherPollCreationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (pollData: {
    questionText: string;
    options: Array<{ key: string; label: string }>;
    correctOption?: string;
    timeLimitSec: number;
  }) => Promise<void> | void;
  launching?: boolean;
  error?: string | null;
};

export function TeacherPollCreationModal({
  isOpen,
  onClose,
  onPublish,
  launching = false,
  error = null,
}: TeacherPollCreationModalProps) {
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<string[]>([
    "Option A",
    "Option B",
    "Option C",
    "Option D",
  ]);
  const [correctOption, setCorrectOption] = useState<string>("");
  const [timeLimitSec, setTimeLimitSec] = useState<number>(30);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOptionChange = (index: number, val: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const filledOptions = options
      .map((label, idx) => ({
        key: String.fromCharCode(65 + idx),
        label: label.trim(),
      }))
      .filter((o) => o.label.length > 0);

    if (filledOptions.length < 2) {
      setLocalError("Please provide at least 2 options.");
      return;
    }

    onPublish({
      questionText: questionText.trim(),
      options: filledOptions,
      correctOption: correctOption || undefined,
      timeLimitSec,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#10131e] border border-[#272b3c] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#232738] bg-[#151928]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400 text-xl">how_to_vote</span>
            <h3 className="text-sm font-bold text-gray-100">Create Live Poll</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#232738] transition"
            title="Cancel"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {(localError || error) && (
            <p className="text-xs font-semibold text-rose-300 bg-rose-950/40 border border-rose-900/50 rounded-xl px-3 py-2">
              {localError || error}
            </p>
          )}

          {/* 1. Question Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
              Question
            </label>
            <textarea
              rows={2}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Type your question statement (optional for board question)..."
              className="w-full bg-[#171a29] border border-[#2d3248] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none transition"
            />
          </div>

          {/* 2 - 5. Option Inputs (A, B, C, D) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                Answer Options
              </label>
              <span className="text-[10px] text-gray-400">
                (Click letter to mark pre-set correct answer)
              </span>
            </div>

            <div className="space-y-1.5">
              {options.map((optVal, idx) => {
                const key = String.fromCharCode(65 + idx);
                const isCorrect = correctOption === key;

                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition ${
                      isCorrect
                        ? "border-emerald-500/80 bg-emerald-950/20"
                        : "border-[#2a2f44] bg-[#171a29]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setCorrectOption((prev) => (prev === key ? "" : key))}
                      className={`w-7 h-7 rounded-lg text-xs font-mono font-black flex items-center justify-center transition cursor-pointer ${
                        isCorrect
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-[#232738] text-gray-300 hover:bg-blue-600 hover:text-white"
                      }`}
                      title={isCorrect ? "Correct answer (click to unmark)" : "Click to mark as correct answer"}
                    >
                      {key}
                    </button>
                    <input
                      type="text"
                      value={optVal}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${key}`}
                      className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none"
                    />
                    {isCorrect && (
                      <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40">
                        Correct
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. Timer Selection */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-gray-300">Poll Timer:</span>
            <div className="flex items-center gap-1.5">
              {[15, 30, 45, 60, 90].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setTimeLimitSec(sec)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                    timeLimitSec === sec
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-[#1d2133] text-gray-400 hover:text-gray-200 border border-[#2b3047]"
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* 7 & 8. Create / Publish Poll & Cancel Buttons */}
          <div className="flex items-center gap-2.5 pt-2 border-t border-[#232738]">
            <button
              type="button"
              onClick={onClose}
              disabled={launching}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#2d3248] bg-[#171a29] hover:bg-[#20253a] text-xs font-bold text-gray-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={launching}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {launching ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">
                    progress_activity
                  </span>
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>Publish Poll</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
