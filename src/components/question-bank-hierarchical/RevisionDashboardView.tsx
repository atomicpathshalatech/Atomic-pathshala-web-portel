"use client";

import React, { useState } from "react";
import {
  RevisionItemSummary,
  RevisionDashboardStats,
} from "@/lib/question-bank-hierarchical/types";
import { RevisionSessionModal } from "./RevisionSessionModal";

interface RevisionDashboardViewProps {
  stats: RevisionDashboardStats;
  items: RevisionItemSummary[];
  onRefresh: () => void;
  onRemoveFromRevision: (revisionItemId: string) => void;
}

export function RevisionDashboardView({
  stats,
  items,
  onRefresh,
  onRemoveFromRevision,
}: RevisionDashboardViewProps) {
  const [activeSessionItem, setActiveSessionItem] = useState<RevisionItemSummary | null>(null);
  const [viewHistoryItem, setViewHistoryItem] = useState<RevisionItemSummary | null>(null);

  const getStatusBadge = (status: RevisionItemSummary["status"]) => {
    switch (status) {
      case "STRONG":
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-black uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Strong Mastery
          </span>
        );
      case "WEAK":
        return (
          <span className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 text-[10px] font-black uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Weak Area
          </span>
        );
      case "NEEDS_PRACTICE":
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-black uppercase flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Needs Practice
          </span>
        );
      case "UNATTEMPTED":
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase">
            Ready to Revise
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Summary Statistics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Saved Portions
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.activePortionsCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">active in hub</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Revision Sessions
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {stats.totalRevisionSessions}
            </span>
            <span className="text-xs text-slate-400 font-medium">completed runs</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Questions Practiced
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {stats.questionsRevisedCount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-medium">total attempts</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Average Accuracy
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.averageAccuracy}%
            </span>
            <span className="text-xs text-emerald-600 font-medium">overall trend</span>
          </div>
        </div>
      </div>

      {/* 2. Weak & Strong Area Insights */}
      {(stats.weakAreas.length > 0 || stats.strongAreas.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Weak Areas */}
          {stats.weakAreas.length > 0 && (
            <div className="p-5 rounded-3xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 space-y-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <span className="material-symbols-outlined text-lg">warning</span>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  Weak Areas Needing Reinforcement (&lt;70%)
                </h4>
              </div>
              <div className="space-y-2">
                {stats.weakAreas.map((w) => (
                  <div
                    key={w.revisionItemId}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-red-200/60 dark:border-red-900/40 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {w.title}
                      </span>
                      <span className="text-[10px] text-slate-400">{w.fullPath}</span>
                    </div>
                    <span className="text-xs font-black text-red-600 dark:text-red-400 shrink-0">
                      {w.accuracy}% ({w.revisionCount} Runs)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strong Areas */}
          {stats.strongAreas.length > 0 && (
            <div className="p-5 rounded-3xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <span className="material-symbols-outlined text-lg">verified</span>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  Strong Areas Mastered (&ge;85%)
                </h4>
              </div>
              <div className="space-y-2">
                {stats.strongAreas.map((s) => (
                  <div
                    key={s.revisionItemId}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {s.title}
                      </span>
                      <span className="text-[10px] text-slate-400">{s.fullPath}</span>
                    </div>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                      {s.accuracy}% ({s.revisionCount} Runs)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Active Revision Portions Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Saved Revision Portions
            </h3>
            <p className="text-xs text-slate-500">
              Revise repeatedly over time to turn weak topics into strong mastery.
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">playlist_add</span>
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Revision Portions Added Yet
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Switch to the <strong>Hierarchy Tree</strong> or <strong>Mindmap</strong> and click &ldquo;Add to Revision&rdquo; on any Class, Subject, Chapter, or Topic to save it here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Left: Path & Title */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold">
                        {item.entityType}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">{item.fullPath}</span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {item.title}
                    </h4>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">{getStatusBadge(item.status)}</div>
                </div>

                {/* Performance Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Total Pool</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {item.questionCount} Questions
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Revision Count</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      Revised {item.revisionCount} Times
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Latest Accuracy</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {item.latestAccuracy}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Average Score</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {item.averageAccuracy}%
                    </span>
                  </div>
                </div>

                {/* Revision History Trend Chips */}
                {item.history.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Revision Progress Trend
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.history.map((h) => (
                        <span
                          key={h.sessionId}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold flex items-center gap-1.5"
                        >
                          <span className="text-slate-500">Run {h.revisionNumber}:</span>
                          <span
                            className={
                              h.accuracy >= 80
                                ? "text-emerald-600 dark:text-emerald-400"
                                : h.accuracy < 70
                                ? "text-red-500"
                                : "text-amber-500"
                            }
                          >
                            {h.accuracy}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onRemoveFromRevision(item.id)}
                    className="text-xs font-bold text-slate-400 hover:text-red-500 transition"
                  >
                    Remove from Revision
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSessionItem(item)}
                      className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">play_arrow</span>
                      <span>Start Revision</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Session Runner Modal */}
      {activeSessionItem && (
        <RevisionSessionModal
          item={activeSessionItem}
          onClose={() => setActiveSessionItem(null)}
          onSessionCompleted={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
