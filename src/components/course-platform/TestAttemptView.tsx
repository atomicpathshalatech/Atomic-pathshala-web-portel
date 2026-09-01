"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface QuestionItem {
  id: number;
  statement: string;
  subtext?: string;
  image?: string;
  options: { key: string; text: string }[];
  section: string;
}

const SAMPLE_TEST_QUESTIONS: QuestionItem[] = [
  {
    id: 1,
    section: "Chemistry — Section A",
    statement: "Which of the following is a redox reaction?",
    subtext:
      "Consider the following reactions and identify the one where both oxidation and reduction are taking place simultaneously.",
    options: [
      { key: "A", text: "NaCl + AgNO3 → AgCl + NaNO3" },
      { key: "B", text: "H2 + Cl2 → 2HCl" },
      { key: "C", text: "CaCO3 → CaO + CO2" },
      { key: "D", text: "NaOH + HCl → NaCl + H2O" },
    ],
  },
  {
    id: 2,
    section: "Chemistry — Section A",
    statement: "The oxidation state of Chromium in Cr2O7^(2-) is:",
    subtext: "Calculate using standard oxidation rules where Oxygen has oxidation number -2.",
    options: [
      { key: "A", text: "+3" },
      { key: "B", text: "+5" },
      { key: "C", text: "+6" },
      { key: "D", text: "+7" },
    ],
  },
  {
    id: 3,
    section: "Chemistry — Section A",
    statement: "Which of the following molecules has zero dipole moment?",
    subtext: "Consider molecular geometry and vector symmetry of bond moments.",
    options: [
      { key: "A", text: "NH3" },
      { key: "B", text: "H2O" },
      { key: "C", text: "BF3" },
      { key: "D", text: "SO2" },
    ],
  },
  {
    id: 4,
    section: "Chemistry — Section A",
    statement: "The rate constant for a first order reaction is 6.93 × 10^(-3) s^(-1). Its half-life is:",
    options: [
      { key: "A", text: "100 s" },
      { key: "B", text: "50 s" },
      { key: "C", text: "10 s" },
      { key: "D", text: "0.1 s" },
    ],
  },
  {
    id: 5,
    section: "Chemistry — Section A",
    statement: "Which of the following elements has the highest electron gain enthalpy?",
    options: [
      { key: "A", text: "Fluorine (F)" },
      { key: "B", text: "Chlorine (Cl)" },
      { key: "C", text: "Bromine (Br)" },
      { key: "D", text: "Iodine (I)" },
    ],
  },
];

