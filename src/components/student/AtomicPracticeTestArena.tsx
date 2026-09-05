"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TestPdfDownloadModal } from "@/components/test-portal/TestPdfDownloadModal";

export interface ChapterwiseTestItem {
  id: string;
  name: string;
  durationMin: number;
  questionCount: number;
  totalMarks: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  score?: number | null;
}

export interface ChapterGroupedTests {
  id: string;
  chapterNumber: number;
  title: string;
  tests: ChapterwiseTestItem[];
}

export interface SubjectChapterwiseTests {
  id: string;
  name: string;
  icon: string;
  color: string;
  gradient: string;
  chapters: ChapterGroupedTests[];
}

export interface TestSeriesTestItem {
  id: string;
  name: string;
  durationMin: number;
  questionCount: number;
  totalMarks: number;
  statusLabel: string;
  tone: string;
  canAttempt: boolean;
  canResume: boolean;
  canViewResult: boolean;
  isClosed: boolean;
  score?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface TestSeriesBoxItem {
  id: string;
  code: string;
  name: string;
  examType?: string | null;
  description?: string | null;
  targetBatch?: string | null;
  isEnrolled: boolean;
  tests: TestSeriesTestItem[];
}

export interface DemoTestProp {
  id: string;
  name: string;
  description?: string | null;
  durationMin: number;
  questionCount: number;
  totalMarks: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  score?: number | null;
}

export function AtomicPracticeTestArena({
  subjectTests = [],
  testSeriesBoxes = [],
  demoTest = null,
}: {
  subjectTests: SubjectChapterwiseTests[];
  testSeriesBoxes: TestSeriesBoxItem[];
  demoTest?: DemoTestProp | null;
}) {
  const [activeCategory, setActiveCategory] = useState<"CHAPTERWISE" | "TEST_SERIES">("CHAPTERWISE");

  // Chapterwise category state
  const defaultSubject = subjectTests[0]?.name || "Physics";
  const [selectedSubject, setSelectedSubject] = useState<string>(defaultSubject);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [chapterSearch, setChapterSearch] = useState("");

  // Test series category state
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});
  const [seriesSearch, setSeriesSearch] = useState("");

  const activeSubjectData = subjectTests.find((s) => s.name === selectedSubject) || subjectTests[0];

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const toggleSeries = (seriesId: string) => {
    setExpandedSeries((prev) => ({ ...prev, [seriesId]: !prev[seriesId] }));
  };

  // Stats calculation
  const totalChapterwiseTests = subjectTests.reduce(
    (sum, s) => sum + s.chapters.reduce((cSum, c) => cSum + c.tests.length, 0),
    0
  );
  const totalSeriesTests = testSeriesBoxes.reduce((sum, box) => sum + box.tests.length, 0);

  // Filtered Chapterwise Chapters
  const activeChaptersList = activeSubjectData?.chapters || [];
  const filteredChapters = activeChaptersList.filter(
    (ch) =>
      ch.title.toLowerCase().includes(chapterSearch.toLowerCase()) ||
      ch.tests.some((t) => t.name.toLowerCase().includes(chapterSearch.toLowerCase()))
  );

  // Filtered Test Series Boxes
  const filteredSeriesBoxes = testSeriesBoxes.filter(
    (b) =>
      b.name.toLowerCase().includes(seriesSearch.toLowerCase()) ||
      (b.targetBatch && b.targetBatch.toLowerCase().includes(seriesSearch.toLowerCase())) ||
      b.tests.some((t) => t.name.toLowerCase().includes(seriesSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* 1. TOP 2-CATEGORY SWITCHER: CHAPTERWISE TESTS vs TEST SERIES BOXES */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory("CHAPTERWISE")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeCategory === "CHAPTERWISE"
              ? "bg-orange-500 text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">menu_book</span>
          <span>1. Chapterwise Practice Tests</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeCategory === "CHAPTERWISE" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {totalChapterwiseTests}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("TEST_SERIES")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeCategory === "TEST_SERIES"
              ? "bg-purple-600 text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">military_tech</span>
          <span>2. Enrolled &amp; Batch Test Series</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeCategory === "TEST_SERIES" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {testSeriesBoxes.length} Box{testSeriesBoxes.length === 1 ? "" : "es"} &middot; {totalSeriesTests} Tests
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* CATEGORY 1: CHAPTERWISE PRACTICE TESTS                                    */}
      {/* ========================================================================= */}
      {activeCategory === "CHAPTERWISE" && (
        <div className="space-y-4">
          {/* Horizontal Subject Bar */}
          {subjectTests.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-2 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {subjectTests.map((subj) => {
                  const isSelected = (activeSubjectData?.name || selectedSubject) === subj.name;
                  const totalTests = subj.chapters.reduce((sum, ch) => sum + ch.tests.length, 0);
                  const completedTests = subj.chapters.reduce(
                    (sum, ch) => sum + ch.tests.filter((t) => t.status === "COMPLETED").length,
                    0
                  );

                  return (
                    <button
                      key={subj.id}
                      type="button"
                      onClick={() => setSelectedSubject(subj.name)}
                      className={`relative flex items-center justify-between p-2.5 sm:px-4 sm:py-3 rounded-xl transition-all duration-200 text-left cursor-pointer ${
                        isSelected
                          ? "bg-orange-500 text-white shadow-2xs"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`material-symbols-outlined text-2xl ${
                            isSelected ? "text-white" : subj.color || "text-orange-500"
                          }`}
                        >
                          {subj.icon || "science"}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold leading-tight truncate">
                            {subj.name}
                          </h3>
                          <p className={`text-[10px] sm:text-[11px] ${isSelected ? "text-white/80" : "text-slate-500"}`}>
                            {subj.chapters.length} Chapters &middot; {totalTests} Tests
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isSelected ? "bg-white/20 text-white" : "bg-white text-slate-600 border border-slate-200"
                        }`}
                      >
                        {completedTests}/{totalTests} Done
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className={`material-symbols-outlined text-2xl ${activeSubjectData?.color || "text-orange-500"}`}>
                {activeSubjectData?.icon || "science"}
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  {activeSubjectData?.name || "Subject"} — Chapterwise Practice Tests
                </h2>
                <p className="text-[11px] text-slate-500">
                  Tests automatically added as chapters and subjects are created in your batch.
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                placeholder="Search chapter or test..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>

          {/* Chapters Accordion */}
          <div className="space-y-3">
            {filteredChapters.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center text-slate-500 space-y-1.5 border border-slate-200/80">
                <span className="material-symbols-outlined text-4xl text-slate-300">quiz</span>
                <p className="font-bold text-sm text-slate-800">
                  {chapterSearch
                    ? "No matching chapters found"
                    : `No practice tests added in ${activeSubjectData?.name || "this subject"} yet`}
                </p>
                <p className="text-xs text-slate-400">
                  Practice tests will appear here as chapters are added to your batch courses.
                </p>
              </div>
            ) : (
              filteredChapters.map((chapter) => {
                const isExpanded = expandedChapters[chapter.id] !== false; // Default expanded
                const completed = chapter.tests.filter((t) => t.status === "COMPLETED").length;

                return (
                  <div
                    key={chapter.id}
                    className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => toggleChapter(chapter.id)}
                      className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 font-bold text-xs flex items-center justify-center shrink-0 border border-orange-200/60">
                          {chapter.chapterNumber}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            Chapter {chapter.chapterNumber}: {chapter.title}
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            {chapter.tests.length} Test{chapter.tests.length === 1 ? "" : "s"} &middot; {completed}/{chapter.tests.length} Completed
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            completed === chapter.tests.length && chapter.tests.length > 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {completed === chapter.tests.length && chapter.tests.length > 0
                            ? "All Done"
                            : `${completed}/${chapter.tests.length}`}
                        </span>
                        <span
                          className={`material-symbols-outlined text-lg text-slate-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        >
                          keyboard_arrow_down
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 sm:p-4 pt-0 border-t border-slate-100">
                        {chapter.tests.length === 0 ? (
                          <p className="text-xs text-slate-400 py-3 text-center">
                            No practice tests published for this chapter yet.
                          </p>
                        ) : (
                          <div className="space-y-2 pt-2.5">
                            {chapter.tests.map((test) => (
                              <div
                                key={test.id}
                                className="bg-white border border-slate-200/90 rounded-xl p-3 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 hover:shadow-2xs transition-all"
                              >
                                <div className="flex items-start sm:items-center gap-3 min-w-0">
                                  <div className="shrink-0 pt-0.5 sm:pt-0">
                                    {test.status === "COMPLETED" ? (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Score: {test.score}/{test.totalMarks}
                                      </span>
                                    ) : test.status === "IN_PROGRESS" ? (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        In Progress
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        Available
                                      </span>
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                      {test.name}
                                    </h4>
                                    <div className="flex items-center gap-2.5 text-[11px] text-slate-500 pt-0.5">
                                      <span>{test.questionCount} Questions</span>
                                      <span>&middot;</span>
                                      <span>{test.durationMin} Mins</span>
                                      <span>&middot;</span>
                                      <span>{test.totalMarks} Marks</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                  <TestPdfDownloadModal
                                    testId={test.id}
                                    testName={test.name}
                                    triggerButton={
                                      <button
                                        type="button"
                                        title="Download Test PDF"
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[16px] text-indigo-600">picture_as_pdf</span>
                                        <span>Download PDF</span>
                                      </button>
                                    }
                                  />

                                  <Link
                                    href={test.status === "COMPLETED" ? `/tests/${test.id}/result` : `/tests/${test.id}/attempt`}
                                    className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition shadow-2xs text-center ${
                                      test.status === "COMPLETED"
                                        ? "bg-slate-100 hover:bg-slate-200 text-slate-800"
                                        : "bg-orange-500 hover:bg-orange-600 text-white active:scale-95"
                                    }`}
                                  >
                                    {test.status === "COMPLETED" ? "View Analysis" : test.status === "IN_PROGRESS" ? "Resume" : "Start Test"}
                                  </Link>
                                </div>
                              </div>
                            ))}
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
      )}

      {/* ========================================================================= */}
      {/* CATEGORY 2: ENROLLED TEST SERIES & BATCH TEST SERIES BOXES                */}
      {/* ========================================================================= */}
      {activeCategory === "TEST_SERIES" && (
        <div className="space-y-4">
          {/* Search Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">inventory_2</span>
                <span>Enrolled &amp; Batch Test Series Boxes</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Official test series assigned to your batches with direct PDF downloads and instant analytics.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                value={seriesSearch}
                onChange={(e) => setSeriesSearch(e.target.value)}
                placeholder="Search test series or test..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>
          </div>

          {/* Test Series Boxes List */}
          {filteredSeriesBoxes.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-slate-500 space-y-1.5 border border-slate-200/80">
              <span className="material-symbols-outlined text-4xl text-purple-400">inventory_2</span>
              <h3 className="font-bold text-sm text-slate-800">No Test Series Boxes Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {seriesSearch
                  ? "No test series box matches your search query."
                  : "You are not enrolled in any test series yet, and no test series are scheduled in your batches."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSeriesBoxes.map((box) => {
                const isExpanded = expandedSeries[box.id] !== false; // Default expanded
                const completedCount = box.tests.filter((t) => t.canViewResult || t.statusLabel.includes("Completed")).length;

                return (
                  <div
                    key={box.id}
                    className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs transition-all"
                  >
                    {/* Test Series Box Header */}
                    <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase tracking-wider">
                            Atomic Test Series Box
                          </span>
                          {box.examType && (
                            <span className="px-2 py-0.5 rounded-md bg-white text-slate-600 border border-slate-200 text-[10px] font-bold">
                              {box.examType}
                            </span>
                          )}
                          {box.targetBatch && (
                            <span className="text-xs font-bold text-purple-600">
                              Batch: {box.targetBatch}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {box.name}
                        </h3>
                        {box.description && (
                          <p className="text-[11px] text-slate-500 max-w-2xl">{box.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-800 block">
                            {completedCount}/{box.tests.length} Tests Completed
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Code: {box.code}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleSeries(box.id)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                          title="Toggle Tests inside Box"
                        >
                          <span
                            className={`material-symbols-outlined text-lg text-slate-500 transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          >
                            keyboard_arrow_down
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Tests inside Test Series Box */}
                    {isExpanded && (
                      <div className="p-3 sm:p-4 space-y-2">
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Tests in this Series ({box.tests.length})
                        </h4>

                        {box.tests.length === 0 ? (
                          <div className="p-5 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                            No tests have been published in this test series yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {box.tests.map((t) => (
                              <div
                                key={t.id}
                                className="p-3 sm:px-4 sm:py-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-purple-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-2xs"
                              >
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${t.tone}`}
                                    >
                                      {t.statusLabel}
                                    </span>
                                    {t.startsAt && (
                                      <span className="text-[10px] text-slate-400">
                                        {new Date(t.startsAt).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{t.name}</h4>

                                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                    <span>{t.questionCount} Questions</span>
                                    <span>&middot;</span>
                                    <span>{t.durationMin} Mins</span>
                                    <span>&middot;</span>
                                    <span>{t.totalMarks} Marks</span>
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto">
                                  <TestPdfDownloadModal
                                    testId={t.id}
                                    testName={t.name}
                                    triggerButton={
                                      <button
                                        type="button"
                                        title="Download Test PDF"
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[16px] text-indigo-600">picture_as_pdf</span>
                                        <span>Download PDF</span>
                                      </button>
                                    }
                                  />

                                  {t.canAttempt || t.canResume ? (
                                    <Link
                                      href={`/tests/${t.id}/attempt`}
                                      className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs transition text-center active:scale-95"
                                    >
                                      {t.canResume ? "Resume Test" : "Start Test"}
                                    </Link>
                                  ) : t.canViewResult ? (
                                    <Link
                                      href={`/tests/${t.id}/result`}
                                      className="px-3.5 py-1.5 rounded-lg border border-purple-500 text-purple-600 hover:bg-purple-50 font-bold text-xs transition text-center"
                                    >
                                      Review Analysis
                                    </Link>
                                  ) : (
                                    <button
                                      disabled
                                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed"
                                    >
                                      {t.statusLabel}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
