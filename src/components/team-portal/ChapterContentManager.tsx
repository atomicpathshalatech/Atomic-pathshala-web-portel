"use client";

import React, { useState } from "react";
import { ChapterLecturesTab, LectureItem } from "./ChapterLecturesTab";
import { ChapterDppsTab, DppItem } from "./ChapterDppsTab";
import { ChapterTestsTab, TestItem } from "./ChapterTestsTab";
import { Video, FileText, HelpCircle } from "lucide-react";

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
    <div className="space-y-6">
      {/* Navigation Pills with Crisp Color Scheme */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("lectures")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === "lectures"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Lectures</span>
          <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === "lectures" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
            {initialLectures.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dpps")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === "dpps"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>DPPs</span>
          <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === "dpps" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
            {initialDpps.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tests")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === "tests"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Chapter Tests</span>
          <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === "tests" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
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