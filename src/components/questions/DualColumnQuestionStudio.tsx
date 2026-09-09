"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Download, ChevronRight, ChevronDown, ArrowLeft, Save, Sliders, CheckCircle2, FileText, Search, Sparkles, PanelLeftClose, PanelLeftOpen, EyeOff } from "lucide-react";
import { UnifiedQuestionEditor } from "./UnifiedQuestionEditor";

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
  subjects?: { name: string; count: number; total: number; sectionId?: string }[];
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
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [activeSubject, setActiveSubject] = useState(subjects[0]?.name || "Biology");
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
  const [jumpInput, setJumpInput] = useState("1");
  const [viewMode, setViewMode] = useState<"side-by-side" | "hindi" | "english">("side-by-side");

  // Keyboard shortcut: Ctrl + X / Cmd + X to toggle sidebar hide/show
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "x" || e.key === "X")) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const hasSelection = (window.getSelection()?.toString().length ?? 0) > 0;
        // Don't intercept if user is cutting text in an input/textarea
        if ((activeTag === "input" || activeTag === "textarea") && hasSelection) {
          return;
        }

        e.preventDefault();
        setIsSidebarHidden((prev) => {
          const next = !prev;
          toast.info(next ? "Question sidebar hidden (Ctrl+X to restore)" : "Question sidebar restored (Ctrl+X)");
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const handleSelectQuestion = (qNum: number) => {
    setCurrentQuestionNumber(qNum);
    setJumpInput(String(qNum));
  };

  // Import question by ID or Code
  const handleImportQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importQuery.trim()) return;

    try {
      const res = await fetch(`/api/team/questions/engine?query=${encodeURIComponent(importQuery.trim())}`);
      const json = await res.json();
      const question = json.data?.questions?.[0];

      if (!question) {
        toast.error(`No question found matching "${importQuery.trim()}".`);
        return;
      }

      const trEn = question.translations?.find((t: any) => t.language === "ENGLISH");
      const trHi = question.translations?.find((t: any) => t.language === "HINDI");
      const optEn = (trEn?.options as any) || {};
      const optHi = (trHi?.options as any) || {};
      const correct = (trEn?.correctOptionIds as any)?.[0] || (trHi?.correctOptionIds as any)?.[0] || "A";

      setQuestionsMap((prev) => ({
        ...prev,
        [currentQuestionNumber]: {
          id: question.id,
          questionNumber: currentQuestionNumber,
          questionCode: question.questionCode,
          subject: question.subject || activeSubject,
          chapter: question.chapter || "",
          topic: question.topic || "",
          subTopic: question.subTopic || "",
          difficulty: question.difficulty || "MEDIUM",
          type: question.type || "SINGLE_CORRECT",
          marks: question.marks || 4,
          negativeMarks: question.negativeMarks || 1,
          statementHi: trHi?.statement || "",
          statementEn: trEn?.statement || "",
          optionAHi: optHi.A || "",
          optionAEn: optEn.A || "",
          optionBHi: optHi.B || "",
          optionBEn: optEn.B || "",
          optionCHi: optHi.C || "",
          optionCEn: optEn.C || "",
          optionDHi: optHi.D || "",
          optionDEn: optEn.D || "",
          correctOption: correct,
          solutionHi: trHi?.solution || "",
          solutionEn: trEn?.solution || "",
          imageUrl: question.figureUrl || question.referenceImageUrl || undefined,
          isSaved: true,
        },
      }));

      setActiveAuthoringSlots((prev) => ({ ...prev, [currentQuestionNumber]: true }));
      setShowImportModal(false);
      setImportQuery("");
      toast.success(`Question ${question.questionCode} imported into slot #${currentQuestionNumber}!`);
    } catch {
      toast.error("Failed to import question from question bank.");
    }
  };



  return (
    <div className="flex h-screen-safe w-full bg-[#f1f4fb] text-slate-900 overflow-hidden font-sans select-none">
      {/* 1. LEFT DEEP-BLUE SIDEBAR (Matching Image 6) */}
      <aside
        className={`bg-[#0c3ea4] text-white flex flex-col justify-between shrink-0 transition-all duration-300 z-30 relative shadow-2xl ${
          isSidebarHidden
            ? "w-0 p-0 overflow-hidden opacity-0 pointer-events-none"
            : sidebarCollapsed
            ? "w-14"
            : "w-64"
        }`}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-200 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              {!sidebarCollapsed && <span>Back</span>}
            </Link>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => {
                  setIsSidebarHidden(true);
                  toast.info("Sidebar hidden (Ctrl+X to show)");
                }}
                className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition"
                title="Hide Sidebar (Ctrl+X)"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

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
              <div key={sub.name} className="space-y-1">
                {/* Section Accordion Header */}
                <button
                  type="button"
                  onClick={() => setActiveSubject(sub.name)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-extrabold transition ${
                    isSubActive
                      ? "bg-white text-[#0c3ea4] shadow-md"
                      : "text-blue-100 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{sub.name}</span>
                  </div>

                  {!sidebarCollapsed && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] font-mono opacity-80">
                        {subSaved}/{sub.total}
                      </span>
                      {isSubActive ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                  )}
                </button>

                {/* Question Grid for Active Section */}
                {isSubActive && !sidebarCollapsed && (
                  <div className="grid grid-cols-5 gap-1.5 p-2 bg-[#092e7a]/50 rounded-2xl border border-white/5 animate-in fade-in">
                    {Array.from({ length: sub.total }, (_, i) => {
                      const qNum = i + 1;
                      const q = questionsMap[qNum];
                      const isCurrent = currentQuestionNumber === qNum;
                      const isSaved = q?.isSaved;

                      return (
                        <button
                          key={qNum}
                          type="button"
                          onClick={() => handleSelectQuestion(qNum)}
                          className={`h-7 rounded-lg text-xs font-black transition relative flex items-center justify-center ${
                            isCurrent
                              ? "bg-white text-[#0c3ea4] ring-2 ring-blue-400 shadow-md scale-105 z-10"
                              : isSaved
                              ? "bg-emerald-500 text-white hover:bg-emerald-600"
                              : "bg-[#0c3ea4] text-blue-200 border border-white/20 hover:bg-white/10"
                          }`}
                        >
                          {qNum}
                          {isSaved && !isCurrent && (
                            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer info and collapse toggle */}
        <div className="p-3 border-t border-white/10 text-xs text-blue-200 flex items-center justify-between">
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
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>
      </aside>

      {/* FLOATING TRIGGER TO RE-OPEN SIDEBAR WHEN HIDDEN */}
      {isSidebarHidden && (
        <button
          type="button"
          onClick={() => {
            setIsSidebarHidden(false);
            toast.info("Sidebar restored");
          }}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-[#0c3ea4] hover:bg-blue-700 text-white pl-2 pr-3 py-3 rounded-r-2xl shadow-2xl flex items-center gap-1.5 text-xs font-bold transition hover:scale-105 border-y border-r border-white/20"
          title="Show Question Palette (Ctrl+X)"
        >
          <PanelLeftOpen className="w-4 h-4" />
          <span className="text-[11px] font-black uppercase tracking-wider">
            Questions
          </span>
          <kbd className="hidden sm:inline px-1 text-[9px] font-mono bg-blue-900 text-blue-200 rounded">
            Ctrl+X
          </kbd>
        </button>
      )}

      {/* 2. RIGHT MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Ribbon (Matching Image 6) */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sidebar Hide/Show Toggle with Ctrl+X */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarHidden(!isSidebarHidden);
                toast.info(!isSidebarHidden ? "Sidebar hidden (Ctrl+X)" : "Sidebar restored (Ctrl+X)");
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition shadow-xs"
              title={isSidebarHidden ? "Show Question Sidebar (Ctrl+X)" : "Hide Question Sidebar (Ctrl+X)"}
            >
              {isSidebarHidden ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-700">Show Sidebar</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline text-xs text-slate-600">Hide</span>
                </>
              )}
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-500 rounded font-semibold">
                Ctrl+X
              </kbd>
            </button>

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
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 group-hover:scale-110 transition flex items-center justify-center mb-3">
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
          /* ACTIVE DUAL-COLUMN QUESTION BUILDER VIA UNIFIED QUESTION EDITOR */
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8 animate-in fade-in">
            <UnifiedQuestionEditor
              key={currentQuestionNumber}
              mode={mode}
              testId={testId}
              testSectionId={activeSubjectObj?.sectionId}
              dppId={dppId}
              slotNumber={currentQuestionNumber}
              totalSlots={totalQuestionsCount}
              initialQuestion={questionsMap[currentQuestionNumber] || {
                subject: activeSubject,
              }}
              onSaveSuccess={(saved) => {
                setQuestionsMap((prev) => ({
                  ...prev,
                  [currentQuestionNumber]: {
                    ...currentQ,
                    ...saved,
                    isSaved: true,
                  },
                }));
              }}
              onNext={handleNextQuestion}
              onPrev={handlePrevQuestion}
              onCancelHref={backHref}
            />
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