export function TestAttemptView() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true });
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(9910); // 02:45:10
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (secondsRemaining <= 0 || isSubmitted) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining, isSubmitted]);

  const formatTimer = (sec: number) => {
    const hrs = String(Math.floor(sec / 3600)).padStart(2, "0");
    const mins = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${hrs}:${mins}:${s}`;
  };

  const currentQ = SAMPLE_TEST_QUESTIONS[currentIdx] ?? SAMPLE_TEST_QUESTIONS[0]!;

  const handleSelectOption = (key: string) => {
    setAnswers((prev) => ({ ...prev, [currentIdx]: key }));
  };

  const handleClearResponse = () => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentIdx];
      return next;
    });
  };

  const handleToggleMark = () => {
    setMarked((prev) => ({ ...prev, [currentIdx]: !prev[currentIdx] }));
  };

  const goToQuestion = (idx: number) => {
    setVisited((prev) => ({ ...prev, [idx]: true }));
    setCurrentIdx(idx);
    setShowMobilePalette(false);
  };

  const handleNext = () => {
    if (currentIdx < SAMPLE_TEST_QUESTIONS.length - 1) {
      goToQuestion(currentIdx + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIdx > 0) {
      goToQuestion(currentIdx - 1);
    }
  };

  const getQuestionStatus = (idx: number) => {
    const isAns = answers[idx] !== undefined;
    const isMk = marked[idx];
    const isVis = visited[idx];

    if (isMk && isAns) return "MARKED_ANSWERED";
    if (isMk) return "MARKED";
    if (isAns) return "ANSWERED";
    if (isVis) return "NOT_ANSWERED";
    return "NOT_VISITED";
  };

  const getPaletteBtnClass = (idx: number) => {
    const status = getQuestionStatus(idx);
    const isCurrent = currentIdx === idx;

    let base = "w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition ";
    if (isCurrent) base += "ring-2 ring-purple-600 ring-offset-2 ";

    switch (status) {
      case "ANSWERED":
        return base + "bg-emerald-600 text-white";
      case "MARKED":
      case "MARKED_ANSWERED":
        return base + "bg-purple-600 text-white";
      case "NOT_ANSWERED":
        return base + "bg-rose-500 text-white";
      default:
        return base + "bg-slate-100 text-slate-700 hover:bg-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#121c2c] flex flex-col font-sans">
      {/* 1. Top Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/courses"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition"
            title="Exit Test"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-[#031635]">
              NEET Mock Test #01
            </h1>
            <p className="text-[11px] text-slate-500">{currentQ.section}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer Display */}
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#f0f3ff] border border-slate-200 text-[#031635]">
            <span className="material-symbols-outlined text-base text-purple-600 animate-pulse">
              timer
            </span>
            <span className="font-mono font-extrabold text-xs sm:text-sm">
              {formatTimer(secondsRemaining)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsSubmitted(true)}
            className="px-4 py-2 rounded-xl bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold text-xs shadow-md transition"
          >
            Submit Test
          </button>
        </div>
      </header>

      {/* 2. Main Test Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Question Area (8 cols) */}
        <section className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 space-y-6 shadow-sm">
          {/* Question Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-black text-base sm:text-lg text-[#031635]">
              Question {currentIdx + 1} of {SAMPLE_TEST_QUESTIONS.length}
            </h2>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                +4 Marks
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                -1 Mark
              </span>
            </div>
          </div>

          {/* Question Statement */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <p className="text-sm sm:text-base font-bold text-[#031635] leading-relaxed">
              {currentQ.statement}
            </p>
            {currentQ.subtext && (
              <p className="text-xs text-slate-500 leading-relaxed">{currentQ.subtext}</p>
            )}
          </div>

          {/* Options List */}
          <div className="space-y-3">
            {currentQ.options.map((opt) => {
              const isSelected = answers[currentIdx] === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectOption(opt.key)}
                  className={`w-full p-4 rounded-2xl border text-left transition flex items-center gap-3.5 ${
                    isSelected
                      ? "bg-purple-50/70 border-purple-600 shadow-sm"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isSelected
                        ? "bg-[#6b46c1] text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {opt.key}
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-[#031635]">
                    {opt.text}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Footer for Question */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMark}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 border ${
                  marked[currentIdx]
                    ? "bg-purple-100 border-purple-400 text-purple-800"
                    : "border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="material-symbols-outlined text-sm">bookmark</span>
                <span>{marked[currentIdx] ? "Marked for Review" : "Mark for Review"}</span>
              </button>

              <button
                type="button"
                onClick={handleClearResponse}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
              >
                Clear Response
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentIdx === 0}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold disabled:opacity-40 transition"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 rounded-xl bg-[#031635] hover:bg-[#1a2b4b] text-white font-bold text-xs shadow transition flex items-center gap-1"
              >
                <span>Save & Next</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right: Question Palette (4 cols desktop, hidden on mobile unless toggled) */}
        <aside className="hidden lg:block lg:col-span-4 bg-white rounded-3xl border border-slate-200/80 p-5 space-y-5 shadow-sm">
          <div>
            <h3 className="font-extrabold text-sm text-[#031635] mb-2">Question Palette</h3>
            {/* Status Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600 block" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 block" />
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-600 block" />
                <span>Marked</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-200 block" />
                <span>Not Visited</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Section A: Chemistry
            </span>
            <div className="grid grid-cols-5 gap-2">
              {SAMPLE_TEST_QUESTIONS.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => goToQuestion(idx)}
                  className={getPaletteBtnClass(idx)}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Mobile Floating Palette Button */}
      <button
        type="button"
        onClick={() => setShowMobilePalette(true)}
        className="lg:hidden fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#6b46c1] text-white shadow-xl flex items-center justify-center z-50"
        title="Open Question Palette"
      >
        <span className="material-symbols-outlined">apps</span>
      </button>

      {/* Mobile Palette Drawer */}
      {showMobilePalette && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm lg:hidden">
          <div className="bg-white rounded-t-3xl max-w-lg w-full p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#031635]">Question Palette</h3>
              <button
                type="button"
                onClick={() => setShowMobilePalette(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {SAMPLE_TEST_QUESTIONS.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => goToQuestion(idx)}
                  className={getPaletteBtnClass(idx)}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Submission Success Modal */}
      {isSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="text-lg font-bold text-[#031635]">Test Submitted Successfully!</h3>
            <p className="text-xs text-slate-500">
              Your responses have been recorded and evaluated against All-India benchmarks.
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 text-left text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Questions Answered:</span>
                <span className="font-bold text-[#031635]">{Object.keys(answers).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Marked for Review:</span>
                <span className="font-bold text-purple-600">{Object.keys(marked).length}</span>
              </div>
            </div>
            <Link
              href="/courses"
              className="w-full py-3 rounded-2xl bg-[#031635] text-white font-bold text-xs block transition shadow"
            >
              Return to Course Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}