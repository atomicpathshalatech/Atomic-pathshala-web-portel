"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Download, ChevronRight, ChevronDown, ArrowLeft, Save, Sliders, CheckCircle2, FileText, Search, Sparkles } from "lucide-react";

export interface QuestionEntry {
  id?: string;
  questionCode?: string;
  questionNumber: number;
  subject: string;
  chapter?: string;
  topic?: string;
  subTopic?: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  type: "SINGLE_CORRECT" | "MULTIPLE_CORRECT" | "NUMERICAL" | "ASSERTION_REASON" | "MATCH_COLUMN";
  marks: number;
  negativeMarks: number;
  statementHi: string;
  statementEn: string;
  optionAHi: string;
  optionAEn: string;
  optionBHi: string;
  optionBEn: string;
  optionCHi: string;
  optionCEn: string;
  optionDHi: string;
  optionDEn: string;
  correctOption: string; // 'A' | 'B' | 'C' | 'D'
  solutionHi: string;
  solutionEn: string;
  imageUrl?: string;
  isSaved?: boolean;
}

interface DualColumnQuestionStudioProps {
  mode?: "test" | "dpp";
  title?: string;
  testId?: string;
  dppId?: string;
  totalQuestionsCount?: number;
  subjects?: { name: string; count: number; total: number }[];
  initialQuestions?: QuestionEntry[];
  backHref?: string;
  onSave?: (question: QuestionEntry) => Promise<void>;
}

