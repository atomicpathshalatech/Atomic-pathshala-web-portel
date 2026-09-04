"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Layers,
  Edit2,
  Send,
  ExternalLink,
  Sparkles,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import { EquationLivePreview } from "@/components/questions/EquationLivePreview";

export interface ExtractedQuestionRecord {
  id: string;
  jobId: string;
  questionIndex: number;
  originalNumber: number;
  sourceName: string;
  sourcePdfUrl: string;
  sourcePdfName: string;
  sourcePage: number;
  statement: string;
  statementHi?: string | null;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: string;
  answerKeySource?: string | null;
  solution?: string | null;
  solutionHi?: string | null;
  hasTable: boolean;
  hasImage: boolean;
  imageUrl?: string | null;
  hasEquation: boolean;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  questionType: string;
  difficulty: string;
  status: "VERIFIED" | "REVIEW_REQUIRED" | "EXTRACTION_ERROR" | "MISSING" | "DUPLICATE" | "IMPORTED";
  confidence: number;
  confidenceBreakdown?: any;
  reviewReasons?: string[];
  originalSnapshot?: any;
  isEdited?: boolean;
}

export function TwoPanelQuestionReviewer({
  questions,
  jobId,
  sourceName,
  expectedCount,
  onQuestionUpdated,
}: {
  questions: ExtractedQuestionRecord[];
  jobId: string;
  sourceName: string;
  expectedCount: number;
  onQuestionUpdated?: (updated: ExtractedQuestionRecord) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"QUESTION" | "SOLUTION" | "ANSWER" | "SOURCE" | "METADATA">("QUESTION");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isEditing, setIsEditing] = useState(false);

  // Edit states for currently selected question
  const current = questions[selectedIndex] || questions[0];
  const [statementEdit, setStatementEdit] = useState(current?.statement || "");
  const [optionAEdit, setOptionAEdit] = useState(current?.options?.A || "");
  const [optionBEdit, setOptionBEdit] = useState(current?.options?.B || "");
  const [optionCEdit, setOptionCEdit] = useState(current?.options?.C || "");
  const [optionDEdit, setOptionDEdit] = useState(current?.options?.D || "");
  const [correctAnswerEdit, setCorrectAnswerEdit] = useState(current?.correctAnswer || "A");
  const [solutionEdit, setSolutionEdit] = useState(current?.solution || "");
  const [subjectEdit, setSubjectEdit] = useState(current?.subject || "General");
  const [chapterEdit, setChapterEdit] = useState(current?.chapter || "");
  const [topicEdit, setTopicEdit] = useState(current?.topic || "");
  const [questionTypeEdit, setQuestionTypeEdit] = useState(current?.questionType || "SINGLE_CORRECT");
  const [difficultyEdit, setDifficultyEdit] = useState(current?.difficulty || "MEDIUM");
  const [savingEdit, setSavingEdit] = useState(false);

  // Switch question
  const handleSelectQuestion = (idx: number) => {
    setSelectedIndex(idx);
    const q = questions[idx];
    if (q) {
      setStatementEdit(q.statement);
      setOptionAEdit(q.options?.A || "");
      setOptionBEdit(q.options?.B || "");
      setOptionCEdit(q.options?.C || "");
      setOptionDEdit(q.options?.D || "");
      setCorrectAnswerEdit(q.correctAnswer || "A");
      setSolutionEdit(q.solution || "");
      setSubjectEdit(q.subject || "General");
      setChapterEdit(q.chapter || "");
      setTopicEdit(q.topic || "");
      setQuestionTypeEdit(q.questionType || "SINGLE_CORRECT");
      setDifficultyEdit(q.difficulty || "MEDIUM");
      setIsEditing(false);
    }
  };

  // Filter questions list
  const filteredQuestions = questions.filter((q) => {
    if (statusFilter !== "ALL" && q.status !== statusFilter) return false;
    if (searchQuery) {
      const qNumMatch = String(q.originalNumber).includes(searchQuery);
      const textMatch = q.statement.toLowerCase().includes(searchQuery.toLowerCase());
      const subjectMatch = q.subject.toLowerCase().includes(searchQuery.toLowerCase());
      if (!qNumMatch && !textMatch && !subjectMatch) return false;
    }
    return true;
  });

  const handleSaveQuestion = async (markAsVerified: boolean = true) => {
    if (!current) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/team/question-extract/questions/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: statementEdit,
          options: {
            A: optionAEdit,
            B: optionBEdit,
            C: optionCEdit,
            D: optionDEdit,
          },
          correctAnswer: correctAnswerEdit,
          solution: solutionEdit || null,
          subject: subjectEdit,
          chapter: chapterEdit || null,
          topic: topicEdit || null,
          questionType: questionTypeEdit,
          difficulty: difficultyEdit,
          status: markAsVerified ? "VERIFIED" : current.status,
          reviewReasons: markAsVerified ? [] : current.reviewReasons,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update question.");

      toast.success(markAsVerified ? `Question Q.${current.originalNumber} updated and marked as VERIFIED!` : "Saved changes!");
      setIsEditing(false);
      if (onQuestionUpdated) onQuestionUpdated(json.data.question);
    } catch (err: any) {
      toast.error(err.message || "Failed to save.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (!current) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        No questions found in this extraction job.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ============================================================ */}
      {/* LEFT PANEL: QUESTION LIST & FILTERS (4 Cols) */}
      {/* ============================================================ */}
      <div className="lg:col-span-4 space-y-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-20">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Questions Navigator
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">
              Source: <b className="text-blue-600">{sourceName}</b> ({questions.length}/{expectedCount})
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            {filteredQuestions.length} shown
          </span>
        </div>

        {/* Search & Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Q.No or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-8 pr-3 py-1.5 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] font-bold no-scrollbar">
            {["ALL", "VERIFIED", "REVIEW_REQUIRED", "EXTRACTION_ERROR", "MISSING"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg transition shrink-0 ${
                  statusFilter === st
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                {st === "ALL" ? "All" : st === "REVIEW_REQUIRED" ? "Review" : st === "EXTRACTION_ERROR" ? "Error" : st === "VERIFIED" ? "Verified" : "Missing"}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Question Number Grid / List */}
        <div className="max-h-[580px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredQuestions.map((q, idx) => {
            const isSelected = q.originalNumber === current.originalNumber;
            const isQVerified = q.status === "VERIFIED" || q.status === "IMPORTED";
            const isQReview = q.status === "REVIEW_REQUIRED";
            const isQMissing = q.status === "MISSING";

            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => handleSelectQuestion(questions.findIndex((orig) => orig.id === q.id))}
                className={`w-full text-left p-2.5 rounded-2xl transition flex items-center justify-between gap-2 text-xs group ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 shadow-sm"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-lg text-[11px] shrink-0 ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    Q.{q.originalNumber}
                  </span>
                  <span className="text-[11px] font-medium text-slate-900 dark:text-white truncate block">
                    {q.statement.slice(0, 45)}...
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-semibold">{q.subject.slice(0, 4)}</span>
                  {isQVerified ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : isQReview ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  ) : isQMissing ? (
                    <HelpCircle className="w-3.5 h-3.5 text-rose-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT PANEL: QUESTION DETAIL VIEW & EDIT TABS (8 Cols) */}
      {/* ============================================================ */}
      <div className="lg:col-span-8 space-y-4">
        {/* Top Header Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-2xl bg-blue-600 text-white font-mono font-black text-sm shadow-sm">
              Q.{current.originalNumber}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs font-mono">
                  {current.sourceName} — Page {current.sourcePage}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                  {current.questionType}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                  {current.subject}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block font-mono">
                Index: {selectedIndex + 1} of {questions.length} • Confidence: {current.confidence}%
              </span>
            </div>
          </div>

          {/* Previous / Next Controls & Quick Edit Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedIndex <= 0}
              onClick={() => handleSelectQuestion(selectedIndex - 1)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
              title="Previous Question"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={selectedIndex >= questions.length - 1}
              onClick={() => handleSelectQuestion(selectedIndex + 1)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
              title="Next Question"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${
                isEditing
                  ? "bg-slate-800 text-white"
                  : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{isEditing ? "Viewing Mode" : "Edit Question"}</span>
            </button>
          </div>
        </div>

        {/* Review Required Alert (If Any) */}
        {current.reviewReasons && current.reviewReasons.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-extrabold">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Review Required Reasons:</span>
            </div>
            <ul className="list-disc list-inside text-amber-800 dark:text-amber-300 text-[11px] space-y-0.5">
              {current.reviewReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Main Content Tabs */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex border-b border-slate-100 dark:border-slate-800 gap-2 overflow-x-auto text-xs font-bold no-scrollbar">
            {[
              { key: "QUESTION", label: "Question & Options" },
              { key: "SOLUTION", label: "Original Solution" },
              { key: "ANSWER", label: "Answer Key" },
              { key: "SOURCE", label: "Source Reference" },
              { key: "METADATA", label: "Taxonomy & Rules" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`pb-3 px-3 transition border-b-2 ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600 font-extrabold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: QUESTION & OPTIONS */}
          {activeTab === "QUESTION" && (
            <div className="space-y-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Question Statement (LaTeX supported)
                    </label>
                    <textarea
                      rows={4}
                      value={statementEdit}
                      onChange={(e) => setStatementEdit(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition font-sans leading-relaxed"
                    />
                    <EquationLivePreview content={statementEdit} label="Live Statement Preview" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: "A", val: optionAEdit, setVal: setOptionAEdit },
                      { key: "B", val: optionBEdit, setVal: setOptionBEdit },
                      { key: "C", val: optionCEdit, setVal: setOptionCEdit },
                      { key: "D", val: optionDEdit, setVal: setOptionDEdit },
                    ].map((opt) => (
                      <div key={opt.key} className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500">Option ({opt.key})</label>
                        <input
                          type="text"
                          value={opt.val}
                          onChange={(e) => opt.setVal(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-3">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Correct Option:</label>
                    <div className="flex gap-2">
                      {["A", "B", "C", "D"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setCorrectAnswerEdit(opt)}
                          className={`w-8 h-8 rounded-xl font-mono font-bold text-xs transition ${
                            correctAnswerEdit === opt
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => handleSaveQuestion(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                    >
                      Save Draft Changes
                    </button>
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => handleSaveQuestion(true)}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify &amp; Resolve</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Rendered Statement */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm text-slate-900 dark:text-white leading-relaxed font-sans">
                    <EquationLivePreview content={current.statement} label="" />
                  </div>

                  {/* Figure / Image If Present */}
                  {current.imageUrl && (
                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                      <img
                        src={current.imageUrl}
                        alt={`Extracted Figure for Q.${current.originalNumber}`}
                        className="max-h-64 mx-auto rounded-lg shadow-sm"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                        Original Figure from Page {current.sourcePage}
                      </span>
                    </div>
                  )}

                  {/* Rendered Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: "A", val: current.options?.A },
                      { key: "B", val: current.options?.B },
                      { key: "C", val: current.options?.C },
                      { key: "D", val: current.options?.D },
                    ].map((opt) => {
                      const isCorrect = current.correctAnswer === opt.key;
                      return (
                        <div
                          key={opt.key}
                          className={`p-3.5 rounded-2xl border transition flex items-start gap-3 ${
                            isCorrect
                              ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 font-semibold"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                              isCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {opt.key}
                          </span>
                          <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed min-w-0 flex-1">
                            <EquationLivePreview content={opt.val || "—"} label="" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SOLUTION */}
          {activeTab === "SOLUTION" && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Original Extracted Solution
              </h4>
              {current.solution ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-900 dark:text-white leading-relaxed font-mono whitespace-pre-wrap">
                  <EquationLivePreview content={current.solution} label="Solution Steps" />
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No solution was included in the source document for Question Q.{current.originalNumber}.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ANSWER */}
          {activeTab === "ANSWER" && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-mono font-black text-xl shadow-sm">
                  {current.correctAnswer}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-emerald-950 dark:text-emerald-200">
                    Official Answer Key: Option ({current.correctAnswer})
                  </h4>
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">
                    Source: {current.answerKeySource || "ANSWER_KEY_SECTION"} • Mapped to Q.{current.originalNumber}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SOURCE */}
          {activeTab === "SOURCE" && (
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Source Name</span>
                  <span className="text-blue-600 font-extrabold">{current.sourceName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Original Q. Number</span>
                  <span className="text-slate-900 dark:text-white font-bold">Q.{current.originalNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Source PDF File</span>
                  <span className="text-slate-900 dark:text-white truncate block">{current.sourcePdfName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Source Page</span>
                  <span className="text-slate-900 dark:text-white font-bold">Page {current.sourcePage}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: METADATA */}
          {activeTab === "METADATA" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Subject</span>
                  <span className="font-bold text-slate-900 dark:text-white">{current.subject}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Question Format</span>
                  <span className="font-bold text-slate-900 dark:text-white">{current.questionType}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Difficulty</span>
                  <span className="font-bold text-slate-900 dark:text-white">{current.difficulty}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
