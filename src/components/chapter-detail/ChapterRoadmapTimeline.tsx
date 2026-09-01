"use client";

import React, { useState } from "react";
import Link from "next/link";

export interface RoadmapTopicGroup {
  id: string;
  stepNumber: number;
  title: string;
  lectures: Array<{
    id: string;
    title: string;
    order: number;
    videoUrl: string;
    isCompleted?: boolean;
    isLocked?: boolean;
  }>;
  dpps: Array<{
    id: string;
    code: string;
    name: string;
    level?: number | null;
    isCompleted?: boolean;
  }>;
  test?: {
    id: string;
    name: string;
    durationMin: number;
  } | null;
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
      <div className="glass-card rounded-2xl p-6 text-center text-xs text-slate-400 border border-slate-800">
        No roadmap items configured for this chapter yet.
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
          const dppCount = step.dpps.length;
          const hasTest = !!step.test;

          return (
            <div key={step.id} className="relative flex items-start gap-3.5">
              {/* Step Circle & Timeline Connector */}
              <div className="flex flex-col items-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenStep(isOpen ? null : step.stepNumber)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md transition-all ${
                    isOpen
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black ring-4 ring-amber-500/20"
                      : "bg-[#251f38] text-slate-200 border border-slate-700"
                  }`}
                >
                  {step.stepNumber}
                </button>
                {!isLast && (
                  <div className="w-0.5 h-14 border-l-2 border-dashed border-slate-700 my-1" />
                )}
              </div>

              {/* Step Card */}
              <div
                className={`flex-1 rounded-2xl p-4 border transition-all cursor-pointer ${
                  isOpen
                    ? "bg-[#141627] border-slate-700 shadow-xl"
                    : "bg-[#111322]/80 border-slate-800/80 hover:border-slate-700"
                }`}
                onClick={() => setOpenStep(isOpen ? null : step.stepNumber)}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    {step.title}
                  </h4>
                  <span className="material-symbols-outlined text-sm text-slate-400">
                    {isOpen ? "expand_less" : "expand_more"}
                  </span>
                </div>

                {/* Counter Meta Row (Matches Reference Exactly) */}
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-rose-400">play_circle</span>
                    <span>{videoCount} {videoCount === 1 ? "Video" : "Videos"}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-indigo-400">assignment</span>
                    <span>{dppCount} {dppCount === 1 ? "DPP" : "DPPs"}</span>
                  </div>
                  {hasTest && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-emerald-400">quiz</span>
                        <span>1 Chapter Test</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Expanded Detailed Items List */}
                {isOpen && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                    {step.lectures.map((l) => {
                      const lectureHref = batchId && subjectId && chapterId
                        ? `/courses/${batchId}/subjects/${subjectId}/chapters/${chapterId}/lectures/${l.id}`
                        : l.videoUrl;

                      return (
                        <div
                          key={l.id}
                          className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-[10px]">
                              {l.order}
                            </span>
                            <span className="text-slate-200 font-medium line-clamp-1">{l.title}</span>
                          </div>
                          <a
                            href={lectureHref}
                            className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-semibold text-[10px] transition"
                          >
                            Watch
                          </a>
                        </div>
                      );
                    })}

                    {step.dpps.map((d) => (
                      <div
                        key={d.id}
                        className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                            {d.code}
                          </span>
                          <span className="text-slate-200 font-medium line-clamp-1">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Practice Sheet</span>
                      </div>
                    ))}

                    {step.test && (
                      <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                            TEST
                          </span>
                          <span className="text-slate-200 font-medium line-clamp-1">{step.test.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{step.test.durationMin} mins</span>
                      </div>
                    )}
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1e2238] hover:bg-[#282d49] text-xs font-bold text-slate-200 transition border border-slate-700/60 shadow-sm"
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