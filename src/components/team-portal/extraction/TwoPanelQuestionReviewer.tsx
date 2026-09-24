"use client";

import React, { useState, useRef, useEffect } from "react";
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
  BookOpen,
  Tag,
  Award,
  Zap,
  Check,
  Upload,
  Image as ImageIcon,
  Languages,
  Sliders,
  RefreshCw,
  Eye,
  CheckCheck,
} from "lucide-react";
import { EquationLivePreview } from "@/components/questions/EquationLivePreview";
import { autoDetectNeetTaxonomy } from "@/lib/questions/neet-taxonomy-detector";
import { detectNeetQuestionType, NEET_QUESTION_TYPES } from "@/lib/questions/neet-question-classifier";

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
  optionsHi?: {
    A: string;
    B: string;
    C: string;
    D: string;
  } | null;
  correctAnswer: string;
  answerKeySource?: string | null;
  solution?: string | null;
  solutionHi?: string | null;
  hasTable: boolean;
  hasImage: boolean;
  missingImage?: boolean;
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
  questions: initialQuestions,
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
  const [questions, setQuestions] = useState<ExtractedQuestionRecord[]>(initialQuestions);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"QUESTION" | "SOLUTION" | "ANSWER" | "SOURCE" | "METADATA">("QUESTION");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isEditing, setIsEditing] = useState(false);
  const [languageMode, setLanguageMode] = useState<"BILINGUAL" | "EN" | "HI">("BILINGUAL");

  // Bulk Apply Metadata Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("Physics");
  const [bulkChapter, setBulkChapter] = useState("");
  const [bulkTopic, setBulkTopic] = useState("");
  const [bulkSubTopic, setBulkSubTopic] = useState("");
  const [bulkDifficulty, setBulkDifficulty] = useState("MEDIUM");
  const [bulkQuestionType, setBulkQuestionType] = useState("SINGLE_CORRECT");
  const [bulkApplyTo, setBulkApplyTo] = useState<"ALL" | "REVIEW_ONLY">("ALL");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Edit states for currently selected question
  const current = questions[selectedIndex] || questions[0];
  const [statementEdit, setStatementEdit] = useState(current?.statement || "");
  const [statementHiEdit, setStatementHiEdit] = useState(current?.statementHi || "");
  const [optionAEdit, setOptionAEdit] = useState(current?.options?.A || "");
  const [optionBEdit, setOptionBEdit] = useState(current?.options?.B || "");
  const [optionCEdit, setOptionCEdit] = useState(current?.options?.C || "");
  const [optionDEdit, setOptionDEdit] = useState(current?.options?.D || "");
  const [optionHiAEdit, setOptionHiAEdit] = useState(current?.optionsHi?.A || "");
  const [optionHiBEdit, setOptionHiBEdit] = useState(current?.optionsHi?.B || "");
  const [optionHiCEdit, setOptionHiCEdit] = useState(current?.optionsHi?.C || "");
  const [optionHiDEdit, setOptionHiDEdit] = useState(current?.optionsHi?.D || "");
  const [correctAnswerEdit, setCorrectAnswerEdit] = useState(current?.correctAnswer || "A");
  const [solutionEdit, setSolutionEdit] = useState(current?.solution || "");
  const [solutionHiEdit, setSolutionHiEdit] = useState(current?.solutionHi || "");
  const [subjectEdit, setSubjectEdit] = useState(current?.subject || "Physics");
  const [chapterEdit, setChapterEdit] = useState(current?.chapter || "");
  const [topicEdit, setTopicEdit] = useState(current?.topic || "");
  const [subTopicEdit, setSubTopicEdit] = useState(current?.subTopic || "");
  const [questionTypeEdit, setQuestionTypeEdit] = useState(current?.questionType || "SINGLE_CORRECT");
  const [difficultyEdit, setDifficultyEdit] = useState(current?.difficulty || "MEDIUM");
  const [savingEdit, setSavingEdit] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);

  // Synchronize when question selection changes
  const handleSelectQuestion = (idx: number) => {
    setSelectedIndex(idx);
    const q = questions[idx];
    if (q) {
      setStatementEdit(q.statement);
      setStatementHiEdit(q.statementHi || "");
      setOptionAEdit(q.options?.A || "");
      setOptionBEdit(q.options?.B || "");
      setOptionCEdit(q.options?.C || "");
      setOptionDEdit(q.options?.D || "");
      setOptionHiAEdit(q.optionsHi?.A || "");
      setOptionHiBEdit(q.optionsHi?.B || "");
      setOptionHiCEdit(q.optionsHi?.C || "");
      setOptionHiDEdit(q.optionsHi?.D || "");
      setCorrectAnswerEdit(q.correctAnswer || "A");
      setSolutionEdit(q.solution || "");
      setSolutionHiEdit(q.solutionHi || "");
      setSubjectEdit(q.subject || "Physics");
      setChapterEdit(q.chapter || "");
      setTopicEdit(q.topic || "");
      setSubTopicEdit(q.subTopic || "");
      setQuestionTypeEdit(q.questionType || "SINGLE_CORRECT");
      setDifficultyEdit(q.difficulty || "MEDIUM");
      setIsEditing(false);
    }
  };

  // Clipboard paste image handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!current) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type && item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            handleUploadImageFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [current]);

  // Upload diagram image file
  const handleUploadImageFile = async (file: File) => {
    if (!current) return;
    setImageUploading(true);
    const tid = toast.loading(`Attaching diagram image to Q.${current.originalNumber}...`);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/team/question-extract/questions/${current.id}/image`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to upload image");

      const updated = json.data.question;
      updateQuestionLocally(updated);
      toast.success(`Diagram image attached to Q.${current.originalNumber}!`, { id: tid });
    } catch (err: any) {
      toast.error(err.message || "Failed to attach image", { id: tid });
    } finally {
      setImageUploading(false);
    }
  };

  // Update question locally in list
  const updateQuestionLocally = (updated: ExtractedQuestionRecord) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updated.id ? { ...q, ...updated, options: updated.options as any } : q))
    );
    if (current && current.id === updated.id) {
      setStatementEdit(updated.statement);
      setStatementHiEdit(updated.statementHi || "");
      setSolutionEdit(updated.solution || "");
      setSolutionHiEdit(updated.solutionHi || "");
    }
    if (onQuestionUpdated) onQuestionUpdated(updated);
  };

  // 1-Click Bulk Metadata submit
  const handleBulkApplyMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkLoading(true);
    const tid = toast.loading("Applying metadata to all extracted questions...");
    try {
      const res = await fetch(`/api/team/question-extract/jobs/${jobId}/bulk-metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: bulkSubject,
          chapter: bulkChapter.trim() || undefined,
          topic: bulkTopic.trim() || undefined,
          subTopic: bulkSubTopic.trim() || undefined,
          difficulty: bulkDifficulty,
          questionType: bulkQuestionType,
          applyTo: bulkApplyTo,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to apply bulk metadata.");

      // Update state locally
      setQuestions((prev) =>
        prev.map((q) => {
          if (bulkApplyTo === "REVIEW_ONLY" && q.status === "VERIFIED") return q;
          return {
            ...q,
            subject: bulkSubject,
            chapter: bulkChapter.trim() || q.chapter,
            topic: bulkTopic.trim() || q.topic,
            subTopic: bulkSubTopic.trim() || q.subTopic,
            difficulty: bulkDifficulty,
            questionType: bulkQuestionType,
          };
        })
      );

      toast.success(`Metadata successfully applied to ${json.data.updatedCount} questions in 1 click!`, { id: tid });
      setShowBulkModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to apply bulk metadata.", { id: tid });
    } finally {
      setBulkLoading(false);
    }
  };

  // AI Translate & Enhance Single Question
  const handleAiEnhance = async (action: "TRANSLATE" | "SOLUTION" | "ALL") => {
    if (!current) return;
    setAiEnhancing(true);
    const tid = toast.loading(
      action === "TRANSLATE"
        ? `Generating bilingual NCERT translation for Q.${current.originalNumber}...`
        : `Generating 4-step step-by-step solution for Q.${current.originalNumber}...`
    );

    try {
      const res = await fetch(`/api/team/question-extract/questions/${current.id}/ai-enhance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "AI Enhancement failed.");

      updateQuestionLocally(json.data.question);
      toast.success(json.data.message || "AI enhancement complete!", { id: tid });
    } catch (err: any) {
      toast.error(err.message || "AI processing failed.", { id: tid });
    } finally {
      setAiEnhancing(false);
    }
  };

  // Missing Images / Issues Metrics
  const missingDiagramQuestions = questions.filter(
    (q) =>
      q.hasImage &&
      !q.imageUrl &&
      (q.reviewReasons?.some((r) => r.toLowerCase().includes("diagram") || r.toLowerCase().includes("image")) ||
        /\b(figure|diagram|circuit|चित्र|आरेख|ग्राफ)\b/i.test(q.statement + " " + (q.statementHi || "")))
  );

  const incompleteQuestions = questions.filter(
    (q) => !q.options?.A || !q.options?.B || !q.options?.C || !q.options?.D || !q.correctAnswer
  );

  // Filter questions list
  const filteredQuestions = questions.filter((q) => {
    if (statusFilter === "MISSING_IMAGE") {
      const isMissingDiag =
        !q.imageUrl &&
        (q.hasImage ||
          q.reviewReasons?.some((r) => r.toLowerCase().includes("image") || r.toLowerCase().includes("diagram")) ||
          /\b(figure|diagram|circuit|चित्र|आरेख|ग्राफ)\b/i.test(q.statement + " " + (q.statementHi || "")));
      if (!isMissingDiag) return false;
    } else if (statusFilter === "INCOMPLETE") {
      const isIncomplete = !q.options?.A || !q.options?.B || !q.options?.C || !q.options?.D || !q.correctAnswer;
      if (!isIncomplete) return false;
    } else if (statusFilter !== "ALL" && q.status !== statusFilter) {
      return false;
    }

    if (searchQuery) {
      const qNumMatch = String(q.originalNumber).includes(searchQuery);
      const textMatch = (q.statement + " " + (q.statementHi || "")).toLowerCase().includes(searchQuery.toLowerCase());
      const subjectMatch = q.subject.toLowerCase().includes(searchQuery.toLowerCase());
      const chapterMatch = (q.chapter || "").toLowerCase().includes(searchQuery.toLowerCase());
      if (!qNumMatch && !textMatch && !subjectMatch && !chapterMatch) return false;
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
          statementHi: statementHiEdit || null,
          options: {
            A: optionAEdit,
            B: optionBEdit,
            C: optionCEdit,
            D: optionDEdit,
          },
          optionsHi: optionHiAEdit
            ? {
                A: optionHiAEdit,
                B: optionHiBEdit,
                C: optionHiCEdit,
                D: optionHiDEdit,
              }
            : undefined,
          correctAnswer: correctAnswerEdit,
          solution: solutionEdit || null,
          solutionHi: solutionHiEdit || null,
          subject: subjectEdit,
          chapter: chapterEdit || null,
          topic: topicEdit || null,
          subTopic: subTopicEdit || null,
          questionType: questionTypeEdit,
          difficulty: difficultyEdit,
          status: markAsVerified ? "VERIFIED" : current.status,
          reviewReasons: markAsVerified ? [] : current.reviewReasons,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update question.");

      toast.success(
        markAsVerified
          ? `Question Q.${current.originalNumber} updated and marked as VERIFIED!`
          : "Saved changes!"
      );
      setIsEditing(false);
      updateQuestionLocally(json.data.question);
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

  // Live auto-detected taxonomy fallback for display
  const liveTaxonomy = autoDetectNeetTaxonomy(current.statement, current.options, current.subject);
  const displayChapter = current.chapter || liveTaxonomy?.chapter || "General Fundamentals";
  const displayTopic = current.topic || liveTaxonomy?.topic || "Core Principles";

  const isCurrentMissingDiagram =
    !current.imageUrl &&
    (current.hasImage ||
      current.reviewReasons?.some((r) => r.toLowerCase().includes("image") || r.toLowerCase().includes("diagram")) ||
      /\b(figure|diagram|circuit|चित्र|आरेख|ग्राफ)\b/i.test(current.statement + " " + (current.statementHi || "")));

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* 0. TOP TRIAGE & QUICK ACTIONS TOOLBAR */}
      {/* ============================================================ */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Stats & Warnings */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold font-mono">
            {sourceName} ({questions.length} Qs)
          </span>

          {missingDiagramQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "MISSING_IMAGE" ? "ALL" : "MISSING_IMAGE")}
              className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition cursor-pointer ${
                statusFilter === "MISSING_IMAGE"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{missingDiagramQuestions.length} Missing Diagrams</span>
            </button>
          )}

          {incompleteQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "INCOMPLETE" ? "ALL" : "INCOMPLETE")}
              className={`px-3 py-1 rounded-full font-bold flex items-center gap-1.5 transition cursor-pointer ${
                statusFilter === "INCOMPLETE"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{incompleteQuestions.length} Incomplete Extraction</span>
            </button>
          )}
        </div>

        {/* Right Action: 1-Click Bulk Metadata */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>⚡ 1-Click Bulk Apply Metadata</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1-CLICK BULK METADATA MODAL */}
      {/* ============================================================ */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Bulk Apply Metadata in 1-Click
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Apply Subject, Chapter, Topic &amp; Level to all {questions.length} questions at once.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkApplyMetadata} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
                  <select
                    value={bulkSubject}
                    onChange={(e) => setBulkSubject(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">General Science</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Difficulty Level *</label>
                  <select
                    value={bulkDifficulty}
                    onChange={(e) => setBulkDifficulty(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold"
                  >
                    <option value="EASY">Level 1: Foundation (Easy)</option>
                    <option value="MEDIUM">Level 2: Moderate (NEET Standard)</option>
                    <option value="HARD">Level 3: Difficult (Multi-Concept)</option>
                    <option value="VERY_HARD">Level 4: Master Challenger</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Chapter Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Current Electricity / Thermodynamics"
                  value={bulkChapter}
                  onChange={(e) => setBulkChapter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Topic Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kirchhoff's Rules"
                    value={bulkTopic}
                    onChange={(e) => setBulkTopic(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subtopic Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Loop Rule & Node Analysis"
                    value={bulkSubTopic}
                    onChange={(e) => setBulkSubTopic(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Question Format</label>
                <select
                  value={bulkQuestionType}
                  onChange={(e) => setBulkQuestionType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl"
                >
                  {NEET_QUESTION_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.hindiName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Apply Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkApplyTo("ALL")}
                    className={`p-2.5 rounded-xl border text-center font-bold transition ${
                      bulkApplyTo === "ALL"
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    All {questions.length} Questions
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkApplyTo("REVIEW_ONLY")}
                    className={`p-2.5 rounded-xl border text-center font-bold transition ${
                      bulkApplyTo === "REVIEW_ONLY"
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    Only Unverified ({questions.filter((q) => q.status !== "VERIFIED").length})
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkLoading}
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/25"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>{bulkLoading ? "Applying..." : "Apply in 1-Click"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2-PANEL MAIN LAYOUT */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================ */}
        {/* LEFT PANEL: QUESTION NAVIGATOR (4 Cols) */}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm sticky top-20">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Questions Navigator
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {questions.length} extracted of {expectedCount}
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
                placeholder="Search Q.No, text, chapter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-8 pr-3 py-1.5 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] font-bold no-scrollbar">
              {[
                { id: "ALL", label: "All" },
                { id: "MISSING_IMAGE", label: `Missing Diagram (${missingDiagramQuestions.length})` },
                { id: "INCOMPLETE", label: `Incomplete (${incompleteQuestions.length})` },
                { id: "VERIFIED", label: "Verified" },
                { id: "REVIEW_REQUIRED", label: "Review" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer ${
                    statusFilter === st.id
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Question Number Grid / List */}
          <div className="max-h-[580px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredQuestions.map((q) => {
              const isSelected = q.originalNumber === current.originalNumber;
              const isQVerified = q.status === "VERIFIED" || q.status === "IMPORTED";
              const isQReview = q.status === "REVIEW_REQUIRED";
              const isQMissingDiag =
                !q.imageUrl &&
                (q.hasImage ||
                  q.reviewReasons?.some((r) => r.toLowerCase().includes("image") || r.toLowerCase().includes("diagram")) ||
                  /\b(figure|diagram|circuit|चित्र|आरेख|ग्राफ)\b/i.test(q.statement + " " + (q.statementHi || "")));

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleSelectQuestion(questions.findIndex((orig) => orig.id === q.id))}
                  className={`w-full text-left p-2.5 rounded-2xl transition flex items-center justify-between gap-2 text-xs group cursor-pointer ${
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
                    <div className="min-w-0">
                      <span className="text-[11px] font-medium text-slate-900 dark:text-white truncate block">
                        {q.statement.slice(0, 35)}...
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-slate-400 truncate">
                          {q.chapter || "General"}
                        </span>
                        {isQMissingDiag && (
                          <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-700 text-[8px] font-black uppercase">
                            📷 Missing Img
                          </span>
                        )}
                        {q.statementHi && (
                          <span className="px-1 py-0.2 rounded bg-blue-100 text-blue-700 text-[8px] font-bold">
                            🌐 Dual
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    {isQVerified ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isQReview ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT PANEL: DETAIL VIEW & EDIT TABS (8 Cols) */}
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
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs font-mono">
                    {current.sourceName} — Page {current.sourcePage}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                    {current.subject}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                    {current.difficulty}
                  </span>
                  {current.statementHi && (
                    <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold flex items-center gap-1">
                      <Languages className="w-3 h-3" />
                      <span>Bilingual</span>
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block font-mono">
                  Chapter: <b className="text-slate-700 dark:text-slate-200">{displayChapter}</b> • Topic: <b className="text-slate-700 dark:text-slate-200">{displayTopic}</b>
                </span>
              </div>
            </div>

            {/* Quick Actions & Edit Toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={selectedIndex <= 0}
                onClick={() => handleSelectQuestion(selectedIndex - 1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                title="Previous Question"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={selectedIndex >= questions.length - 1}
                onClick={() => handleSelectQuestion(selectedIndex + 1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                title="Next Question"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                  isEditing
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isEditing ? "Viewing Mode" : "Edit Question"}</span>
              </button>
            </div>
          </div>

          {/* Missing Diagram Alert / Attachment Card */}
          {isCurrentMissingDiagram && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 dark:from-rose-950/40 dark:via-amber-950/30 dark:to-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-extrabold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
                  <span>Missing Diagram Alert for Q.{current.originalNumber}:</span>
                </div>
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono font-bold">
                  Image Attachment Required
                </span>
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                This question text refers to a scientific diagram, circuit, or figure. You can attach it below by selecting a file or pressing <b>Ctrl+V</b> to paste a screenshot!
              </p>

              <input
                type="file"
                ref={imageInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadImageFile(f);
                }}
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={imageUploading}
                  onClick={() => imageInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{imageUploading ? "Uploading..." : "Upload Diagram Image"}</span>
                </button>
                <span className="text-[11px] text-slate-500 font-mono">
                  Or simply press Ctrl+V anywhere on screen
                </span>
              </div>
            </div>
          )}

          {/* Main Content Tabs & Language Switcher */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex gap-2 overflow-x-auto text-xs font-bold no-scrollbar">
                {[
                  { key: "QUESTION", label: "Question & Options" },
                  { key: "SOLUTION", label: "Step-by-Step Solution" },
                  { key: "ANSWER", label: "Answer Key" },
                  { key: "METADATA", label: "Taxonomy & Details" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`pb-2 px-3 transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      activeTab === tab.key
                        ? "border-blue-600 text-blue-600 font-extrabold"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Language Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setLanguageMode("BILINGUAL")}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                    languageMode === "BILINGUAL"
                      ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  Dual (EN+HI)
                </button>
                <button
                  type="button"
                  onClick={() => setLanguageMode("EN")}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                    languageMode === "EN"
                      ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguageMode("HI")}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                    languageMode === "HI"
                      ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  Hindi
                </button>
              </div>
            </div>

            {/* TAB 1: QUESTION & OPTIONS */}
            {activeTab === "QUESTION" && (
              <div className="space-y-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Question Statement (English - LaTeX $...$ supported)
                      </label>
                      <textarea
                        rows={3}
                        value={statementEdit}
                        onChange={(e) => setStatementEdit(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Question Statement (Hindi - Devanagari)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Hindi question statement..."
                        value={statementHiEdit}
                        onChange={(e) => setStatementHiEdit(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition font-sans"
                      />
                    </div>

                    {/* Options Grid Edit */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: "A", val: optionAEdit, setVal: setOptionAEdit, hiVal: optionHiAEdit, setHiVal: setOptionHiAEdit },
                        { key: "B", val: optionBEdit, setVal: setOptionBEdit, hiVal: optionHiBEdit, setHiVal: setOptionHiBEdit },
                        { key: "C", val: optionCEdit, setVal: setOptionCEdit, hiVal: optionHiCEdit, setHiVal: setOptionHiCEdit },
                        { key: "D", val: optionDEdit, setVal: setOptionDEdit, hiVal: optionHiDEdit, setHiVal: setOptionHiDEdit },
                      ].map((opt) => (
                        <div key={opt.key} className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          <label className="text-[11px] font-bold text-slate-500">Option ({opt.key})</label>
                          <input
                            type="text"
                            placeholder={`English Option ${opt.key}`}
                            value={opt.val}
                            onChange={(e) => opt.setVal(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs"
                          />
                          <input
                            type="text"
                            placeholder={`Hindi Option ${opt.key}`}
                            value={opt.hiVal}
                            onChange={(e) => opt.setHiVal(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs text-slate-600 dark:text-slate-300"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3">
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Correct Option:</label>
                        <div className="flex gap-2">
                          {["A", "B", "C", "D"].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setCorrectAnswerEdit(opt)}
                              className={`w-8 h-8 rounded-xl font-mono font-bold text-xs transition cursor-pointer ${
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

                      <button
                        type="button"
                        disabled={aiEnhancing}
                        onClick={() => handleAiEnhance("TRANSLATE")}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>AI Auto-Translate</span>
                      </button>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveQuestion(false)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        Save Draft Changes
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveQuestion(true)}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify &amp; Resolve</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Rendered Statements */}
                    {(languageMode === "BILINGUAL" || languageMode === "EN") && current.statement && (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm text-slate-900 dark:text-white leading-relaxed font-sans space-y-1">
                        {languageMode === "BILINGUAL" && (
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block font-mono">
                            [English Statement]
                          </span>
                        )}
                        <EquationLivePreview content={current.statement} label="" />
                      </div>
                    )}

                    {(languageMode === "BILINGUAL" || languageMode === "HI") && current.statementHi && (
                      <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-sm text-slate-900 dark:text-white leading-relaxed font-sans space-y-1">
                        {languageMode === "BILINGUAL" && (
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block font-mono">
                            [Hindi Statement — Devanagari]
                          </span>
                        )}
                        <EquationLivePreview content={current.statementHi} label="" />
                      </div>
                    )}

                    {/* Auto-Translate Suggestion if Missing 2nd Language */}
                    {!current.statementHi && (
                      <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-3 text-xs">
                        <span className="text-purple-900 dark:text-purple-200">
                          Single-language question. Tap to auto-generate authentic NCERT Hindi translation.
                        </span>
                        <button
                          type="button"
                          disabled={aiEnhancing}
                          onClick={() => handleAiEnhance("TRANSLATE")}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Generate Hindi</span>
                        </button>
                      </div>
                    )}

                    {/* Figure / Diagram If Present */}
                    {current.imageUrl && (
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                        <img
                          src={current.imageUrl}
                          alt={`Diagram for Q.${current.originalNumber}`}
                          className="max-h-72 mx-auto rounded-xl shadow-sm border border-slate-100 dark:border-slate-800"
                        />
                        <span className="text-[10px] text-slate-400 font-mono">
                          Attached Scientific Diagram for Q.{current.originalNumber}
                        </span>
                      </div>
                    )}

                    {/* Rendered Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: "A", val: current.options?.A, hiVal: current.optionsHi?.A },
                        { key: "B", val: current.options?.B, hiVal: current.optionsHi?.B },
                        { key: "C", val: current.options?.C, hiVal: current.optionsHi?.C },
                        { key: "D", val: current.options?.D, hiVal: current.optionsHi?.D },
                      ].map((opt) => {
                        const isCorrect = current.correctAnswer === opt.key;
                        return (
                          <div
                            key={opt.key}
                            className={`p-3.5 rounded-2xl border transition flex items-start gap-3 ${
                              isCorrect
                                ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-sm"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                                isCorrect
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {opt.key}
                            </span>
                            <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed min-w-0 flex-1 space-y-1">
                              {(languageMode === "BILINGUAL" || languageMode === "EN") && (
                                <EquationLivePreview content={opt.val || "—"} label="" />
                              )}
                              {(languageMode === "BILINGUAL" || languageMode === "HI") && opt.hiVal && (
                                <p className="text-slate-600 dark:text-slate-400 text-[11px] pt-0.5 border-t border-slate-100 dark:border-slate-800/60">
                                  <EquationLivePreview content={opt.hiVal} label="" />
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STEP-BY-STEP SOLUTION */}
            {activeTab === "SOLUTION" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span>4-Step Bilingual Solution (Explaining, Concept, Derivation, Final Answer)</span>
                  </h4>

                  <button
                    type="button"
                    disabled={aiEnhancing}
                    onClick={() => handleAiEnhance("SOLUTION")}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${aiEnhancing ? "animate-spin" : ""}`} />
                    <span>Regenerate Solution</span>
                  </button>
                </div>

                {current.solution ? (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-900 dark:text-white leading-relaxed font-mono whitespace-pre-wrap">
                    <EquationLivePreview content={current.solution} label="Solution Steps (English)" />
                  </div>
                ) : null}

                {current.solutionHi ? (
                  <div className="p-4 rounded-2xl bg-blue-50/30 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-900 dark:text-white leading-relaxed font-sans whitespace-pre-wrap">
                    <EquationLivePreview content={current.solutionHi} label="चरण-दर-चरण हल (Hindi)" />
                  </div>
                ) : null}

                {!current.solution && !current.solutionHi && (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-3">
                    <p className="text-xs text-slate-400">
                      No solution attached for Q.{current.originalNumber}.
                    </p>
                    <button
                      type="button"
                      disabled={aiEnhancing}
                      onClick={() => handleAiEnhance("SOLUTION")}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/25 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate 4-Step Solution with AI</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ANSWER KEY */}
            {activeTab === "ANSWER" && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-mono font-black text-xl shadow-sm">
                    {current.correctAnswer}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-emerald-950 dark:text-emerald-200">
                      Official Answer: Option ({current.correctAnswer})
                    </h4>
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">
                      Mapped to Q.{current.originalNumber} • Source: {current.answerKeySource || "AI Parser"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: METADATA & DETAILS */}
            {activeTab === "METADATA" && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Subject</span>
                    <p className="font-black text-sm text-slate-900 dark:text-white">{current.subject}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Chapter</span>
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{displayChapter}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Topic</span>
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{displayTopic}</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Difficulty</span>
                    <p className="font-black text-xs text-slate-900 dark:text-white">{current.difficulty}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