export function DualColumnQuestionStudio({
  mode = "test",
  title = "Minor Test 30",
  testId,
  dppId,
  totalQuestionsCount = 180,
  subjects = [
    { name: "Biology", count: 0, total: 90 },
    { name: "Chemistry", count: 0, total: 45 },
    { name: "Physics", count: 0, total: 45 },
  ],
  initialQuestions,
  backHref = "/team/tests",
}: DualColumnQuestionStudioProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSubject, setActiveSubject] = useState(subjects[0]?.name || "Biology");
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
  const [jumpInput, setJumpInput] = useState("1");
  const [viewMode, setViewMode] = useState<"side-by-side" | "hindi" | "english">("side-by-side");

  // State: whether editor form is active for the current question
  const [activeAuthoringSlots, setActiveAuthoringSlots] = useState<Record<number, boolean>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importQuery, setImportQuery] = useState("");

  // Questions cache for the test
  const [questionsMap, setQuestionsMap] = useState<Record<number, QuestionEntry>>(() => {
    const map: Record<number, QuestionEntry> = {};
    if (initialQuestions && initialQuestions.length > 0) {
      initialQuestions.forEach((q) => {
        map[q.questionNumber] = q;
      });
    }
    return map;
  });

  const currentQ: QuestionEntry = questionsMap[currentQuestionNumber] || {
    questionNumber: currentQuestionNumber,
    subject: activeSubject,
    chapter: "",
    topic: "",
    subTopic: "",
    difficulty: "MEDIUM",
    type: "SINGLE_CORRECT",
    marks: 4,
    negativeMarks: 1,
    statementHi: "",
    statementEn: "",
    optionAHi: "",
    optionAEn: "",
    optionBHi: "",
    optionBEn: "",
    optionCHi: "",
    optionCEn: "",
    optionDHi: "",
    optionDEn: "",
    correctOption: "A",
    solutionHi: "",
    solutionEn: "",
    isSaved: false,
  };

  const isQuestionPopulated = Boolean(
    currentQ.isSaved ||
    currentQ.statementEn ||
    currentQ.statementHi ||
    activeAuthoringSlots[currentQuestionNumber]
  );

  const savedQuestionsCount = Object.values(questionsMap).filter((q) => q.isSaved).length;

  // Active Subject details
  const activeSubjectObj = subjects.find((s) => s.name === activeSubject) || subjects[0];
  const activeSubjectTotal = activeSubjectObj?.total || 45;
  const activeSubjectSaved = Object.values(questionsMap).filter(
    (q) => q.subject === activeSubject && q.isSaved
  ).length;

  const updateCurrentDraft = (fields: Partial<QuestionEntry>) => {
    setQuestionsMap((prev) => ({
      ...prev,
      [currentQuestionNumber]: {
        ...currentQ,
        ...fields,
        questionNumber: currentQuestionNumber,
        subject: activeSubject,
      },
    }));
  };

  const handleSaveQuestion = () => {
    if (!currentQ.statementEn && !currentQ.statementHi) {
      toast.error("Please enter a question statement before saving.");
      return;
    }
    setQuestionsMap((prev) => ({
      ...prev,
      [currentQuestionNumber]: {
        ...currentQ,
        isSaved: true,
      },
    }));
    toast.success(`Question ${currentQuestionNumber} saved successfully!`);
  };

  const handleNextQuestion = () => {
    if (currentQuestionNumber < totalQuestionsCount) {
      const next = currentQuestionNumber + 1;
      setCurrentQuestionNumber(next);
      setJumpInput(String(next));
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionNumber > 1) {
      const prev = currentQuestionNumber - 1;
      setCurrentQuestionNumber(prev);
      setJumpInput(String(prev));
    }
  };

  const handleJumpToGo = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (num >= 1 && num <= totalQuestionsCount) {
      setCurrentQuestionNumber(num);
    }
  };

  // Import mock question by ID
  const handleImportQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importQuery.trim()) return;

    setQuestionsMap((prev) => ({
      ...prev,
      [currentQuestionNumber]: {
        questionNumber: currentQuestionNumber,
        questionCode: importQuery.trim().toUpperCase(),
        subject: activeSubject,
        chapter: "Chemical Bonding and Molecular Structure",
        topic: "Hybridization & VSEPR",
        subTopic: "Dipole Moment",
        difficulty: "MEDIUM",
        type: "SINGLE_CORRECT",
        marks: 4,
        negativeMarks: 1,
        statementHi: "निम्नलिखित में से किस अणु का द्विध्रुव आघूर्ण (Dipole moment) शून्य है?",
        statementEn: "Which of the following molecules has zero dipole moment?",
        optionAHi: "BF3",
        optionAEn: "BF3",
        optionBHi: "NH3",
        optionBEn: "NH3",
        optionCHi: "NF3",
        optionCEn: "NF3",
        optionDHi: "H2O",
        optionDEn: "H2O",
        correctOption: "A",
        solutionHi: "BF3 अणु की ज्यामिति समतलीय त्रिकोणीय (Trigonal Planar) होती है, जिसके कारण तीनों B-F आबंध आघूर्ण एक दूसरे को निरस्त कर देते हैं। अतः इसका परिणामी द्विध्रुव आघूर्ण शून्य होता है।",
        solutionEn: "BF3 has a symmetrical trigonal planar geometry with 120° bond angles. The three B-F bond dipole vectors cancel each other out completely, giving a net dipole moment of zero.",
        isSaved: true,
      },
    }));

    setActiveAuthoringSlots((prev) => ({ ...prev, [currentQuestionNumber]: true }));
    setShowImportModal(false);
    setImportQuery("");
    toast.success(`Question imported into slot #${currentQuestionNumber}!`);
  };

  // Fast translation trigger
  const handleSingleClickTranslate = () => {
    if (currentQ.statementHi && !currentQ.statementEn) {
      updateCurrentDraft({
        statementEn: `[Auto-Translated] ${currentQ.statementHi}`,
        optionAEn: currentQ.optionAHi ? `[Auto] ${currentQ.optionAHi}` : "",
        optionBEn: currentQ.optionBHi ? `[Auto] ${currentQ.optionBHi}` : "",
        optionCEn: currentQ.optionCHi ? `[Auto] ${currentQ.optionCHi}` : "",
        optionDEn: currentQ.optionDHi ? `[Auto] ${currentQ.optionDHi}` : "",
        solutionEn: currentQ.solutionHi ? `[Auto] ${currentQ.solutionHi}` : "",
      });
      toast.success("Hindi text auto-translated to English!");
    } else if (currentQ.statementEn && !currentQ.statementHi) {
      updateCurrentDraft({
        statementHi: `[अनुवादित] ${currentQ.statementEn}`,
        optionAHi: currentQ.optionAEn ? `[अनुवादित] ${currentQ.optionAEn}` : "",
        optionBHi: currentQ.optionBEn ? `[अनुवादित] ${currentQ.optionBEn}` : "",
        optionCHHi: currentQ.optionCEn ? `[अनुवादित] ${currentQ.optionCEn}` : "",
        optionDHi: currentQ.optionDEn ? `[अनुवादित] ${currentQ.optionDEn}` : "",
        solutionHi: currentQ.solutionEn ? `[अनुवादित] ${currentQ.solutionEn}` : "",
      });
      toast.success("English text auto-translated to Hindi!");
    } else {
      toast.info("Both Hindi and English statements are already present.");
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#f1f4fb] text-slate-900 overflow-hidden font-sans select-none">
      {/* 1. LEFT DEEP-BLUE SIDEBAR (Matching Image 6) */}
      <aside
        className={`bg-[#0c3ea4] text-white flex flex-col justify-between shrink-0 transition-all duration-300 z-30 relative shadow-2xl ${
          sidebarCollapsed ? "w-14" : "w-64"
        }`}
      >
        <div className="p-4 border-b border-white/10">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-200 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            {!sidebarCollapsed && <span>Back</span>}
          </Link>

          {!sidebarCollapsed && (
            <div className="mt-3">
              <h2 className="font-black text-base text-white tracking-tight">{title}</h2>
              <p className="text-xs text-blue-200 font-medium mt-0.5">
                {savedQuestionsCount} / {totalQuestionsCount} Questions
              </p>
            </div>
          )}
        </div>

        {/* Section Accordions & Question Grid */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {subjects.map((sub) => {
            const isSubActive = activeSubject === sub.name;
            const subSaved = Object.values(questionsMap).filter(
              (q) => q.subject === sub.name && q.isSaved
            ).length;

            return (
              <div key={sub.name} className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveSubject(sub.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition ${
                    isSubActive
                      ? "bg-white/15 text-white shadow-inner"
                      : "text-blue-100 hover:bg-white/10"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {isSubActive ? (
                      <ChevronDown className="w-4 h-4 text-blue-200" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-blue-200" />
                    )}
                    {!sidebarCollapsed && <span>{sub.name}</span>}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="text-[11px] font-mono text-blue-200">
                      {subSaved}/{sub.total}
                    </span>
                  )}
                </button>

                {isSubActive && !sidebarCollapsed && (
                  <div className="bg-black/15 p-2.5 rounded-2xl border border-white/10 space-y-2">
                    <div className="grid grid-cols-6 gap-1.5 max-h-56 overflow-y-auto pr-1">
                      {Array.from({ length: sub.total || 45 }).map((_, idx) => {
                        const qNum = idx + 1;
                        const isCurrent = currentQuestionNumber === qNum;
                        const isSaved = questionsMap[qNum]?.isSaved;

                        return (
                          <button
                            key={qNum}
                            type="button"
                            onClick={() => {
                              setCurrentQuestionNumber(qNum);
                              setJumpInput(String(qNum));
                            }}
                            className={`h-8 rounded-lg font-bold text-xs flex items-center justify-center transition ${
                              isCurrent
                                ? "bg-amber-400 text-slate-900 ring-2 ring-white font-black scale-105 shadow-md"
                                : isSaved
                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                : "bg-white text-rose-600 hover:bg-rose-50 shadow-sm border border-slate-200"
                            }`}
                          >
                            {qNum}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-center text-blue-200/80 italic pt-1">
                      Scroll for more...
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Toggle */}
        <div className="p-3 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-200">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Saved</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white border border-rose-400" />
                <span>Empty</span>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded-lg hover:bg-white/10 text-white"
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>
      </aside>

      {/* 2. RIGHT MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Ribbon (Matching Image 6) */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <h3 className="font-extrabold text-base text-slate-900">{activeSubject}</h3>

            <span className="px-3 py-1 rounded-full bg-blue-50 text-[#0c3ea4] font-extrabold text-xs font-mono">
              Q.{currentQuestionNumber} / {activeSubjectTotal}
            </span>

            <form onSubmit={handleJumpToGo} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Go to</span>
              <input
                type="text"
                placeholder="#"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                className="w-12 px-2 py-0.5 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-xs text-slate-900"
              />
            </form>

            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold tracking-wider">
              DRAFT
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Section Progress Bar */}
            <div className="hidden md:flex flex-col items-end gap-1">
              <span className="text-[11px] font-bold text-slate-500">
                Section Progress {activeSubjectSaved}/{activeSubjectTotal}
              </span>
              <div className="w-36 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${(activeSubjectSaved / (activeSubjectTotal || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Language Selector */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <button
                type="button"
                onClick={() => setViewMode("side-by-side")}
                className={`px-3 py-1 rounded-lg transition ${
                  viewMode === "side-by-side" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                हिंदी + English — side by side
              </button>
            </div>

            <button
              type="button"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Test Configuration"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* WORKSPACE BODY */}
        {!isQuestionPopulated ? (
          /* EMPTY STATE (Matching Image 6 with Two Centered Action Cards) */
          <div className="flex-1 flex items-center justify-center p-8 bg-[#f1f4fb] animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 max-w-2xl w-full">
              {/* Card 1: Add New Question */}
              <button
                type="button"
                onClick={() => setActiveAuthoringSlots((prev) => ({ ...prev, [currentQuestionNumber]: true }))}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-3xl p-8 text-center shadow-lg hover:shadow-xl transition-all group flex flex-col items-center justify-center h-60 w-full"
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 group-hover:scale-110 transition flex items-center justify-center mb-3">
                  <Plus className="w-8 h-8 stroke-[2.5]" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">Add New Question</h3>
                <p className="text-xs text-slate-500 mt-1">Opens the full Question Builder</p>
              </button>

              {/* Card 2: Import Question */}
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-3xl p-8 text-center shadow-lg hover:shadow-xl transition-all group flex flex-col items-center justify-center h-60 w-full"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 group-hover:scale-110 transition flex items-center justify-center mb-3">
                  <Download className="w-7 h-7" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">Import Question</h3>
                <p className="text-xs text-slate-500 mt-1">Enter a Question ID from the Question Bank</p>
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE DUAL-COLUMN QUESTION BUILDER */
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in">
            {/* Quick Actions & AI Auto-Translate Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-bold">Fast-Fill:</span>
                <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 font-medium border border-blue-200">
                  Paste screenshot (Ctrl+V) anywhere on canvas to OCR
                </span>
              </div>

              <button
                type="button"
                onClick={handleSingleClickTranslate}
                className="px-3.5 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-extrabold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Single-Click Auto-Translate (Hindi ↔ English)</span>
              </button>
            </div>

            {/* DUAL COLUMN INPUTS */}
            <main className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* HINDI COLUMN */}
                <div className="space-y-4">
                  <span className="text-xs font-black text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    हिंदी (Hindi Statement &amp; Options)
                  </span>

                  <div className="bg-white border border-slate-300 rounded-2xl p-3.5 shadow-sm focus-within:border-blue-600 transition">
                    <textarea
                      rows={3}
                      placeholder="हिंदी में प्रश्न कथन लिखें..."
                      value={currentQ.statementHi}
                      onChange={(e) => updateCurrentDraft({ statementHi: e.target.value })}
                      className="w-full text-xs sm:text-sm text-slate-900 outline-none resize-none font-sans leading-relaxed"
                    />
                  </div>

                  {/* Hindi Options */}
                  <div className="space-y-2">
                    {(["A", "B", "C", "D"] as const).map((optKey) => {
                      const fieldKey = `option${optKey}Hi` as keyof QuestionEntry;
                      const isCorrect = currentQ.correctOption === optKey;

                      return (
                        <div
                          key={optKey}
                          className={`p-2.5 rounded-2xl border transition ${
                            isCorrect ? "bg-emerald-50 border-emerald-500" : "bg-white border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateCurrentDraft({ correctOption: optKey })}
                              className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition ${
                                isCorrect ? "bg-emerald-600 text-white shadow" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {optKey}
                            </button>
                            <input
                              type="text"
                              placeholder={`विकल्प (${optKey}) हिंदी पाठ...`}
                              value={(currentQ[fieldKey] as string) || ""}
                              onChange={(e) => updateCurrentDraft({ [fieldKey]: e.target.value })}
                              className="flex-1 text-xs sm:text-sm text-slate-900 outline-none bg-transparent"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Hindi Solution */}
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-bold text-amber-800">Detailed Solution (हिंदी)</label>
                    <textarea
                      rows={4}
                      placeholder="हिंदी व्याख्या / हल यहाँ लिखें..."
                      value={currentQ.solutionHi}
                      onChange={(e) => updateCurrentDraft({ solutionHi: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-2xl p-3 text-xs text-slate-900 outline-none resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* ENGLISH COLUMN */}
                <div className="space-y-4">
                  <span className="text-xs font-black text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                    English (English Statement &amp; Options)
                  </span>

                  <div className="bg-white border border-slate-300 rounded-2xl p-3.5 shadow-sm focus-within:border-blue-600 transition">
                    <textarea
                      rows={3}
                      placeholder="Write question statement in English..."
                      value={currentQ.statementEn}
                      onChange={(e) => updateCurrentDraft({ statementEn: e.target.value })}
                      className="w-full text-xs sm:text-sm text-slate-900 outline-none resize-none font-sans leading-relaxed"
                    />
                  </div>

                  {/* English Options */}
                  <div className="space-y-2">
                    {(["A", "B", "C", "D"] as const).map((optKey) => {
                      const fieldKey = `option${optKey}En` as keyof QuestionEntry;
                      const isCorrect = currentQ.correctOption === optKey;

                      return (
                        <div
                          key={optKey}
                          className={`p-2.5 rounded-2xl border transition ${
                            isCorrect ? "bg-emerald-50 border-emerald-500" : "bg-white border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateCurrentDraft({ correctOption: optKey })}
                              className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center transition ${
                                isCorrect ? "bg-emerald-600 text-white shadow" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {optKey}
                            </button>
                            <input
                              type="text"
                              placeholder={`Option (${optKey}) English text...`}
                              value={(currentQ[fieldKey] as string) || ""}
                              onChange={(e) => updateCurrentDraft({ [fieldKey]: e.target.value })}
                              className="flex-1 text-xs sm:text-sm text-slate-900 outline-none bg-transparent"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* English Solution */}
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-bold text-blue-800">Detailed Solution (English)</label>
                    <textarea
                      rows={4}
                      placeholder="Write complete English solution and approach here..."
                      value={currentQ.solutionEn}
                      onChange={(e) => updateCurrentDraft({ solutionEn: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-2xl p-3 text-xs text-slate-900 outline-none resize-none leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            </main>

            {/* STICKY BOTTOM NAVIGATION BAR */}
            <footer className="bg-white border-t border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between shadow-lg">
              <button
                type="button"
                onClick={handlePrevQuestion}
                disabled={currentQuestionNumber === 1}
                className="px-5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs disabled:opacity-40 transition"
              >
                ← Prev
              </button>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span>Slot #{currentQuestionNumber} of {totalQuestionsCount}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveQuestion}
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Question</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={currentQuestionNumber === totalQuestionsCount}
                  className="px-5 py-2 rounded-xl bg-[#0c3ea4] hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1 disabled:opacity-40"
                >
                  <span>Next →</span>
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>

      {/* IMPORT QUESTION MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" />
                Import from Question Bank
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportQuestionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter Question ID / Code
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. QB-89410 or keyword"
                    value={importQuery}
                    onChange={(e) => setImportQuery(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-600 uppercase font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Imports full bilingual statement, options, correct key &amp; solution.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md transition"
                >
                  Import Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
