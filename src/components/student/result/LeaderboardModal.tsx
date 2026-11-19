"use client";

import React, { useEffect, useState } from "react";

type LeaderboardRow = {
  rank: number;
  displayName: string;
  photoUrl?: string | null;
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
    currentUserRow?: LeaderboardRow | null;
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

  const initials = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-bold shadow-inner">
              <span className="material-symbols-outlined text-amber-300 text-xl">trophy</span>
            </span>
            <div>
              <h3 className="text-base font-black tracking-tight">Official Test Leaderboard</h3>
              <p className="text-xs text-blue-200">
                Verified Academic Standings &amp; Rankings ({data?.totalParticipants ?? 0} Participants)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
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
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 shadow-xs">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block uppercase font-mono">
                    Rank 1 Score
                  </span>
                  <div className="text-xl font-black text-amber-900 dark:text-amber-200 font-mono mt-0.5">
                    {data.rank1Score}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 shadow-xs">
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block uppercase font-mono">
                    Your Rank
                  </span>
                  <div className="text-xl font-black text-blue-900 dark:text-blue-200 font-mono mt-0.5">
                    #{data.myRank}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase font-mono">
                    Topper Gap
                  </span>
                  <div className="text-xl font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                    {data.gapTopperMarks} marks
                  </div>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3 text-center w-16">Rank</th>
                      <th className="p-3">Student</th>
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
                            ? "bg-blue-50/90 dark:bg-blue-950/60 font-bold border-l-4 border-l-blue-600"
                            : row.rank === 1
                            ? "bg-amber-50/40 dark:bg-amber-950/20"
                            : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                        }`}
                      >
                        <td className="p-3 text-center font-mono font-bold">
                          {row.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 border border-amber-300 text-amber-900 shadow-xs text-sm" title="Rank 1 - Gold Medal">
                              🥇
                            </span>
                          ) : row.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 border border-slate-300 text-slate-900 text-sm" title="Rank 2 - Silver Medal">
                              🥈
                            </span>
                          ) : row.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 border border-orange-300 text-orange-900 text-sm" title="Rank 3 - Bronze Medal">
                              🥉
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">#{row.rank}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            {row.photoUrl ? (
                              <img
                                src={row.photoUrl}
                                alt={row.displayName}
                                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center justify-center border border-blue-200 dark:border-blue-800 shrink-0">
                                {initials(row.displayName)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-xs">
                                  {row.displayName}
                                </span>
                                {row.isCurrentUser && (
                                  <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[9px] font-bold font-mono">
                                    YOU
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {row.score}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">
                          {row.accuracy}%
                        </td>
                      </tr>
                    ))}

                    {/* Pinned Current User Row if outside Top 10 */}
                    {data.currentUserRow && (
                      <>
                        <tr className="bg-slate-100 dark:bg-slate-800/80">
                          <td colSpan={4} className="py-1 px-3 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            ••• Your Academic Standing •••
                          </td>
                        </tr>
                        <tr className="bg-blue-50/90 dark:bg-blue-950/60 font-bold border-l-4 border-l-blue-600">
                          <td className="p-3 text-center font-mono font-bold text-blue-700 dark:text-blue-300">
                            #{data.currentUserRow.rank}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              {data.currentUserRow.photoUrl ? (
                                <img
                                  src={data.currentUserRow.photoUrl}
                                  alt={data.currentUserRow.displayName}
                                  className="w-7 h-7 rounded-full object-cover border border-blue-300"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                                  {initials(data.currentUserRow.displayName)}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-blue-950 dark:text-blue-100">
                                  {data.currentUserRow.displayName}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white text-[9px] font-bold font-mono">
                                  YOU
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-blue-900 dark:text-blue-200 text-sm">
                            {data.currentUserRow.score}
                          </td>
                          <td className="p-3 text-right font-mono text-blue-800 dark:text-blue-300">
                            {data.currentUserRow.accuracy}%
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                <span>Live Academic Rankings computed purely from verified test attempts.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
