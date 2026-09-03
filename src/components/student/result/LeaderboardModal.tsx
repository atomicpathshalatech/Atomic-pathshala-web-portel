"use client";

import React, { useEffect, useState } from "react";

type LeaderboardRow = {
  rank: number;
  displayName: string;
  score: number;
  accuracy: number;
  percentage: number;
  timeTakenSec: number;
  isCurrentUser: boolean;
};

export function LeaderboardModal({
  testId,
  isOpen,
  onClose,
}: {
  testId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    totalParticipants: number;
    myRank: number;
    myScore: number;
    rank1Score: number;
    gapTopperMarks: number;
    leaderboard: LeaderboardRow[];
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/tests/${testId}/leaderboard`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setData(json.data);
        }
      })
      .catch((err) => console.error("Leaderboard fetch error:", err))
      .finally(() => setLoading(false));
  }, [isOpen, testId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-amber-300">trophy</span>
            </span>
            <div>
              <h3 className="text-base font-black">Official Test Leaderboard</h3>
              <p className="text-xs text-blue-200">
                Privacy-Protected Anonymized Academic Standings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Loading standings...</p>
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Leaderboard data currently unavailable.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Standings Summary Row */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block uppercase font-mono">
                    Rank 1 Score
                  </span>
                  <div className="text-xl font-black text-amber-900 dark:text-amber-200 font-mono">
                    {data.rank1Score}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block uppercase font-mono">
                    Your Rank
                  </span>
                  <div className="text-xl font-black text-blue-900 dark:text-blue-200 font-mono">
                    #{data.myRank}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase font-mono">
                    Topper Gap
                  </span>
                  <div className="text-xl font-black text-slate-700 dark:text-slate-300 font-mono">
                    {data.gapTopperMarks} marks
                  </div>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3 text-center">Rank</th>
                      <th className="p-3">Candidate</th>
                      <th className="p-3 text-right">Score</th>
                      <th className="p-3 text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {data.leaderboard.map((row) => (
                      <tr
                        key={row.rank}
                        className={`transition ${
                          row.isCurrentUser
                            ? "bg-blue-50/80 dark:bg-blue-950/50 font-bold"
                            : row.rank === 1
                            ? "bg-amber-50/40 dark:bg-amber-950/20"
                            : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                        }`}
                      >
                        <td className="p-3 text-center font-mono font-bold">
                          {row.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-900 shadow-sm text-[11px]">
                              🥇
                            </span>
                          ) : row.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-900 text-[11px]">
                              🥈
                            </span>
                          ) : row.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white text-[11px]">
                              🥉
                            </span>
                          ) : (
                            `#${row.rank}`
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span>{row.displayName}</span>
                            {row.isCurrentUser && (
                              <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold font-mono">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {row.score}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {row.accuracy}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-slate-400 text-center">
                🔒 In accordance with platform privacy policy, all student identities are completely protected.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
