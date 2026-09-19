"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TestPdfDownloadModal } from "@/components/test-portal/TestPdfDownloadModal";
import { BATCH_GRADIENT_THEMES } from "@/components/course-platform/CourseCard";

const getBatchTheme = (idx: number) => {
  const t = BATCH_GRADIENT_THEMES[Math.abs(idx) % BATCH_GRADIENT_THEMES.length];
  if (t) return t;
  return {
    cardBg: "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/15",
    cardBorder: "border-emerald-200/90",
    headerGrad: "from-emerald-600 via-teal-600 to-emerald-800",
    accentText: "text-emerald-700",
    pillBg: "bg-emerald-500/10 text-emerald-800 border-emerald-200/80",
    btnGrad: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white",
    statBorder: "border-emerald-100",
  };
};

export interface ChapterwiseTestItem {
  id: string;
  name: string;
  durationMin: number;
  questionCount: number;
  totalMarks: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "UPCOMING";
  score?: number | null;
  startsAt?: string | null;
  availableFrom?: string | null;
}

export interface ChapterGroupedTests {
  id: string;
  chapterNumber: number;
  title: string;
  branch?: "PHYSICAL" | "INORGANIC" | "ORGANIC" | "BOTANY" | "ZOOLOGY" | "GENERAL";
  branchLabel?: string;
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
  const [currentView, setCurrentView] = useState<"ROOT" | "TEST_SERIES" | "CHAPTERWISE_SUBJECTS" | "CHAPTERWISE_CHAPTERS">("ROOT");

  // Chapterwise category state
  const defaultSubject = subjectTests[0]?.name || "Physics";
  const [selectedSubject, setSelectedSubject] = useState<string>(defaultSubject);
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [chapterSearch, setChapterSearch] = useState("");

