"use client";

import React, { useState } from "react";
import { ChapterLecturesTab, LectureItem } from "./ChapterLecturesTab";
import { ChapterDppsTab, DppItem } from "./ChapterDppsTab";
import { ChapterTestsTab, TestItem } from "./ChapterTestsTab";

interface ChapterContentManagerProps {
  chapterId: string;
  chapterTitle: string;
  chapterMedium: string;
  initialLectures: LectureItem[];
  initialDpps: DppItem[];
  initialTests: TestItem[];
  canEdit: boolean;
}

export function ChapterContentManager({
  chapterId,
  chapterTitle,
  chapterMedium,
  initialLectures,
  initialDpps,
  initialTests,
  canEdit,
}: ChapterContentManagerProps) {
  const [activeTab, setActiveTab] = useState<"lectures" | "dpps" | "tests">("lectures");

  return (
    <div className="space-y-6 pt-2">
      {/* Navigation Pills */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("lectures")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "lectures"
              ? "bg-amber-500 text-black shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <span className="material-symbols-outlined text-base">video_library</span>
          <span>Lectures</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-xs font-mono">
            {initialLectures.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dpps")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "dpps"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <span className="material-symbols-outlined text-base">assignment</span>
          <span>DPPs</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-xs font-mono">
            {initialDpps.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tests")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === "tests"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <span className="material-symbols-outlined text-base">quiz</span>
          <span>Chapter Tests</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-xs font-mono">
            {initialTests.length}
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "lectures" && (
        <ChapterLecturesTab
          chapterId={chapterId}
          chapterTitle={chapterTitle}
          chapterMedium={chapterMedium}
          lectures={initialLectures}
          canEdit={canEdit}
        />
      )}

      {activeTab === "dpps" && (
        <ChapterDppsTab
          chapterId={chapterId}
          chapterTitle={chapterTitle}
          dpps={initialDpps}
          canEdit={canEdit}
        />
      )}

      {activeTab === "tests" && (
        <ChapterTestsTab
          chapterId={chapterId}
          chapterTitle={chapterTitle}
          tests={initialTests}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}