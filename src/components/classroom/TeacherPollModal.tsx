"use client";

import React, { useState, useEffect } from "react";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { classroomTeacherChannel, CLASSROOM_EVENTS } from "@/lib/realtime/events";
import { postJson, getJson } from "./lib";

export type TeacherPollState = {
  id: string;
  classroomSessionId: string;
  questionText: string;
  options: Array<{ key: string; label: string }>;
  correctOption?: string;
  timeLimitSec: number;
  status: "ACTIVE" | "REVEALED" | "ENDED";
  startedAt: string;
  counts?: Record<string, number>;
  totalVotes?: number;
};

export function TeacherPollModal({
  classroomSessionId,
  isOpen,
  onClose,
}: {
  classroomSessionId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [activePoll, setActivePoll] = useState<TeacherPollState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [questionText, setQuestionText] = useState("");
  const [optionMode, setOptionMode] = useState<"ABCD" | "TF" | "CUSTOM">("ABCD");
  const [options, setOptions] = useState<Array<{ key: string; label: string }>>([
    { key: "A", label: "Option A" },
    { key: "B", label: "Option B" },
    { key: "C", label: "Option C" },
    { key: "D", label: "Option D" },
  ]);
  const [correctOption, setCorrectOption] = useState<string>("");
  const [timeLimitSec, setTimeLimitSec] = useState<number>(30);

  // Fetch current poll on open
  useEffect(() => {
    if (!isOpen || !classroomSessionId) return;
    getJson(`/api/classroom/sessions/${classroomSessionId}/poll`)
      .then((res) => {
        if (res?.poll && res.poll.status !== "ENDED") {
          setActivePoll(res.poll);
        } else {
          setActivePoll(null);
        }
      })
      .catch(() => {});
  }, [isOpen, classroomSessionId]);

  // Listen to teacher channel for live vote metrics
  useEffect(() => {
    if (!classroomSessionId) return;
    const client = getPusherClient();
    const channel = client.subscribe(classroomTeacherChannel(classroomSessionId));

    const onPollVoted = (data: { pollId: string; counts: Record<string, number>; totalVotes: number }) => {
      setActivePoll((prev) => {
        if (!prev || prev.id !== data.pollId) return prev;
        return {
          ...prev,
          counts: data.counts,
          totalVotes: data.totalVotes,
        };
      });
    };

    channel.bind(CLASSROOM_EVENTS.POLL_VOTED, onPollVoted);

    return () => {
      channel.unbind(CLASSROOM_EVENTS.POLL_VOTED, onPollVoted);
      client.unsubscribe(classroomTeacherChannel(classroomSessionId));
    };
  }, [classroomSessionId]);

  const setMode = (mode: "ABCD" | "TF" | "CUSTOM") => {
    setOptionMode(mode);
    setCorrectOption("");
    if (mode === "ABCD") {
      setOptions([
        { key: "A", label: "Option A" },
        { key: "B", label: "Option B" },
        { key: "C", label: "Option C" },
        { key: "D", label: "Option D" },
      ]);
    } else if (mode === "TF") {
      setOptions([
        { key: "A", label: "True / सही" },
        { key: "B", label: "False / गलत" },
      ]);
    }
  };

  const handleLaunch = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await postJson(`/api/classroom/sessions/${classroomSessionId}/poll`, {
        action: "launch",
        questionText: questionText.trim() || "Live Class Poll",
        options,
        correctOption: correctOption || undefined,
        timeLimitSec,
      });

      if (res?.poll) {
        setActivePoll(res.poll);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch poll");
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = async (selectedOverride?: string) => {
    if (!activePoll) return;
    setError(null);
    setLoading(true);
    try {
      const toReveal = selectedOverride || correctOption || activePoll.correctOption;
      const res = await postJson(`/api/classroom/sessions/${classroomSessionId}/poll`, {
        action: "reveal",
        pollId: activePoll.id,
        correctOption: toReveal || undefined,
      });

      if (res?.poll) {
        setActivePoll(res.poll);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reveal poll answer");
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!activePoll) return;
    setError(null);
    setLoading(true);
    try {
      await postJson(`/api/classroom/sessions/${classroomSessionId}/poll`, {
        action: "end",
        pollId: activePoll.id,
      });
      setActivePoll(null);
      setQuestionText("");
      setCorrectOption("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end poll");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0e111d] text-white border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <span className="material-symbols-outlined text-lg">poll</span>
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Live Screen Poll Controller</h2>
              <p className="text-[11px] text-slate-400">Pushes floating interactive poll over students&apos; video display</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-semibold">
              {error}
            </div>
          )}

          {activePoll ? (
            /* Active / Revealed Poll Dashboard */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      {activePoll.status === "ACTIVE" ? "Poll Currently Live on Screen" : "Answer Revealed to Students"}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                    {activePoll.totalVotes || 0} Votes Received
                  </span>
                </div>

                <p className="text-sm font-bold text-white pt-1">{activePoll.questionText}</p>

                {/* Live vote counts breakdown */}
                <div className="space-y-2 pt-2">
                  {activePoll.options.map((opt) => {
                    const count = activePoll.counts?.[opt.key] || 0;
                    const total = activePoll.totalVotes || 0;
                    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isCorrect = activePoll.status === "REVEALED" && activePoll.correctOption === opt.key;

                    return (
                      <div
                        key={opt.key}
                        className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 transition ${
                          isCorrect
                            ? "bg-emerald-950/60 border-emerald-500/80 text-emerald-200"
                            : "bg-slate-950/60 border-slate-800 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">
                              {opt.key}
                            </span>
                            <span>{opt.label}</span>
                            {isCorrect && (
                              <span className="px-2 py-0.2 bg-emerald-500 text-slate-950 rounded text-[10px] font-black">
                                Correct
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-400">
                            {count} ({percent}%)
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isCorrect ? "bg-emerald-400" : "bg-indigo-500"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2">
                {activePoll.status === "ACTIVE" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleReveal()}
                      disabled={loading}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">visibility</span>
                      <span>Reveal Answer</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleEnd}
                      disabled={loading}
                      className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active:scale-95"
                    >
                      End Poll
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnd}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Start New Poll</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Create Poll Form */
            <div className="space-y-4">
              {/* Presets */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("ABCD")}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    optionMode === "ABCD"
                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  4-Option (A/B/C/D)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("TF")}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    optionMode === "TF"
                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  True / False
                </button>
                <button
                  type="button"
                  onClick={() => setMode("CUSTOM")}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition ${
                    optionMode === "CUSTOM"
                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Question Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Question (Optional if you already wrote it on the slide/board)
                </label>
                <input
                  type="text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g. Which organelle produces ATP?"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Options</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {options.map((opt, idx) => (
                    <div key={opt.key} className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-amber-400 shrink-0">
                        {opt.key}
                      </span>
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOptions((prev) =>
                            prev.map((o, i) => (i === idx ? { ...o, label: val } : o))
                          );
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Correct Option & Timer */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Correct Option (Optional)</label>
                  <select
                    value={correctOption}
                    onChange={(e) => setCorrectOption(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">None (Survey / General)</option>
                    {options.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.key} - {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Timer Limit</label>
                  <select
                    value={timeLimitSec}
                    onChange={(e) => setTimeLimitSec(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={15}>15 Seconds</option>
                    <option value={30}>30 Seconds</option>
                    <option value={45}>45 Seconds</option>
                    <option value={60}>60 Seconds</option>
                    <option value={90}>90 Seconds</option>
                    <option value={120}>2 Minutes</option>
                  </select>
                </div>
              </div>

              {/* Launch Button */}
              <button
                type="button"
                onClick={handleLaunch}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-sm font-black transition flex items-center justify-center gap-2 shadow-xl active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">send</span>
                <span>{loading ? "Pushing Poll..." : "Push Poll to Video Screen"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
