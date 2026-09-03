"use client";

import React from "react";

interface HierarchicalSearchFilterProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: "ALL" | "REVIEWED" | "DRAFT";
  onStatusFilterChange: (status: "ALL" | "REVIEWED" | "DRAFT") => void;
  viewMode: "TREE" | "MINDMAP" | "REVISION";
  onViewModeChange: (mode: "TREE" | "MINDMAP" | "REVISION") => void;
  activeRevisionCount: number;
}

export function HierarchicalSearchFilter({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  activeRevisionCount,
}: HierarchicalSearchFilterProps) {
  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* Left: View Mode Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
        <button
          type="button"
          onClick={() => onViewModeChange("TREE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            viewMode === "TREE"
              ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-base">account_tree</span>
          <span>Hierarchy Tree</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange("MINDMAP")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            viewMode === "MINDMAP"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-base">hub</span>
          <span>Interactive Mindmap</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange("REVISION")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
            viewMode === "REVISION"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span className="material-symbols-outlined text-base">repeat</span>
          <span>Revision Hub</span>
          {activeRevisionCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-black">
              {activeRevisionCount}
            </span>
          )}
        </button>
      </div>

      {/* Right: Search Input & Status Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Full Path Search */}
        <div className="relative min-w-[240px] flex-1 sm:flex-initial">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">
            search
          </span>
          <input
            type="text"
            placeholder="Search Class, Subject, Chapter, Topic..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none transition placeholder-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => onStatusFilterChange("ALL")}
            className={`px-3 py-1.5 rounded-xl transition ${
              statusFilter === "ALL"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange("REVIEWED")}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
              statusFilter === "REVIEWED"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Reviewed</span>
          </button>
          <button
            type="button"
            onClick={() => onStatusFilterChange("DRAFT")}
            className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
              statusFilter === "DRAFT"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Draft</span>
          </button>
        </div>
      </div>
    </div>
  );
}
