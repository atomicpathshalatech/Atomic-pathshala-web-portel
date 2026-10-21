"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Plus,
  ArrowRight,
  Maximize2,
  X,
  Layers,
  Sparkles,
} from "lucide-react";

export interface ChapterExerciseItem {
  id: string;
  exerciseCode: string;
  title: string;
  subtitle: string | null;
  subject: string;
  chapter: string;
  exerciseType: string;
  status: string;
  _count: {
    questions: number;
    sections: number;
  };
}

export interface ChapterModuleItem {
  subject: string;
  chapter: string;
  totalQuestions: number;
  exercises: ChapterExerciseItem[];
}

interface ChapterModulesGridProps {
  chapterModules: ChapterModuleItem[];
  canCreate?: boolean;
}

function subjectBadgeStyle(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes("bio") || s.includes("bot") || s.includes("zoo")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
  }
  if (s.includes("chem")) {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  }
  if (s.includes("phys")) {
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
  }
  if (s.includes("math")) {
    return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800";
  }
  return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
}

export function ChapterModulesGrid({
  chapterModules,
  canCreate = false,
}: ChapterModulesGridProps) {
  // Map of chapter keys currently expanded inline
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  // Chapter currently open in the dedicated modal
  const [modalChapter, setModalChapter] = useState<ChapterModuleItem | null>(null);

  const getChapterKey = (cm: ChapterModuleItem) =>
    `${cm.subject.trim().toLowerCase()}:::${cm.chapter.trim().toLowerCase()}`;

  const toggleExpand = (cm: ChapterModuleItem) => {
    const key = getChapterKey(cm);
    setExpandedMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    for (const cm of chapterModules) {
      next[getChapterKey(cm)] = true;
    }
    setExpandedMap(next);
  };

  const handleCollapseAll = () => {
    setExpandedMap({});
  };

  const expandedCount = Object.values(expandedMap).filter(Boolean).length;

  if (chapterModules.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Quick Action & Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {chapterModules.length} {chapterModules.length === 1 ? "Chapter Box" : "Chapter Boxes"}
          </span>
          <span className="text-slate-300 dark:text-slate-700">&bull;</span>
          <span className="text-slate-400">
            Click any chapter box to view its exercises
          </span>
        </div>

        <div className="flex items-center gap-2">
          {expandedCount > 0 ? (
            <button
              type="button"
              onClick={handleCollapseAll}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition cursor-pointer"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Collapse All ({expandedCount})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExpandAll}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition cursor-pointer"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Expand All</span>
            </button>
          )}
        </div>
      </div>

      {/* COMPACT CHAPTER BOXES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 items-start">
        {chapterModules.map((cm, idx) => {
          const key = getChapterKey(cm);
          const isExpanded = !!expandedMap[key];

          return (
            <div
              key={`${key}-${idx}`}
              className={`group rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 shadow-2xs ${
                isExpanded
                  ? "border-amber-400 ring-2 ring-amber-400/20 shadow-md col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-2"
                  : "border-slate-200 hover:border-amber-400 hover:shadow-sm dark:border-slate-800"
              }`}
            >
              {/* Box Header: Always Visible & Clickable */}
              <div
                onClick={() => toggleExpand(cm)}
                className="p-3.5 cursor-pointer select-none space-y-2.5"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpand(cm);
                  }
                }}
              >
                {/* Subject & Question Count Badges */}
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${subjectBadgeStyle(
                      cm.subject
                    )}`}
                  >
                    {cm.subject}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {cm.totalQuestions} Qs
                    </span>

                    {/* Maximize to Modal Button */}
                    <button
                      type="button"
                      title="Open in Full Dialog"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalChapter(cm);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Chapter Title */}
                <div>
                  <h3
                    className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2.5rem] group-hover:text-amber-600 transition"
                    title={cm.chapter}
                  >
                    {cm.chapter}
                  </h3>
                </div>

                {/* Bottom Status / Toggle Indicator */}
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400">
                    <BookOpen className="h-3 w-3 text-amber-500" />
                    <span>{cm.exercises.length} {cm.exercises.length === 1 ? "Exercise" : "Exercises"}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 font-bold text-[11px] transition ${
                      isExpanded ? "text-amber-600" : "text-slate-400 group-hover:text-amber-600"
                    }`}
                  >
                    <span>{isExpanded ? "Hide" : "Exercises"}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </span>
                </div>
              </div>

              {/* EXPANDED EXERCISES SECTION (Shown on Click) */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-950/40 rounded-b-2xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Included Exercises ({cm.exercises.length}):</span>
                    <span>Action</span>
                  </div>

                  <div className="space-y-1.5">
                    {cm.exercises.map((ex, exIndex) => (
                      <Link
                        key={ex.id}
                        href={`/team/exercises/${ex.id}`}
                        className="group/item flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-2.5 hover:border-amber-400 hover:bg-amber-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] font-black group-hover/item:bg-amber-600 group-hover/item:text-white transition">
                            {exIndex + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 group-hover/item:text-amber-700 dark:text-white truncate transition">
                              {ex.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {ex.exerciseType.replace(/_/g, " ")} &bull; {ex._count.sections} sec
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {ex._count.questions} Qs
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-400 group-hover/item:text-amber-600 transition" />
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Actions inside expanded chapter */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                    <Link
                      href={`/team/exercises/new?subject=${encodeURIComponent(cm.subject)}&chapter=${encodeURIComponent(cm.chapter)}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                    >
                      <Plus className="h-3 w-3 text-blue-600" />
                      <span>Add Exercise {cm.exercises.length + 1}</span>
                    </Link>

                    {cm.exercises[0] && (
                      <Link
                        href={`/team/exercises/${cm.exercises[0].id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-500"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DEDICATED CHAPTER EXERCISES MODAL */}
      {modalChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${subjectBadgeStyle(
                      modalChapter.subject
                    )}`}
                  >
                    {modalChapter.subject}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {modalChapter.exercises.length} Exercises &bull; {modalChapter.totalQuestions} Questions
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {modalChapter.chapter}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setModalChapter(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Exercises List in Modal */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {modalChapter.exercises.map((ex, exIndex) => (
                <Link
                  key={ex.id}
                  href={`/team/exercises/${ex.id}`}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 hover:border-amber-400 hover:bg-amber-50/50 transition dark:border-slate-800 dark:bg-slate-850 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[11px] font-black group-hover:bg-amber-600 group-hover:text-white transition">
                      {exIndex + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-800 dark:text-white transition line-clamp-1">
                        {ex.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {ex.exerciseType.replace(/_/g, " ")} &bull; {ex._count.sections} sections
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {ex._count.questions} Qs
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 transition" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <Link
                href={`/team/exercises/new?subject=${encodeURIComponent(modalChapter.subject)}&chapter=${encodeURIComponent(modalChapter.chapter)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
              >
                <Plus className="h-3.5 w-3.5 text-blue-600" />
                <span>Add Exercise {modalChapter.exercises.length + 1}</span>
              </Link>

              {modalChapter.exercises[0] && (
                <Link
                  href={`/team/exercises/${modalChapter.exercises[0].id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-500 transition"
                >
                  <span>Open Primary Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
