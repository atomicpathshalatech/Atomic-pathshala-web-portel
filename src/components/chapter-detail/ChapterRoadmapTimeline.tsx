"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

export interface RoadmapTopicGroup {
  id: string;
  stepNumber: number;
  title: string;
  lectures: Array<{
    id: string;
    title: string;
    order: number;
    videoUrl: string;
    notesUrl?: string | null;
    isCompleted?: boolean;
    isLocked?: boolean;
  }>;
  notes?: Array<{
    id: string;
    title: string;
    pdfUrl?: string | null;
  }>;
}

interface ChapterRoadmapTimelineProps {
  roadmap: RoadmapTopicGroup[];
  startChapterHref?: string;
  batchId?: string;
  subjectId?: string;
  chapterId?: string;
}

export function ChapterRoadmapTimeline({
  roadmap,
  startChapterHref,
  batchId,
  subjectId,
  chapterId,
}: ChapterRoadmapTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [openStep, setOpenStep] = useState<number | null>(1);

  if (!roadmap || roadmap.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
        No lecture roadmap configured for this chapter yet.
      </div>
    );
  }

  const visibleSteps = expanded ? roadmap : roadmap.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {visibleSteps.map((step, idx) => {
          const isOpen = openStep === step.stepNumber;
          const isLast = idx === visibleSteps.length - 1 && (!expanded || idx === roadmap.length - 1);
          const videoCount = step.lectures.length;

          return (
            <div key={step.id} className="relative flex items-start gap-3.5">
              {/* Step Circle & Timeline Connector */}
              <div className="flex flex-col items-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenStep(isOpen ? null : step.stepNumber)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all ${
                    isOpen
                      ? "bg-primary text-on-primary ring-4 ring-primary/20 scale-105"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {step.stepNumber}
                </button>
                {!isLast && (
                  <div className="w-0.5 h-16 border-l-2 border-dashed border-slate-200 dark:border-slate-800 my-1" />
                )}
              </div>

              {/* Step Card (Clean Light / Dark Background) */}
              <div
                className={`flex-1 rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer ${
                  isOpen
                    ? "bg-white dark:bg-slate-900 border-primary/40 dark:border-primary/40 shadow-md"
                    : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                }`}
                onClick={() => setOpenStep(isOpen ? null : step.stepNumber)}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm sm:text-base font-bold text-[#031635] dark:text-white tracking-tight">
                    {step.title}
                  </h4>
                  <span className="material-symbols-outlined text-sm text-slate-400">
                    {isOpen ? "expand_less" : "expand_more"}
                  </span>
                </div>

                {/* Counter Meta Row: Videos & Class Notes */}
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-rose-500">play_circle</span>
                    <span className="font-medium">{videoCount} {videoCount === 1 ? "Video" : "Videos"}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-indigo-500">description</span>
                    <span className="font-medium">Class Notes</span>
                  </div>
                </div>

                {/* Expanded Detailed Items List */}
                {isOpen && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
                    {/* 1. Video Lecture Items */}
                    {step.lectures.map((l) => {
                      const lectureHref =
                        batchId && subjectId && chapterId
                          ? `/courses/${batchId}/subjects/${subjectId}/chapters/${chapterId}/lectures/${l.id}`
                          : l.videoUrl || "#";

                      return (
                        <div
                          key={l.id}
                          className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                              {l.order}
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 font-semibold line-clamp-1">
                              {l.title}
                            </span>
                          </div>

                          <Link
                            href={lectureHref}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition shadow-sm shrink-0"
                          >
                            Watch
                          </Link>
                        </div>
                      );
                    })}

                    {/* 2. Class Notes Item */}
                    {step.notes && step.notes.length > 0 ? (
                      step.notes.map((note) => (
                        <div
                          key={note.id}
                          className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-sm">description</span>
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 font-semibold line-clamp-1">
                              {note.title}
                            </span>
                          </div>

                          {note.pdfUrl ? (
                            <a
                              href={note.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 transition shadow-sm shrink-0 flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-xs">download</span>
                              <span>Notes</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toast.info("Notes will be available once uploaded by faculty.");
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600/80 text-white font-bold text-xs hover:bg-indigo-500 transition shadow-sm shrink-0 flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-xs">download</span>
                              <span>Notes</span>
                            </button>
                          )}
                        </div>
                      ))
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* View More / View Less Toggle Button */}
      {roadmap.length > 4 && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <span>{expanded ? "View Less" : "View More"}</span>
            <span className="material-symbols-outlined text-sm">
              {expanded ? "expand_less" : "expand_more"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
