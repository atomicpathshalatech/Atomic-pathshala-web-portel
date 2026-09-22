"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Laptop,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  BookOpen,
  HelpCircle,
  Clock,
  Layers,
  Award,
  Globe,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";

export interface ReviewQuestion {
  id: string;
  order: number;
  subject: string;
  bodyEn: string;
  bodyHi?: string | null;
  optionsEn: Record<string, string>;
  optionsHi?: Record<string, string>;
  correctOptionKeys: string[];
  solutionEn?: string | null;
  solutionHi?: string | null;
  marks: number;
  negativeMarks: number;
}

export interface TestReviewProps {
  test: {
    id: string;
    name: string;
    code?: string | null;
    durationMin: number;
    testSeriesId?: string | null;
    testSeriesName?: string | null;
    examType?: string | null;
    questions: ReviewQuestion[];
  };
}

export function TestReviewClient({ test }: TestReviewProps) {
  const [viewMode, setViewMode] = useState<"laptop" | "mobile">("laptop");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(true);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  const questions = test.questions;

  // Group subjects and counts
  const subjects = useMemo(() => {
    const map = new Map<string, { subject: string; count: number; firstIndex: number }>();
    questions.forEach((q, idx) => {
      const s = q.subject || "General";
      if (!map.has(s)) {
        map.set(s, { subject: s, count: 1, firstIndex: idx });
      } else {
        map.get(s)!.count++;
      }
    });
    return Array.from(map.values());
  }, [questions]);

  const totalMarks = questions.reduce((acc, q) => acc + (q.marks || 4), 0);

  if (questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <HelpCircle className="w-12 h-12 text-slate-400 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">No Questions in this Test</h2>
        <p className="text-sm text-slate-500">Please add questions using the Author Studio first.</p>
        <Link
          href={`/team/tests/${test.id}/author`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700"
        >
          Open Dual-Column Author Studio
        </Link>
      </div>
    );
  }

  const currentQ = questions[currentIndex] || questions[0]!;
  const activeSubject = currentQ.subject || "General";

  // Active language statement and options
  const statement =
    language === "hi" && currentQ.bodyHi ? currentQ.bodyHi : currentQ.bodyEn;
  const options =
    language === "hi" && currentQ.optionsHi && Object.keys(currentQ.optionsHi).length > 0
      ? currentQ.optionsHi
      : currentQ.optionsEn;
  const solution =
    language === "hi" && currentQ.solutionHi ? currentQ.solutionHi : currentQ.solutionEn;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Top Header with Back, Title, Mode Switcher & Language Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <Link
            href={test.testSeriesId ? `/team/test-series/${test.testSeriesId}` : `/team/tests/${test.id}`}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition shrink-0"
            title="Back to Test Series"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-[10px] tracking-wider uppercase">
                Review &amp; Preview
              </span>
              {test.code && (
                <span className="text-[11px] font-mono text-slate-400">
                  [{test.code}]
                </span>
              )}
            </div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
              {test.name}
            </h1>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
              <span>{questions.length} Questions</span>
              <span>&middot;</span>
              <span>{test.durationMin} Mins</span>
              <span>&middot;</span>
              <span>{totalMarks} Marks</span>
            </div>
          </div>
        </div>

        {/* Right: Controls (Laptop Mode vs Mobile Mode, Language Switcher) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Switcher: Laptop vs Mobile */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode("laptop")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "laptop"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Laptop Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("mobile")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === "mobile"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Mode</span>
            </button>
          </div>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "hi" : "en")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition shadow-2xs"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === "hi" ? "हिंदी (Active)" : "English (Active)"}</span>
          </button>

          {/* Solution Toggle */}
          <button
            type="button"
            onClick={() => setShowSolution(!showSolution)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              showSolution
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{showSolution ? "Solutions ON" : "Solutions OFF"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODE 1: LAPTOP / DESKTOP CBT VIEW                         */}
      {/* ========================================================= */}
      {viewMode === "laptop" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Question Card & Controls (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Subject Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {subjects.map((sub) => {
                const isActive = activeSubject === sub.subject;
                return (
                  <button
                    key={sub.subject}
                    type="button"
                    onClick={() => setCurrentIndex(sub.firstIndex)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap flex items-center gap-2 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-300"
                    }`}
                  >
                    <span>{sub.subject}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-blue-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                      {sub.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Question Details Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              {/* Question Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                    {currentIndex + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                    {currentQ.subject}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    +{currentQ.marks || 4} Marks
                  </span>
                  <span className="text-red-500 bg-red-50 dark:bg-red-950/60 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800">
                    {currentQ.negativeMarks ?? -1} Marks
                  </span>
                </div>
              </div>

              {/* Question Statement */}
              <div className="text-sm sm:text-base text-slate-900 dark:text-white leading-relaxed font-medium">
                <FormulaText text={statement} />
              </div>

              {/* Options Grid */}
              <div className="space-y-3 pt-2">
                {Object.entries(options).map(([key, optText]) => {
                  const isCorrect = currentQ.correctOptionKeys.includes(key);
                  return (
                    <div
                      key={key}
                      className={`p-4 rounded-2xl border transition flex items-start gap-3.5 ${
                        isCorrect
                          ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20"
                          : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          isCorrect
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {key}
                      </span>

                      <div className="flex-1 text-sm text-slate-800 dark:text-slate-100 pt-0.5 leading-relaxed">
                        <FormulaText text={optText || ""} />
                      </div>

                      {isCorrect && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Correct Answer</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Solution / Explanation Box */}
              {showSolution && solution && (
                <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-amber-50/70 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/80 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Detailed Solution &amp; Explanation ({language === "hi" ? "हिंदी" : "English"})</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    <FormulaText text={solution} />
                  </div>
                </div>
              )}

              {/* Bottom Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="text-xs text-slate-400 font-bold">
                  {currentIndex + 1} / {questions.length}
                </div>

                <button
                  type="button"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Question Palette Grid & Metadata (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Question Palette</span>
                </h3>
                <span className="text-xs text-slate-400 font-bold">
                  {questions.length} Items
                </span>
              </div>

              {/* Subject breakdown in Palette */}
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {subjects.map((sub) => {
                  const subQuestions = questions
                    .map((q, idx) => ({ q, idx }))
                    .filter(({ q }) => (q.subject || "General") === sub.subject);

                  return (
                    <div key={sub.subject} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 first:border-t-0 first:pt-0">
                        <span>{sub.subject}</span>
                        <span>{sub.count} Qs</span>
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        {subQuestions.map(({ idx }) => {
                          const isCurrent = idx === currentIndex;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setCurrentIndex(idx)}
                              className={`h-9 rounded-xl font-bold text-xs transition flex items-center justify-center ${
                                isCurrent
                                  ? "bg-blue-600 text-white ring-2 ring-blue-500/40 shadow-sm"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              }`}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 2: REALISTIC MOBILE PHONE CBT FRAME                  */}
      {/* ========================================================= */}
      {viewMode === "mobile" && (
        <div className="flex justify-center py-4">
          <div className="relative w-full max-w-[400px] min-h-[780px] bg-white dark:bg-slate-950 rounded-[48px] border-[10px] border-slate-900 shadow-2xl overflow-hidden flex flex-col justify-between select-none">
            {/* Phone Speaker Grille & Notch */}
            <div className="w-full bg-slate-900 pt-2 pb-1.5 flex items-center justify-center">
              <div className="w-24 h-4 bg-black rounded-full flex items-center justify-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                <div className="w-10 h-1 bg-slate-800 rounded-full" />
              </div>
            </div>

            {/* Mobile Header (Candidate & Timer) */}
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <div>
                <span className="font-bold text-slate-800 dark:text-white block truncate max-w-[150px]">
                  {test.name}
                </span>
                <span className="text-[10px] text-slate-400">
                  Q{currentIndex + 1}/{questions.length} · {currentQ.subject}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold">
                  {test.durationMin}:00
                </span>
                <button
                  type="button"
                  onClick={() => setMobilePaletteOpen(!mobilePaletteOpen)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                  title="Toggle Mobile Palette"
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Mobile Subject Scrolling Pills */}
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {subjects.map((sub) => {
                const isActive = activeSubject === sub.subject;
                return (
                  <button
                    key={sub.subject}
                    type="button"
                    onClick={() => setCurrentIndex(sub.firstIndex)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black transition whitespace-nowrap shrink-0 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {sub.subject} ({sub.count})
                  </button>
                );
              })}
            </div>

            {/* Mobile Question Content Area */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Question Statement */}
              <div className="text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed font-medium">
                <FormulaText text={statement} />
              </div>

              {/* Mobile Options */}
              <div className="space-y-2.5">
                {Object.entries(options).map(([key, optText]) => {
                  const isCorrect = currentQ.correctOptionKeys.includes(key);
                  return (
                    <div
                      key={key}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        isCorrect
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 font-semibold"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isCorrect
                            ? "bg-emerald-600 text-white"
                            : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {key}
                      </span>
                      <div className="flex-1 leading-relaxed">
                        <FormulaText text={optText || ""} />
                      </div>
                      {isCorrect && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 self-center" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mobile Solution */}
              {showSolution && solution && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] leading-relaxed space-y-1">
                  <span className="font-bold text-amber-900 dark:text-amber-200 block">
                    Solution:
                  </span>
                  <FormulaText text={solution} />
                </div>
              )}
            </div>

            {/* Mobile Drawer Popover for Palette */}
            {mobilePaletteOpen && (
              <div className="absolute inset-x-0 bottom-14 top-14 bg-white dark:bg-slate-900 z-50 p-4 overflow-y-auto space-y-3 animate-in fade-in slide-in-from-bottom-5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                    Jump to Question
                  </h4>
                  <button
                    type="button"
                    onClick={() => setMobilePaletteOpen(false)}
                    className="text-xs font-bold text-blue-600"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setMobilePaletteOpen(false);
                      }}
                      className={`h-8 rounded-lg font-bold text-xs flex items-center justify-center ${
                        idx === currentIndex
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mobile Bottom Navigation Bar */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-[11px] font-bold text-slate-400">
                {currentIndex + 1} / {questions.length}
              </span>

              <button
                type="button"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
