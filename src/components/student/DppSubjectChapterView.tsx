"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

export interface RealDPPItem {
  id: string;
  code: string;
  title: string;
  subject: string;
  chapter: string;
  difficulty: string;
  questionCount: number;
  durationMins: number;
  totalMarks: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  score?: number | null;
  pdfUrl?: string | null;
  testId?: string | null;
}

export interface RealChapterGroup {
  id: string;
  chapterNumber: number;
  title: string;
  dpps: RealDPPItem[];
}

export interface RealSubjectGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  gradient: string;
  badgeBg: string;
  chapters: RealChapterGroup[];
}

export function DppSubjectChapterView({
  subjects = [],
}: {
  subjects: RealSubjectGroup[];
}) {
  const defaultSubject = subjects[0]?.name || "Physics";
  const [selectedSubject, setSelectedSubject] = useState<string>(defaultSubject);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const activeSubjectData = subjects.find((s) => s.name === selectedSubject) || subjects[0];

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  if (!subjects || subjects.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-12 text-center text-on-surface-variant space-y-3 border border-outline-variant/30">
        <span className="material-symbols-outlined text-5xl text-primary/40">assignment_late</span>
        <h2 className="font-headline-md text-lg font-bold text-on-surface">No DPPs Published Yet</h2>
        <p className="text-xs text-on-surface-variant max-w-md mx-auto">
          Daily practice problems assigned by your batch faculty will appear here categorized by subject and chapter.
        </p>
      </div>
    );
  }

  // Filter chapters by search
  const chaptersList = activeSubjectData?.chapters || [];
  const filteredChapters = chaptersList.filter((ch) =>
    ch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.dpps.some((d) => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. HORIZONTAL SUBJECT SELECTOR TABS (PHYSICS, CHEMISTRY, BIOLOGY, ETC.)   */}
      {/* ========================================================================= */}
      <div className="bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-3xl p-2.5 shadow-sm">
        <div className={`grid gap-2 sm:gap-3 ${subjects.length === 1 ? "grid-cols-1" : subjects.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {subjects.map((subj) => {
            const isSelected = (activeSubjectData?.name || selectedSubject) === subj.name;
            const totalDpps = subj.chapters.reduce((sum, ch) => sum + ch.dpps.length, 0);
            const doneDpps = subj.chapters.reduce(
              (sum, ch) => sum + ch.dpps.filter((d) => d.status === "COMPLETED").length,
              0
            );

            return (
              <button
                key={subj.id}
                type="button"
                onClick={() => setSelectedSubject(subj.name)}
                className={`relative flex flex-col sm:flex-row items-center justify-center sm:justify-between p-3 sm:px-5 sm:py-3.5 rounded-2xl transition-all duration-200 text-center sm:text-left ${
                  isSelected
                    ? `bg-gradient-to-r ${subj.gradient || "from-primary to-primary-container"} text-white shadow-lg shadow-primary/20 scale-[1.01]`
                    : "bg-surface-container-low dark:bg-slate-800/60 hover:bg-surface-container text-on-surface hover:text-primary border border-outline-variant/20"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`material-symbols-outlined text-2xl ${isSelected ? "text-white" : subj.color || "text-primary"}`}>
                    {subj.icon || "science"}
                  </span>
                  <div>
                    <h3 className="font-headline-sm text-sm sm:text-base font-bold leading-tight">
                      {subj.name}
                    </h3>
                    <p className={`text-[10px] sm:text-xs ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                      {subj.chapters.length} Chapter{subj.chapters.length === 1 ? "" : "s"} &middot; {totalDpps} DPP{totalDpps === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {/* Progress Mini Badge */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold mt-2 sm:mt-0">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] ${isSelected ? "bg-white/20 text-white" : "bg-surface-container-high text-on-surface-variant"}`}>
                    {doneDpps}/{totalDpps} Done
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUBJECT HEADER & QUICK SEARCH                                          */}
      {/* ========================================================================= */}
      {activeSubjectData && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-3xl ${activeSubjectData.color || "text-primary"}`}>
              {activeSubjectData.icon || "science"}
            </span>
            <div>
              <h2 className="font-headline-md text-lg font-bold text-on-surface">
                {activeSubjectData.name} — Chapterwise DPPs
              </h2>
              <p className="text-xs text-on-surface-variant">
                Daily practice problems added by your faculty for {activeSubjectData.name}.
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chapter or DPP..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-low dark:bg-slate-800 border border-outline-variant/40 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CHAPTERS LIST WITH REAL CHAPTERWISE DPP CARDS                          */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {filteredChapters.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant space-y-2 border border-outline-variant/30">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">assignment_late</span>
            <p className="font-bold text-sm text-on-surface">
              {searchQuery ? "No matching chapters found" : `No DPPs added in ${activeSubjectData?.name || "this subject"} yet`}
            </p>
            <p className="text-xs text-on-surface-variant">
              {searchQuery
                ? `No chapter matches "${searchQuery}"`
                : "Your batch faculty has not published any DPPs for this subject yet."}
            </p>
          </div>
        ) : (
          filteredChapters.map((chapter) => {
            const isExpanded = expandedChapters[chapter.id] !== false; // Default expanded
            const chapterCompleted = chapter.dpps.filter((d) => d.status === "COMPLETED").length;

            return (
              <div
                key={chapter.id}
                className="bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-3xl overflow-hidden shadow-sm transition-all"
              >
                {/* Chapter Header Accordion Toggle */}
                <button
                  type="button"
                  onClick={() => toggleChapter(chapter.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-surface-container-low dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                      {chapter.chapterNumber}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface truncate">
                        Chapter {chapter.chapterNumber}: {chapter.title}
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        {chapter.dpps.length} Practice Paper{chapter.dpps.length === 1 ? "" : "s"} &middot; {chapterCompleted}/{chapter.dpps.length} Completed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      chapterCompleted === chapter.dpps.length && chapter.dpps.length > 0
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}>
                      {chapterCompleted === chapter.dpps.length && chapter.dpps.length > 0 ? "All Completed" : `${chapterCompleted}/${chapter.dpps.length}`}
                    </span>
                    <span className={`material-symbols-outlined text-xl text-on-surface-variant transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                      keyboard_arrow_down
                    </span>
                  </div>
                </button>

                {/* Chapter DPP Cards */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-0 border-t border-outline-variant/20">
                    {chapter.dpps.length === 0 ? (
                      <p className="text-xs text-on-surface-variant py-4 text-center">
                        No DPPs uploaded for this chapter yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                        {chapter.dpps.map((dpp, idx) => {
                          const dppNum = idx + 1;
                          return (
                            <div
                              key={dpp.id}
                              className="bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 rounded-2xl p-4 flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all group"
                            >
                              <div className="space-y-2">
                                {/* Badges */}
                                <div className="flex items-center justify-between gap-2">
                                  <span className="px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary font-black text-xs">
                                    DPP {dppNum < 10 ? `0${dppNum}` : dppNum}
                                  </span>

                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      dpp.difficulty === "EASY" || dpp.difficulty === "Fundamental"
                                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                        : dpp.difficulty === "HARD" || dpp.difficulty === "NEET Booster"
                                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-extrabold"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {dpp.difficulty}
                                  </span>
                                </div>

                                {/* Title */}
                                <h4 className="font-bold text-xs sm:text-sm text-on-surface leading-snug line-clamp-2">
                                  {dpp.title}
                                </h4>

                                {/* Meta Details */}
                                <div className="flex items-center gap-3 text-[11px] text-on-surface-variant pt-1">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-primary">quiz</span>
                                    {dpp.questionCount} Qs
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-primary">timer</span>
                                    {dpp.durationMins} Mins
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-primary">military_tech</span>
                                    {dpp.totalMarks} Marks
                                  </span>
                                </div>
                              </div>

                              {/* Actions & Status */}
                              <div className="pt-4 mt-2 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                                {dpp.status === "COMPLETED" ? (
                                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                                    <span className="material-symbols-outlined text-base">check_circle</span>
                                    <span>Score: {dpp.score ?? dpp.totalMarks}/{dpp.totalMarks}</span>
                                  </div>
                                ) : dpp.status === "IN_PROGRESS" ? (
                                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold">
                                    <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                                    <span>In Progress</span>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-on-surface-variant font-medium">
                                    Not Started
                                  </span>
                                )}

                                <div className="flex items-center gap-1.5">
                                  {/* Download PDF Action */}
                                  <button
                                    type="button"
                                    onClick={() => toast.success(`Downloading ${dpp.title} PDF Worksheet...`)}
                                    className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container text-on-surface-variant hover:text-primary transition"
                                    title="Download DPP Worksheet"
                                  >
                                    <span className="material-symbols-outlined text-sm">download</span>
                                  </button>

                                  {/* Attempt / Practice Button */}
                                  <Link
                                    href={dpp.testId ? `/tests/${dpp.testId}/attempt` : `/practice?dppId=${dpp.id}`}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-sm ${
                                      dpp.status === "COMPLETED"
                                        ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                                        : "bg-primary text-on-primary hover:opacity-90 active:scale-95"
                                    }`}
                                  >
                                    {dpp.status === "COMPLETED" ? "Re-attempt" : dpp.status === "IN_PROGRESS" ? "Resume" : "Attempt Now"}
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