  // Test series category state
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});
  const [seriesSearch, setSeriesSearch] = useState("");

  const activeSubjectData = subjectTests.find((s) => s.name === selectedSubject) || subjectTests[0];

  const handleSubjectChange = (name: string) => {
    setSelectedSubject(name);
    setSelectedBranch("ALL");
  };

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

  // Filtered Chapterwise Chapters by Search and Sub-branch
  const activeChaptersList = activeSubjectData?.chapters || [];
  const filteredChapters = activeChaptersList.filter((ch) => {
    const matchesSearch =
      ch.title.toLowerCase().includes(chapterSearch.toLowerCase()) ||
      ch.tests.some((t) => t.name.toLowerCase().includes(chapterSearch.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedBranch === "ALL") return true;
    return ch.branch === selectedBranch;
  });

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
      {/* 1. ROOT VIEW: 2 PRIMARY BOXES (TEST SERIES & CHAPTER WISE TEST)            */}
      {/* ========================================================================= */}
      {currentView === "ROOT" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Box 1: Test Series (Batch & Enrolled Test Series) */}
            <button
              type="button"
              onClick={() => setCurrentView("TEST_SERIES")}
              className={`group relative flex min-h-[96px] flex-col justify-between rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer border hover:shadow-md hover:scale-[1.01] ${getBatchTheme(1).cardBg} ${getBatchTheme(1).cardBorder}`}
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-110 bg-purple-600 text-white ring-purple-400">
                  <span className="material-symbols-outlined text-[22px]">military_tech</span>
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-purple-600 text-white shadow-2xs">
                  {totalSeriesTests} Tests &middot; {testSeriesBoxes.length} Series
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <span className="text-[15px] font-extrabold leading-tight text-slate-900 block">
                    Test Series
                  </span>
                  <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                    Batch &amp; Enrolled Test Series &middot; Mock CBT
                  </p>
                </div>
                <div className="flex items-center gap-1 text-purple-700 font-bold text-xs group-hover:translate-x-1 transition-transform shrink-0">
                  <span>Enter</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </div>
              </div>
            </button>

            {/* Box 2: Chapter Wise Test */}
            <button
              type="button"
              onClick={() => setCurrentView("CHAPTERWISE_SUBJECTS")}
              className={`group relative flex min-h-[96px] flex-col justify-between rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer border hover:shadow-md hover:scale-[1.01] ${getBatchTheme(0).cardBg} ${getBatchTheme(0).cardBorder}`}
            >
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-110 bg-emerald-600 text-white ring-emerald-400">
                  <span className="material-symbols-outlined text-[22px]">menu_book</span>
                </span>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-600 text-white shadow-2xs">
                  {totalChapterwiseTests} Practice Tests
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <span className="text-[15px] font-extrabold leading-tight text-slate-900 block">
                    Chapter Wise Test
                  </span>
                  <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                    Physics, Chemistry &amp; Biology Chapters
                  </p>
                </div>
                <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs group-hover:translate-x-1 transition-transform shrink-0">
                  <span>Enter</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CHAPTERWISE SUBJECTS VIEW: 3 SUBJECT BOXES (PHYSICS, CHEM, BIO)        */}
      {/* ========================================================================= */}
      {currentView === "CHAPTERWISE_SUBJECTS" && (
        <div className="space-y-4">
          {/* Header with Back Button and Breadcrumb */}
          <div className="flex items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView("ROOT")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back</span>
              </button>
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <button
                    type="button"
                    onClick={() => setCurrentView("ROOT")}
                    className="hover:text-emerald-600 transition-colors"
                  >
                    Tests
                  </button>
                  <span>/</span>
                  <span className="text-slate-800 font-bold">Chapter Wise Test</span>
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                  <span className="material-symbols-outlined text-emerald-600 text-lg">menu_book</span>
                  <span>Select Subject</span>
                </h2>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
              {totalChapterwiseTests} Practice Tests across {subjectTests.length} Subjects
            </span>
          </div>

          {/* 3 Subject Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {subjectTests.map((subj) => {
              const totalTests = subj.chapters.reduce((sum, ch) => sum + ch.tests.length, 0);
              const completedTests = subj.chapters.reduce(
                (sum, ch) => sum + ch.tests.filter((t) => t.status === "COMPLETED").length,
                0
              );

              // Apply batch gradient themes per subject
              const subjTheme = subj.name.toLowerCase().includes("physics")
                ? getBatchTheme(2) // Sky / Cyan
                : subj.name.toLowerCase().includes("chem")
                ? getBatchTheme(3) // Amber / Sunset
                : getBatchTheme(0); // Emerald / Mint

              const iconBgClass = subj.name.toLowerCase().includes("physics")
                ? "bg-sky-600 text-white ring-sky-400"
                : subj.name.toLowerCase().includes("chem")
                ? "bg-amber-600 text-white ring-amber-400"
                : "bg-emerald-600 text-white ring-emerald-400";

              return (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => {
                    handleSubjectChange(subj.name);
                    setCurrentView("CHAPTERWISE_CHAPTERS");
                  }}
                  className={`group relative flex min-h-[96px] flex-col justify-between rounded-2xl p-3.5 text-left transition-all duration-200 cursor-pointer border hover:shadow-md hover:scale-[1.01] ${subjTheme.cardBg} ${subjTheme.cardBorder}`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-110 ${iconBgClass}`}
                    >
                      <span className="material-symbols-outlined text-[19px]">
                        {subj.icon || (subj.name.toLowerCase().includes("physics") ? "bolt" : subj.name.toLowerCase().includes("chem") ? "science" : "biotech")}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        completedTests > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {completedTests > 0 ? `${completedTests}/${totalTests} Done` : `${totalTests} Tests`}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-end justify-between">
                    <div>
                      <span className="text-[14px] font-extrabold leading-tight text-slate-900 block">
                        {subj.name}
                      </span>
                      <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                        {subj.name === "Chemistry"
                          ? "Physical · Inorganic · Organic"
                          : subj.name === "Biology"
                          ? "Botany · Zoology"
                          : `${subj.chapters.length} Chapters · ${totalTests} Tests`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-slate-700 font-bold text-xs group-hover:translate-x-1 transition-transform shrink-0">
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CHAPTERWISE CHAPTERS & TESTS VIEW                                      */}
      {/* ========================================================================= */}
      {currentView === "CHAPTERWISE_CHAPTERS" && (
        <div className="space-y-4">
          {/* Top Navigation Bar with Back button, breadcrumbs, and quick subject switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView("CHAPTERWISE_SUBJECTS")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Subjects</span>
              </button>
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <button
                    type="button"
                    onClick={() => setCurrentView("ROOT")}
                    className="hover:text-emerald-600 transition-colors"
                  >
                    Tests
                  </button>
                  <span>/</span>
                  <button
                    type="button"
                    onClick={() => setCurrentView("CHAPTERWISE_SUBJECTS")}
                    className="hover:text-emerald-600 transition-colors"
                  >
                    Chapter Wise
                  </button>
                  <span>/</span>
                  <span className="text-slate-900 font-bold">{activeSubjectData?.name}</span>
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                  <span className={`material-symbols-outlined text-lg ${activeSubjectData?.color || "text-emerald-600"}`}>
                    {activeSubjectData?.icon || "science"}
                  </span>
                  <span>{activeSubjectData?.name} Chapters &amp; Tests</span>
                </h2>
              </div>
            </div>

            {/* Quick Switcher Between Subjects */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              {subjectTests.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSubjectChange(s.name)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    selectedSubject === s.name
                      ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-branch Selector Pills (Only for Chemistry & Biology) */}
          {selectedSubject === "Chemistry" && (
            <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-2.5 shadow-2xs flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-amber-900 px-2 py-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-amber-600">tune</span>
                Branch:
              </span>
              {[
                { id: "ALL", label: "All Chemistry", icon: "science" },
                { id: "PHYSICAL", label: "Physical Chemistry", icon: "hourglass_bottom" },
                { id: "INORGANIC", label: "Inorganic Chemistry", icon: "hub" },
                { id: "ORGANIC", label: "Organic Chemistry", icon: "grain" },
              ].map((b) => {
                const isBranchActive = selectedBranch === b.id;
                const count =
                  b.id === "ALL"
                    ? activeSubjectData?.chapters.length || 0
                    : activeSubjectData?.chapters.filter((c) => c.branch === b.id).length || 0;

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBranch(b.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isBranchActive
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "bg-white hover:bg-amber-100/60 text-slate-700 border border-amber-200/80"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{b.icon}</span>
                    <span>{b.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isBranchActive ? "bg-white/25 text-white" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedSubject === "Biology" && (
            <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-2xl p-2.5 shadow-2xs flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-900 px-2 py-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">tune</span>
                Branch:
              </span>
              {[
                { id: "ALL", label: "All Biology", icon: "biotech" },
                { id: "BOTANY", label: "Botany", icon: "eco" },
                { id: "ZOOLOGY", label: "Zoology", icon: "pets" },
              ].map((b) => {
                const isBranchActive = selectedBranch === b.id;
                const count =
                  b.id === "ALL"
                    ? activeSubjectData?.chapters.length || 0
                    : activeSubjectData?.chapters.filter((c) => c.branch === b.id).length || 0;

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBranch(b.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isBranchActive
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-white hover:bg-emerald-100/60 text-slate-700 border border-emerald-200/80"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{b.icon}</span>
                    <span>{b.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isBranchActive ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
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
                  {activeSubjectData?.name || "Subject"}{" "}
                  {selectedBranch !== "ALL"
                    ? `· ${
                        selectedBranch === "PHYSICAL"
                          ? "Physical Chemistry"
                          : selectedBranch === "INORGANIC"
                          ? "Inorganic Chemistry"
                          : selectedBranch === "ORGANIC"
                          ? "Organic Chemistry"
                          : selectedBranch === "BOTANY"
                          ? "Botany"
                          : "Zoology"
                      }`
                    : ""}{" "}
                  — Chapterwise Practice Tests
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
                    : `No practice tests added in ${
                        selectedBranch !== "ALL" ? selectedBranch : activeSubjectData?.name || "this subject"
                      } yet`}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              Chapter {chapter.chapterNumber}: {chapter.title}
                            </h3>
                            {chapter.branchLabel && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  chapter.branch === "PHYSICAL"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : chapter.branch === "INORGANIC"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : chapter.branch === "ORGANIC"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : chapter.branch === "BOTANY"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-teal-50 text-teal-700 border-teal-200"
                                }`}
                              >
                                {chapter.branchLabel}
                              </span>
                            )}
                          </div>
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
                            {chapter.tests.map((test) => {
                              const isUpcoming =
                                test.status === "UPCOMING" ||
                                Boolean(test.startsAt && new Date(test.startsAt).getTime() > Date.now()) ||
                                Boolean(test.availableFrom && new Date(test.availableFrom).getTime() > Date.now());

                              return (
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
                                      ) : isUpcoming ? (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                          Upcoming
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
                                          <span className="material-symbols-outlined text-[16px] text-blue-600">picture_as_pdf</span>
                                          <span>Download PDF</span>
                                        </button>
                                      }
                                    />

                                    {test.status === "COMPLETED" ? (
                                      <Link
                                        href={`/tests/${test.id}/result`}
                                        className="px-3.5 py-1.5 rounded-lg font-bold text-xs transition shadow-2xs text-center bg-slate-100 hover:bg-slate-200 text-slate-800"
                                      >
                                        View Analysis
                                      </Link>
                                    ) : isUpcoming ? (
                                      <button
                                        type="button"
                                        disabled
                                        aria-disabled="true"
                                        className="px-3.5 py-1.5 rounded-lg font-bold text-xs bg-slate-100 text-slate-400 cursor-not-allowed text-center"
                                      >
                                        Upcoming
                                      </button>
                                    ) : (
                                      <Link
                                        href={`/tests/${test.id}/attempt`}
                                        className="px-3.5 py-1.5 rounded-lg font-bold text-xs transition shadow-2xs text-center bg-orange-500 hover:bg-orange-600 text-white active:scale-95"
                                      >
                                        {test.status === "IN_PROGRESS" ? "Resume" : "Start Test"}
                                      </Link>
                                    )}
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
      )}

      {/* ========================================================================= */}
      {/* 4. ENROLLED TEST SERIES & BATCH TEST SERIES BOXES                         */}
      {/* ========================================================================= */}
      {currentView === "TEST_SERIES" && (
        <div className="space-y-4">
          {/* Header with Back Button, Breadcrumb, and Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView("ROOT")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back</span>
              </button>
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <button
                    type="button"
                    onClick={() => setCurrentView("ROOT")}
                    className="hover:text-purple-600 transition-colors"
                  >
                    Tests
                  </button>
                  <span>/</span>
                  <span className="text-slate-800 font-bold">Test Series</span>
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                  <span className="material-symbols-outlined text-purple-600 text-lg">military_tech</span>
                  <span>Enrolled &amp; Batch Test Series</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Official test series assigned to your batches with direct PDF downloads and instant analytics.
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-64 shrink-0">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                value={seriesSearch}
                onChange={(e) => setSeriesSearch(e.target.value)}
                placeholder="Search test series or test..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {/* Test Series Boxes List */}
          {filteredSeriesBoxes.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center text-slate-500 space-y-1.5 border border-slate-200/80">
              <span className="material-symbols-outlined text-4xl text-blue-400">inventory_2</span>
              <h3 className="font-bold text-sm text-slate-800">No Test Series Boxes Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {seriesSearch
                  ? "No test series box matches your search query."
                  : "You are not enrolled in any test series yet, and no test series are scheduled in your batches."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSeriesBoxes.map((box, bIdx) => {
                const isExpanded = expandedSeries[box.id] !== false; // Default expanded
                const completedCount = box.tests.filter((t) => t.canViewResult || t.statusLabel.includes("Completed")).length;
                const theme = getBatchTheme(bIdx);

                return (
                  <div
                    key={box.id}
                    className={`bg-white border rounded-2xl overflow-hidden shadow-2xs transition-all ${theme.cardBorder}`}
                  >
                    {/* Test Series Box Header */}
                    <div className={`p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${theme.cardBg}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${theme.pillBg}`}>
                            Test Series
                          </span>
                          {box.examType && (
                            <span className="px-2 py-0.5 rounded-md bg-white/80 text-slate-700 border border-slate-200 text-[10px] font-bold">
                              {box.examType}
                            </span>
                          )}
                          {box.targetBatch && (
                            <span className={`text-xs font-bold ${theme.accentText}`}>
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
                                className="p-3 sm:px-4 sm:py-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-blue-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-2xs"
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
                                        <span className="material-symbols-outlined text-[16px] text-blue-600">picture_as_pdf</span>
                                        <span>Download PDF</span>
                                      </button>
                                    }
                                  />

                                  {t.canAttempt || t.canResume ? (
                                    <Link
                                      href={`/tests/${t.id}/attempt`}
                                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition text-center active:scale-95"
                                    >
                                      {t.canResume ? "Resume Test" : "Start Test"}
                                    </Link>
                                  ) : t.canViewResult ? (
                                    <Link
                                      href={`/tests/${t.id}/result`}
                                      className="px-3.5 py-1.5 rounded-lg border border-blue-500 text-blue-600 hover:bg-blue-50 font-bold text-xs transition text-center"
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
