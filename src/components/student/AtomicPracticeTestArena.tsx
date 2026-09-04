"use client";

import React, { useState } from "react";
import Link from "next/link";

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
      {/* ========================================================================= */}
      {/* FEATURED: ATOMIC PATHSHALA DEMO CBT SIMULATOR CARD                         */}
      {/* ========================================================================= */}
      {demoTest && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-700 border-2 border-indigo-300/30 rounded-3xl p-5 sm:p-7 shadow-xl shadow-indigo-950/15 space-y-4 relative overflow-hidden group text-white">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -z-0 pointer-events-none group-hover:bg-white/15 transition-all" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-emerald-400/20 rounded-full blur-2xl -z-0 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
                  LIVE DEMO CBT SIMULATOR
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/30 text-[10px] font-bold backdrop-blur-md">
                  Bilingual: English / हिंदी
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/30 text-[10px] font-bold backdrop-blur-md">
                  NEET Standard (+4 / -1)
                </span>
              </div>

              <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2">
                <span>{demoTest.name}</span>
              </h2>

              <p className="text-xs sm:text-sm text-indigo-100 max-w-2xl leading-relaxed">
                {demoTest.description || "10 प्रश्नों वाला Demo Test — Student Test Interface, Question Palette, Review, Language और Result Flow को test करने के लिए।"}
              </p>

              {/* Subject Breakdown Badges */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-xs text-indigo-200 font-bold">Subjects:</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-white/15 text-white text-[11px] font-bold border border-white/20 backdrop-blur-sm">
                  Biology (4 Qs)
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-white/15 text-white text-[11px] font-bold border border-white/20 backdrop-blur-sm">
                  Chemistry (3 Qs)
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-white/15 text-white text-[11px] font-bold border border-white/20 backdrop-blur-sm">
                  Physics (3 Qs)
                </span>
              </div>
            </div>

            {/* Test Card Actions & Status */}
            <div className="flex flex-col items-start sm:items-end gap-2.5 shrink-0 self-start sm:self-center">
              <div className="flex items-center gap-3 text-xs font-bold text-indigo-100">
                <span>⏱️ {demoTest.durationMin} Mins</span>
                <span>•</span>
                <span>🎯 {demoTest.questionCount} Questions</span>
                <span>•</span>
                <span>🏆 {demoTest.totalMarks} Marks</span>
              </div>

              {demoTest.status === "COMPLETED" ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3.5 py-2 rounded-xl bg-white/20 text-white border border-white/30 text-xs font-black backdrop-blur-md">
                    Score: {demoTest.score ?? 0}/{demoTest.totalMarks}
                  </span>
                  <Link
                    href={`/tests/${demoTest.id}/result`}
                    className="px-5 py-2.5 rounded-2xl bg-white hover:bg-indigo-50 text-indigo-700 font-black text-xs shadow-lg transition active:scale-95"
                  >
                    View Result &amp; Analysis
                  </Link>
                </div>
              ) : demoTest.status === "IN_PROGRESS" ? (
                <Link
                  href={`/tests/${demoTest.id}/attempt`}
                  className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition flex items-center gap-1.5 animate-bounce"
                >
                  <span className="material-symbols-outlined text-base">play_arrow</span>
                  <span>Resume Test</span>
                </Link>
              ) : (
                <Link
                  href={`/tests/${demoTest.id}/attempt`}
                  className="px-7 py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">rocket_launch</span>
                  <span>Start Test</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP 2-CATEGORY SWITCHER: CHAPTERWISE TESTS vs TEST SERIES BOXES        */}
      {/* ========================================================================= */}
      <div className="bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-3xl p-2 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory("CHAPTERWISE")}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm transition-all ${
            activeCategory === "CHAPTERWISE"
              ? "bg-primary text-on-primary shadow-md shadow-primary/20 scale-[1.01]"
              : "bg-surface-container-low dark:bg-slate-800/60 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <span className="material-symbols-outlined text-lg sm:text-xl">menu_book</span>
          <span>1. Chapterwise Practice Tests</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeCategory === "CHAPTERWISE" ? "bg-white/20 text-white" : "bg-surface-container-high text-on-surface"
            }`}
          >
            {totalChapterwiseTests}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("TEST_SERIES")}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl font-bold text-xs sm:text-sm transition-all ${
            activeCategory === "TEST_SERIES"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20 scale-[1.01]"
              : "bg-surface-container-low dark:bg-slate-800/60 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <span className="material-symbols-outlined text-lg sm:text-xl">military_tech</span>
          <span>2. Enrolled &amp; Batch Test Series</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
              activeCategory === "TEST_SERIES" ? "bg-white/20 text-white" : "bg-surface-container-high text-on-surface"
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
        <div className="space-y-6">
          {/* Horizontal Subject Bar */}
          {subjectTests.length > 0 && (
            <div className="bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-3xl p-2.5 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
                      className={`relative flex flex-col sm:flex-row items-center justify-center sm:justify-between p-3 sm:px-5 sm:py-3.5 rounded-2xl transition-all duration-200 text-center sm:text-left ${
                        isSelected
                          ? `bg-gradient-to-r ${subj.gradient || "from-primary to-primary-container"} text-white shadow-lg shadow-primary/20 scale-[1.01]`
                          : "bg-surface-container-low dark:bg-slate-800/60 hover:bg-surface-container text-on-surface hover:text-primary border border-outline-variant/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`material-symbols-outlined text-2xl ${
                            isSelected ? "text-white" : subj.color || "text-primary"
                          }`}
                        >
                          {subj.icon || "science"}
                        </span>
                        <div>
                          <h3 className="font-headline-sm text-sm sm:text-base font-bold leading-tight">
                            {subj.name}
                          </h3>
                          <p className={`text-[10px] sm:text-xs ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}>
                            {subj.chapters.length} Chapters &middot; {totalTests} Tests
                          </p>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold mt-2 sm:mt-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] ${
                            isSelected ? "bg-white/20 text-white" : "bg-surface-container-high text-on-surface-variant"
                          }`}
                        >
                          {completedTests}/{totalTests} Done
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-3xl ${activeSubjectData?.color || "text-primary"}`}>
                {activeSubjectData?.icon || "science"}
              </span>
              <div>
                <h2 className="font-headline-md text-base sm:text-lg font-bold text-on-surface">
                  {activeSubjectData?.name || "Subject"} — Chapterwise Practice Tests
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Tests automatically added as chapters and subjects are created in your batch.
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                placeholder="Search chapter or test..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-low dark:bg-slate-800 border border-outline-variant/40 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Chapters Accordion */}
          <div className="space-y-4">
            {filteredChapters.length === 0 ? (
              <div className="glass-card rounded-3xl p-12 text-center text-on-surface-variant space-y-2 border border-outline-variant/30">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">quiz</span>
                <p className="font-bold text-sm text-on-surface">
                  {chapterSearch
                    ? "No matching chapters found"
                    : `No practice tests added in ${activeSubjectData?.name || "this subject"} yet`}
                </p>
                <p className="text-xs text-on-surface-variant">
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
                    className="bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-3xl overflow-hidden shadow-sm transition-all"
                  >
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
                            {chapter.tests.length} Test{chapter.tests.length === 1 ? "" : "s"} &middot; {completed}/{chapter.tests.length} Completed
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            completed === chapter.tests.length && chapter.tests.length > 0
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                              : "bg-surface-container-high text-on-surface-variant"
                          }`}
                        >
                          {completed === chapter.tests.length && chapter.tests.length > 0
                            ? "All Done"
                            : `${completed}/${chapter.tests.length}`}
                        </span>
                        <span
                          className={`material-symbols-outlined text-xl text-on-surface-variant transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        >
                          keyboard_arrow_down
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 sm:p-5 pt-0 border-t border-outline-variant/20">
                        {chapter.tests.length === 0 ? (
                          <p className="text-xs text-on-surface-variant py-4 text-center">
                            No practice tests published for this chapter yet.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                            {chapter.tests.map((test) => (
                              <div
                                key={test.id}
                                className="bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 rounded-2xl p-4 flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all group"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary font-black text-[11px]">
                                      Chapter Test
                                    </span>
                                    {test.status === "COMPLETED" ? (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                                        Score: {test.score}/{test.totalMarks}
                                      </span>
                                    ) : test.status === "IN_PROGRESS" ? (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600">
                                        In Progress
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600">
                                        Available
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="font-bold text-xs sm:text-sm text-on-surface leading-snug line-clamp-2">
                                    {test.name}
                                  </h4>

                                  <div className="flex items-center gap-3 text-[11px] text-on-surface-variant pt-1">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm text-primary">quiz</span>
                                      {test.questionCount} Qs
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm text-primary">timer</span>
                                      {test.durationMin} Mins
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm text-primary">military_tech</span>
                                      {test.totalMarks} Mks
                                    </span>
                                  </div>
                                </div>

                                <div className="pt-4 mt-2 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-on-surface-variant font-medium">
                                    {test.status === "COMPLETED" ? "Submitted" : "Online Practice"}
                                  </span>

                                  <Link
                                    href={test.status === "COMPLETED" ? `/tests/${test.id}/result` : `/tests/${test.id}/attempt`}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-sm ${
                                      test.status === "COMPLETED"
                                        ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                                        : "bg-primary text-on-primary hover:opacity-90 active:scale-95"
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
        <div className="space-y-6">
          {/* Search Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface dark:bg-slate-900 border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
            <div>
              <h2 className="font-headline-md text-base sm:text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">inventory_2</span>
                <span>Enrolled &amp; Batch Test Series Boxes</span>
              </h2>
              <p className="text-xs text-on-surface-variant">
                Every test series you enroll in or assigned in your batch creates a dedicated test box below.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                value={seriesSearch}
                onChange={(e) => setSeriesSearch(e.target.value)}
                placeholder="Search test series or test..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-low dark:bg-slate-800 border border-outline-variant/40 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>
          </div>

          {/* Test Series Boxes List */}
          {filteredSeriesBoxes.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center text-on-surface-variant space-y-2 border border-outline-variant/30">
              <span className="material-symbols-outlined text-5xl text-purple-400">inventory_2</span>
              <h3 className="font-bold text-sm text-on-surface">No Test Series Boxes Found</h3>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                {seriesSearch
                  ? "No test series box matches your search query."
                  : "You are not enrolled in any test series yet, and no test series are scheduled in your batches."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredSeriesBoxes.map((box) => {
                const isExpanded = expandedSeries[box.id] !== false; // Default expanded
                const completedCount = box.tests.filter((t) => t.canViewResult || t.statusLabel.includes("Completed")).length;

                return (
                  <div
                    key={box.id}
                    className="bg-surface dark:bg-slate-900 border-2 border-purple-500/30 dark:border-purple-500/20 rounded-3xl overflow-hidden shadow-md transition-all"
                  >
                    {/* Test Series Box Header */}
                    <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-900/10 via-indigo-900/5 to-transparent border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                            Test Series Box
                          </span>
                          {box.examType && (
                            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface text-[10px] font-bold">
                              {box.examType}
                            </span>
                          )}
                          {box.targetBatch && (
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                              Batch: {box.targetBatch}
                            </span>
                          )}
                        </div>

                        <h3 className="font-headline-lg text-lg sm:text-xl font-black text-on-surface">
                          {box.name}
                        </h3>
                        {box.description && (
                          <p className="text-xs text-on-surface-variant max-w-2xl">{box.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                        <div className="text-right">
                          <span className="text-xs font-bold text-on-surface block">
                            {completedCount}/{box.tests.length} Tests Completed
                          </span>
                          <span className="text-[10px] text-on-surface-variant font-mono">Code: {box.code}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleSeries(box.id)}
                          className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest transition"
                          title="Toggle Tests inside Box"
                        >
                          <span
                            className={`material-symbols-outlined text-xl text-on-surface-variant transition-transform duration-200 ${
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
                      <div className="p-5 sm:p-6 space-y-3">
                        <h4 className="text-xs font-extrabold text-on-surface uppercase tracking-wider mb-2">
                          Tests inside {box.name} ({box.tests.length})
                        </h4>

                        {box.tests.length === 0 ? (
                          <div className="p-6 rounded-2xl bg-surface-container-low text-center text-xs text-on-surface-variant">
                            No tests have been published in this test series yet.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            {box.tests.map((t) => (
                              <div
                                key={t.id}
                                className="p-4 rounded-2xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/30 hover:border-purple-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm"
                              >
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${t.tone}`}
                                    >
                                      {t.statusLabel}
                                    </span>
                                    {t.startsAt && (
                                      <span className="text-[11px] text-on-surface-variant">
                                        {new Date(t.startsAt).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="font-bold text-sm text-on-surface">{t.name}</h4>

                                  <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm text-purple-600">quiz</span>
                                      {t.questionCount} Questions
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm text-purple-600">timer</span>
                                      {t.durationMin} Mins
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm text-purple-600">military_tech</span>
                                      {t.totalMarks} Marks
                                    </span>
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                  {t.canAttempt || t.canResume ? (
                                    <Link
                                      href={`/tests/${t.id}/attempt`}
                                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition text-center"
                                    >
                                      {t.canResume ? "Resume Test" : "Start Test"}
                                    </Link>
                                  ) : t.canViewResult ? (
                                    <Link
                                      href={`/tests/${t.id}/result`}
                                      className="px-4 py-2.5 rounded-xl border border-purple-500 text-purple-600 hover:bg-purple-500/10 font-bold text-xs transition text-center"
                                    >
                                      Review Analysis
                                    </Link>
                                  ) : (
                                    <button
                                      disabled
                                      className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface opacity-60 text-xs font-bold cursor-not-allowed"
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
