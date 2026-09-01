"use client";

import React, { useState } from "react";
import { ChapterContentManager } from "./ChapterContentManager";
import { ChapterDetailView, ChapterDetailData } from "@/components/chapter-detail/ChapterDetailView";
import { ChapterStatusActions } from "./ChapterStatusActions";
import type { ChapterStatusValue } from "@/lib/chapters/state-machine";

interface ChapterTeamViewWrapperProps {
  chapterId: string;
  chapterTitle: string;
  chapterMedium: string;
  chapterStatus: string;
  initialLectures: any[];
  initialDpps: any[];
  initialTests: any[];
  canEdit: boolean;
  studentPreviewData: ChapterDetailData;
}

export function ChapterTeamViewWrapper({
  chapterId,
  chapterTitle,
  chapterMedium,
  chapterStatus,
  initialLectures,
  initialDpps,
  initialTests,
  canEdit,
  studentPreviewData,
}: ChapterTeamViewWrapperProps) {
  const [viewMode, setViewMode] = useState<"manager" | "preview">("manager");

  return (
    <div className="space-y-6">
      {/* Mode Switcher Banner */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-2 rounded-2xl">
        <div className="flex items-center gap-2 pl-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-xs font-bold text-slate-200">Chapter Experience View:</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode("manager")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === "manager"
                ? "bg-amber-500 text-black shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-sm">tune</span>
            <span>Content Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === "preview"
                ? "bg-rose-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-sm">phone_iphone</span>
            <span>Student UI Reference</span>
          </button>
        </div>
      </div>

      {viewMode === "manager" ? (
        <div className="space-y-6">
          {/* Move Chapter Forward */}
          <div className="glass-card p-stack-lg rounded-xl space-y-3">
            <h3 className="font-headline-md text-headline-md text-primary">Move Chapter Forward</h3>
            <ChapterStatusActions chapterId={chapterId} status={chapterStatus as ChapterStatusValue} />
          </div>

          {/* Interactive Content Manager: Lectures, DPPs, and Chapter Tests */}
          <div className="glass-card p-stack-lg rounded-2xl space-y-4">
            <ChapterContentManager
              chapterId={chapterId}
              chapterTitle={chapterTitle}
              chapterMedium={chapterMedium}
              initialLectures={initialLectures}
              initialDpps={initialDpps}
              initialTests={initialTests}
              canEdit={canEdit}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-800 bg-[#090b14] overflow-hidden shadow-2xl">
          <ChapterDetailView
            data={studentPreviewData}
            backHref="/team/chapters"
            isTeacherView={true}
          />
        </div>
      )}
    </div>
  );
}