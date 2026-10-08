"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Brain,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Edit3,
  Languages,
  Layers,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Check,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  Award,
  Hash,
  FileText,
  Clock,
  History,
  Send,
  HelpCircle,
  ExternalLink,
  MonitorPlay,
  CheckSquare,
  ListOrdered,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";
import type { MultiDimensionalAuditResult } from "@/lib/questions/ai-audit-engine";

export interface SiblingQuestionSummary {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic?: string | null;
  difficulty: string;
  type: string;
  status: string;
  aiVerified?: boolean;
  aiAuditScore?: number | null;
  statementSnippet?: string;
}

export interface QuestionFullReviewProps {
  question: {
    id: string;
    questionCode: string | null;
    subject: string;
    chapter: string | null;
    topic: string | null;
    subTopic: string | null;
    microConcept?: string | null;
    type: string;
    difficulty: string;
    examLevel?: string | null;
    status: string;
    version: number;
    imageUrl?: string | null;
    referenceImageUrl?: string | null;
    tags?: string | null;
    aiVerified?: boolean;
    aiAuditStatus?: string | null;
    aiAuditScore?: number | null;
    aiAuditResult?: any;
    aiAuditIssues?: any;
    aiAuditedAt?: string | Date | null;
    needsReaudit?: boolean;
    review1Status?: string | null;
    review1Notes?: string | null;
    review2Status?: string | null;
    review2Notes?: string | null;
    correctionStatus?: string | null;
    correctionNotes?: string | null;
    createdBy?: { id: string; name: string | null; email: string | null } | null;
    translations: Array<{
      id: string;
      language: string;
      statement: string;
      options?: any;
      correctOptionIds?: any;
      solution?: string | null;
    }>;
    auditLogs?: Array<{
      id: string;
      score: number;
      decision: string;
      aiModel: string;
      createdAt: string | Date;
      errorStatus?: string | null;
    }>;
  };
  currentUserId?: string;
  userRole?: string;
  currentIndex?: number;
  totalCount?: number;
  prevQuestionId?: string | null;
  nextQuestionId?: string | null;
  siblingQuestions?: SiblingQuestionSummary[];
  queryParamsString?: string;
}

const QUESTION_TYPES = [
  { id: "SINGLE_CORRECT", label: "Single Correct (MCQ)" },
  { id: "MULTIPLE_CORRECT", label: "Multiple Correct" },
  { id: "ASSERTION_REASON", label: "Assertion-Reason" },
  { id: "STATEMENT_BASED", label: "Statement Based" },
  { id: "MULTIPLE_STATEMENT", label: "Multiple Statement" },
  { id: "TRUE_FALSE", label: "True / False" },
  { id: "MATCH_THE_COLUMN", label: "Match the Column" },
  { id: "INTEGER_NUMERICAL", label: "Integer / Numerical" },
  { id: "DIAGRAM_BASED", label: "Diagram Based" },
  { id: "IMAGE_BASED", label: "Image Based" },
  { id: "SEQUENCE_ORDER", label: "Sequence / Order" },
  { id: "CASE_BASED", label: "Case Based" },
  { id: "PASSAGE_BASED", label: "Passage Based" },
  { id: "EXPERIMENTAL", label: "Experimental" },
  { id: "GRAPH_BASED", label: "Graph Based" },
  { id: "CONCEPTUAL", label: "Conceptual" },
  { id: "FACTUAL", label: "Factual" },
  { id: "APPLICATION_BASED", label: "Application Based" },
];

const EXAM_LEVELS = [
  "NEET",
  "JEE_MAIN",
  "JEE_ADVANCED",
  "CUET",
  "BOARD",
  "AIIMS_HISTORICAL",
  "FOUNDATION",
  "OLYMPIAD",
  "ADVANCED",
  "OTHER",
];

const DIFFICULTY_LEVELS = ["EASY", "MODERATE", "DIFFICULT", "VERY_DIFFICULT"];

export function QuestionFullReviewWorkspace({
  question: initialQuestion,
  currentIndex = 1,
  totalCount = 1,
  prevQuestionId = null,
  nextQuestionId = null,
  siblingQuestions = [],
  queryParamsString = "",
}: QuestionFullReviewProps) {
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("ENGLISH");
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [runningAiAudit, setRunningAiAudit] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<"ai_audit" | "metadata" | "history">("ai_audit");

  // CBT Preview Modal State
  const [showCbtPreviewModal, setShowCbtPreviewModal] = useState(false);
  const [cbtPreviewLang, setCbtPreviewLang] = useState<"ENGLISH" | "HINDI">("ENGLISH");
  const [cbtPreviewSelectedOption, setCbtPreviewSelectedOption] = useState<string | null>(null);
  const [cbtPreviewShowSolution, setCbtPreviewShowSolution] = useState(false);
  const [showAllQuestionsDrawer, setShowAllQuestionsDrawer] = useState(false);

  // Workflow Decision State
  const [workflowAction, setWorkflowAction] = useState<"APPROVE" | "REQUEST_CHANGES" | "REWORK">("APPROVE");
  const [workflowNotes, setWorkflowNotes] = useState("");
  const [submittingWorkflow, setSubmittingWorkflow] = useState(false);

  // Edit Form State
  const activeTranslation =
    question.translations.find((t) => t.language.toUpperCase() === selectedLanguage.toUpperCase()) ||
    question.translations[0] || { id: "", language: "ENGLISH", statement: "", options: {}, correctOptionIds: [], solution: "" };

  const [editForm, setEditForm] = useState({
    statement: activeTranslation.statement || "",
    options: activeTranslation.options || { A: "", B: "", C: "", D: "" },
    correctOptionIds: Array.isArray(activeTranslation.correctOptionIds)
      ? activeTranslation.correctOptionIds
      : [String(activeTranslation.correctOptionIds || "A")],
    solution: activeTranslation.solution || "",
    subject: question.subject || "Biology",
    chapter: question.chapter || "",
    topic: question.topic || "",
    subTopic: question.subTopic || "",
    microConcept: question.microConcept || "",
    type: question.type || "SINGLE_CORRECT",
    difficulty: question.difficulty || "MODERATE",
    examLevel: question.examLevel || "NEET",
    imageUrl: question.imageUrl || "",
  });

  // Hierarchy dropdown helpers
  const [chaptersList, setChaptersList] = useState<any[]>([]);
  const [topicsList, setTopicsList] = useState<any[]>([]);

  useEffect(() => {
    // Load chapters for subject
    if (editForm.subject) {
      fetch(`/api/team/questions/academic-hierarchy?subject=${encodeURIComponent(editForm.subject)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data?.chapters) setChaptersList(d.data.chapters);
        })
        .catch(() => {});
    }
  }, [editForm.subject]);

  useEffect(() => {
    // Load topics for chapter
    if (editForm.subject && editForm.chapter) {
      fetch(
        `/api/team/questions/academic-hierarchy?subject=${encodeURIComponent(editForm.subject)}&chapter=${encodeURIComponent(editForm.chapter)}`
      )
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data?.topics) setTopicsList(d.data.topics);
        })
        .catch(() => {});
    }
  }, [editForm.subject, editForm.chapter]);

  // AI Audit Result Parser
  const auditResult: MultiDimensionalAuditResult | null = question.aiAuditResult as any;

  // Run AI Audit On Demand
  const handleRunAiAudit = async (force = false) => {
    setRunningAiAudit(true);
    try {
      const res = await fetch(`/api/team/questions/${question.id}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceReaudit: force }),
      });
      const data = await res.json();
      if (data.success && data.data?.result) {
        setQuestion((prev) => ({
          ...prev,
          aiVerified: data.data.result.overallScore >= 70,
          aiAuditStatus: data.data.result.decision,
          aiAuditScore: data.data.result.overallScore,
          aiAuditResult: data.data.result,
          aiAuditIssues: data.data.result.errors,
          aiAuditedAt: new Date(),
          needsReaudit: false,
        }));
        toast.success(data.data.cached ? "Loaded cached AI audit result" : "AI Audit successfully updated!");
      } else {
        toast.error(data.error?.message || "AI Audit failed");
      }
    } catch {
      toast.error("Network error executing AI Audit");
    } finally {
      setRunningAiAudit(false);
    }
  };

  // Accept AI Suggestion
  const handleAcceptAiSuggestion = async (field: string, value: any) => {
    try {
      const res = await fetch(`/api/team/questions/${question.id}/accept-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value, language: selectedLanguage }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Accepted AI recommendation for ${field}`);
        setQuestion(data.data.question);
        router.refresh();
      } else {
        toast.error(data.error?.message || "Failed to accept suggestion");
      }
    } catch {
      toast.error("Failed to accept AI suggestion");
    }
  };

  // Save Manual Edits
  const handleSaveManualEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/team/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          language: selectedLanguage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Question updated successfully! Marked for AI re-audit.");
        setIsEditing(false);
        setQuestion(data.data.question);
        router.refresh();
      } else {
        toast.error(data.error?.message || "Failed to update question");
      }
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSavingEdit(false);
    }
  };

  // Navigation Handlers
  const navigateTo = (targetId: string) => {
    const query = queryParamsString ? `?${queryParamsString}` : "";
    router.push(`/team/questions/${targetId}/review${query}`);
  };

  const handlePrev = () => {
    if (prevQuestionId) navigateTo(prevQuestionId);
  };

  const handleNext = () => {
    if (nextQuestionId) navigateTo(nextQuestionId);
  };

  // Keyboard Navigation: Alt + Left / Alt + Right / Alt + P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      if ((e.altKey || e.ctrlKey) && e.key === "ArrowLeft") {
        e.preventDefault();
        if (prevQuestionId) navigateTo(prevQuestionId);
      } else if ((e.altKey || e.ctrlKey) && e.key === "ArrowRight") {
        e.preventDefault();
        if (nextQuestionId) navigateTo(nextQuestionId);
      } else if ((e.altKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setShowCbtPreviewModal((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevQuestionId, nextQuestionId, queryParamsString]);

  // Submit Review Workflow Decision
  const handleWorkflowDecision = async (e?: React.FormEvent, autoAdvance = false) => {
    if (e) e.preventDefault();
    if (workflowAction !== "APPROVE" && !workflowNotes.trim()) {
      toast.error("Review comments are required when requesting changes or rework");
      return;
    }

    setSubmittingWorkflow(true);
    try {
      const stage = question.status === "REVIEW_2" ? "REVIEW_2" : "REVIEW_1";
      const status =
        workflowAction === "APPROVE" ? "APPROVED" : workflowAction === "REQUEST_CHANGES" ? "REJECTED" : "REWORK";

      const res = await fetch(`/api/team/questions/${question.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          action: workflowAction === "APPROVE" ? "APPROVE" : "REQUEST_CHANGES",
          status,
          notes: workflowNotes.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Workflow decision recorded: ${status}`);
        setQuestion((prev) => ({
          ...prev,
          status: stage === "REVIEW_1" && status === "APPROVED" ? "REVIEW_2" : stage === "REVIEW_2" && status === "APPROVED" ? "PUBLISHED" : "REJECTED",
        }));
        
        if (autoAdvance && nextQuestionId) {
          toast.info("Moving to next question in queue...");
          navigateTo(nextQuestionId);
        } else {
          router.refresh();
        }
      } else {
        toast.error(data.error?.message || "Failed to record decision");
      }
    } catch {
      toast.error("Network error during workflow submission");
    } finally {
      setSubmittingWorkflow(false);
    }
  };

  const canonicalCode = question.questionCode || `Q-${question.id.slice(0, 8)}`;

  // Find adjacent siblings for the carousel navigator (up to 3 before, current, up to 4 after)
  const currentSiblingIdx = siblingQuestions.findIndex((s) => s.id === question.id);
  const visibleSiblings = siblingQuestions.slice(
    Math.max(0, currentSiblingIdx - 3),
    Math.min(siblingQuestions.length, currentSiblingIdx + 5)
  );

  return (
    <div className="min-h-screen space-y-6 pb-28">
      {/* 1. TOP HEADER & BREADCRUMBS BAR WITH INTEGRATED NEXT / PREVIOUS / PREVIEW */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        {/* Row 1: Breadcrumbs & Next/Prev Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <Link
                href="/team/my-question-bank"
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>My Question Bank</span>
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <Link
                href="/team/questions"
                className="font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400"
              >
                Questions
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-800 dark:text-slate-200">{question.subject}</span>
              {question.chapter && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{question.chapter}</span>
                </>
              )}
              {question.topic && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">{question.topic}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-1">
              <span className="font-mono text-base font-extrabold text-blue-600 dark:text-blue-400 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 rounded-xl border border-blue-200 dark:border-blue-800">
                {canonicalCode}
              </span>

              {/* Status Badge */}
              <span
                className={`px-3 py-1 rounded-xl text-xs font-black tracking-wide border ${
                  question.status === "PUBLISHED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : question.status === "REVIEW_2"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                    : question.status === "REVIEW_1"
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : question.status === "REJECTED"
                    ? "bg-rose-50 text-rose-700 border-rose-300"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                {question.status}
              </span>

              {/* AI Verified Chip */}
              {question.aiVerified ? (
                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>AI Score: {question.aiAuditScore || 85}/100</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>AI Pending</span>
                </span>
              )}

              {question.needsReaudit && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  Needs Re-Audit
                </span>
              )}
            </div>
          </div>

          {/* Right Action Bar: Navigation Controls (Prev / Next), Preview CBT, Language Switcher & Edit Mode */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* Sequential Navigator Group */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                disabled={!prevQuestionId}
                onClick={handlePrev}
                title="Previous Question (Alt + ←)"
                className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4 text-blue-600" />
                <span>Prev</span>
              </button>

              <span className="px-3 py-1 text-xs font-black text-slate-700 dark:text-slate-300 border-x border-slate-200 dark:border-slate-700">
                {currentIndex} / {totalCount}
              </span>

              <button
                type="button"
                disabled={!nextQuestionId}
                onClick={handleNext}
                title="Next Question (Alt + →)"
                className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 text-blue-600" />
              </button>
            </div>

            {/* CBT Preview Button */}
            <button
              type="button"
              onClick={() => {
                setCbtPreviewLang(selectedLanguage === "HINDI" ? "HINDI" : "ENGLISH");
                setShowCbtPreviewModal(true);
              }}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
              title="Preview in Student CBT Test Player (Alt + P)"
            >
              <Eye className="w-4 h-4 text-cyan-200" />
              <span>Preview (CBT)</span>
            </button>

            {/* Language Switcher */}
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setSelectedLanguage("ENGLISH")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  selectedLanguage === "ENGLISH"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setSelectedLanguage("HINDI")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  selectedLanguage === "HINDI"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                हिंदी
              </button>
            </div>

            {/* Run AI Audit Button */}
            <button
              type="button"
              disabled={runningAiAudit}
              onClick={() => handleRunAiAudit(true)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              title="Run or refresh Multi-Dimensional AI Audit"
            >
              <Brain className={`w-4 h-4 ${runningAiAudit ? "animate-spin" : ""}`} />
              <span>{runningAiAudit ? "Auditing..." : "Run AI Audit"}</span>
            </button>

            {/* Edit Toggle */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 ${
                isEditing
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? "Close Editor" : "Edit Question"}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Sequential Questions Quick Strip / Carousel */}
        {siblingQuestions.length > 1 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold shrink-0">
              <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
              <span>Queue:</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1">
              {visibleSiblings.map((s, idx) => {
                const isCurrent = s.id === question.id;
                const sNumber = siblingQuestions.findIndex((item) => item.id === s.id) + 1;
                const code = s.questionCode || `Q${sNumber}`;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigateTo(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isCurrent
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-400/40"
                        : "bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700"
                    }`}
                    title={s.statementSnippet || `${s.subject} - ${s.chapter}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      s.status === "PUBLISHED"
                        ? "bg-emerald-400"
                        : s.status === "REVIEW_2"
                        ? "bg-indigo-400"
                        : s.status === "REVIEW_1"
                        ? "bg-amber-400"
                        : s.status === "REJECTED"
                        ? "bg-rose-400"
                        : "bg-slate-400"
                    }`} />
                    <span>#{sNumber} {code}</span>
                    {s.aiAuditScore && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        isCurrent ? "bg-blue-700 text-blue-100" : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      }`}>
                        {s.aiAuditScore}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowAllQuestionsDrawer((prev) => !prev)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition"
            >
              {showAllQuestionsDrawer ? "Hide All" : `View All (${totalCount})`}
            </button>
          </div>
        )}

        {/* Expanded All Questions Grid Drawer */}
        {showAllQuestionsDrawer && siblingQuestions.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
              <span>All {totalCount} Questions in Current Review Queue</span>
              <span className="text-[11px] text-slate-400">Click any question to switch</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-52 overflow-y-auto p-1">
              {siblingQuestions.map((s, idx) => {
                const isCurrent = s.id === question.id;
                const sNumber = idx + 1;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      navigateTo(s.id);
                      setShowAllQuestionsDrawer(false);
                    }}
                    className={`p-2 rounded-xl text-left text-xs transition border flex flex-col justify-between gap-1 cursor-pointer ${
                      isCurrent
                        ? "bg-blue-600 text-white border-blue-600 font-black shadow-sm"
                        : "bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold">Q#{sNumber}</span>
                      <span className={`w-2 h-2 rounded-full ${
                        s.status === "PUBLISHED" ? "bg-emerald-400" : s.status === "REVIEW_2" ? "bg-indigo-400" : "bg-amber-400"
                      }`} />
                    </div>
                    <span className="text-[10px] truncate opacity-80">{s.type}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. MAIN 2-COLUMN FULL REVIEW WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: COMPLETE QUESTION DISPLAY / MANUAL EDITOR (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {isEditing ? (
            /* MANUAL EDITING FORM (FULL AUTHORITY OVER QUESTION CONTENT) */
            <form
              onSubmit={handleSaveManualEdit}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  <span>Edit Question &amp; Solution ({selectedLanguage})</span>
                </h3>
                <span className="text-xs text-rose-600 font-medium">
                  Saving will flag question for AI re-audit
                </span>
              </div>

              {/* Statement */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Question Statement (Supports LaTeX $...$ and $$...$$) *
                </label>
                <textarea
                  rows={4}
                  required
                  value={editForm.statement}
                  onChange={(e) => setEditForm({ ...editForm, statement: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-sans"
                />
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Options &amp; Correct Answer Key (Click option letter to mark correct) *
                </label>
                {["A", "B", "C", "D", "E"].map((optKey) => {
                  const optVal =
                    typeof editForm.options === "object" ? editForm.options[optKey] || "" : "";
                  const isCorrect = editForm.correctOptionIds.includes(optKey);

                  return (
                    <div
                      key={optKey}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${
                        isCorrect
                          ? "bg-emerald-50/60 border-emerald-400 dark:bg-emerald-950/30"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (editForm.type === "MULTIPLE_CORRECT") {
                            setEditForm({
                              ...editForm,
                              correctOptionIds: isCorrect
                                ? editForm.correctOptionIds.filter((k) => k !== optKey)
                                : [...editForm.correctOptionIds, optKey],
                            });
                          } else {
                            setEditForm({
                              ...editForm,
                              correctOptionIds: [optKey],
                            });
                          }
                        }}
                        className={`w-8 h-8 rounded-lg text-xs font-black flex items-center justify-center cursor-pointer transition ${
                          isCorrect
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300"
                        }`}
                        title="Mark as correct answer"
                      >
                        {optKey}
                      </button>

                      <input
                        type="text"
                        value={optVal}
                        placeholder={`Option ${optKey} text`}
                        onChange={(e) => {
                          setEditForm({
                            ...editForm,
                            options: { ...editForm.options, [optKey]: e.target.value },
                          });
                        }}
                        className="flex-1 px-3 py-1.5 text-xs bg-transparent border-none focus:outline-none text-slate-900 dark:text-white"
                      />

                      {isCorrect && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                          Correct Key
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Solution */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Step-by-Step Solution &amp; Explanation *
                </label>
                <textarea
                  rows={4}
                  value={editForm.solution}
                  onChange={(e) => setEditForm({ ...editForm, solution: e.target.value })}
                  placeholder="Enter scientific derivation, formulas, and NCERT references..."
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Classification metadata fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Question Type
                  </label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={editForm.difficulty}
                    onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {DIFFICULTY_LEVELS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Exam Target
                  </label>
                  <select
                    value={editForm.examLevel}
                    onChange={(e) => setEditForm({ ...editForm, examLevel: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {EXAM_LEVELS.map((el) => (
                      <option key={el} value={el}>
                        {el}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingEdit ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          ) : (
            /* COMPLETE QUESTION STATEMENT & OPTIONS DISPLAY */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              {/* Question Statement */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-wider uppercase text-slate-400">
                    Question Statement
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Language: <b className="text-slate-800 dark:text-slate-200">{selectedLanguage}</b>
                  </span>
                </div>

                <div className="text-base sm:text-lg font-medium text-slate-900 dark:text-white leading-relaxed">
                  <FormulaText text={activeTranslation.statement || "No statement text provided"} />
                </div>

                {/* Question Image (if any) */}
                {question.imageUrl && (
                  <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 max-w-lg">
                    <img
                      src={question.imageUrl}
                      alt="Question Diagram"
                      className="rounded-xl object-contain max-h-72 w-full"
                    />
                  </div>
                )}
              </div>

              {/* Options List */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-black tracking-wider uppercase text-slate-400">
                  Options &amp; Correct Answer
                </span>

                <div className="grid grid-cols-1 gap-2.5">
                  {Object.entries((activeTranslation.options || {}) as Record<string, string>).map(
                    ([optKey, optVal]) => {
                      const isCorrect = Array.isArray(activeTranslation.correctOptionIds)
                        ? activeTranslation.correctOptionIds.includes(optKey)
                        : String(activeTranslation.correctOptionIds) === optKey;

                      return (
                        <div
                          key={optKey}
                          className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 ${
                            isCorrect
                              ? "bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700"
                              : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              isCorrect
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200"
                            }`}
                          >
                            {optKey}
                          </div>

                          <div className="flex-1 text-sm text-slate-900 dark:text-white pt-0.5">
                            <FormulaText text={optVal || `Option ${optKey}`} />
                          </div>

                          {isCorrect && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                              CORRECT KEY
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Solution / Explanation */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-xs font-black tracking-wider uppercase text-slate-400">
                  Solution &amp; Explanation
                </span>
                <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  <FormulaText text={activeTranslation.solution || "No detailed solution text provided"} />
                </div>
              </div>

              {/* Review / Rework Notes from History */}
              {(question.review1Notes || question.review2Notes || question.correctionNotes) && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="text-xs font-black tracking-wider uppercase text-slate-400">
                    Reviewer &amp; Admin Notes
                  </span>
                  {question.review1Notes && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 border border-amber-200">
                      <b>Stage 1 Reviewer Note:</b> {question.review1Notes}
                    </div>
                  )}
                  {question.review2Notes && (
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-xs text-indigo-900 dark:text-indigo-200 border border-indigo-200">
                      <b>Stage 2 Quality Note:</b> {question.review2Notes}
                    </div>
                  )}
                  {question.correctionNotes && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-900 dark:text-rose-200 border border-rose-200">
                      <b>Rework Instruction:</b> {question.correctionNotes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WORKFLOW DECISION & SIGN-OFF ACTIONS BAR */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Review Workflow Sign-off</span>
            </h3>

            <form onSubmit={handleWorkflowDecision} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setWorkflowAction("APPROVE")}
                  className={`p-3.5 rounded-2xl border text-left transition ${
                    workflowAction === "APPROVE"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="font-bold text-xs">
                    {question.status === "REVIEW_2" ? "Publish to Live" : "Approve to Stage 2"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {question.status === "REVIEW_2" ? "Marks ready for active exams" : "Moves to Quality review"}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkflowAction("REQUEST_CHANGES")}
                  className={`p-3.5 rounded-2xl border text-left transition ${
                    workflowAction === "REQUEST_CHANGES"
                      ? "bg-amber-50 border-amber-500 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="font-bold text-xs">Request Revision</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Author must fix identified issues</div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkflowAction("REWORK")}
                  className={`p-3.5 rounded-2xl border text-left transition ${
                    workflowAction === "REWORK"
                      ? "bg-rose-50 border-rose-500 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="font-bold text-xs">Reject / Rework</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Complete replacement required</div>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reviewer Feedback / Revision Notes {workflowAction !== "APPROVE" && "*"}
                </label>
                <input
                  type="text"
                  value={workflowNotes}
                  onChange={(e) => setWorkflowNotes(e.target.value)}
                  placeholder="e.g. Corrected Option B typo and verified NCERT page 182 reference."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingWorkflow}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingWorkflow ? "Submitting..." : "Submit Review Decision"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: MULTI-DIMENSIONAL AI AUDIT INSPECTOR & METADATA (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Tabs: AI Audit | Academic Metadata | History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => setActiveInspectorTab("ai_audit")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeInspectorTab === "ai_audit"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>AI Quality ({question.aiAuditScore || 85}%)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveInspectorTab("metadata")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeInspectorTab === "metadata"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Classification</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveInspectorTab("history")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeInspectorTab === "history"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit Logs</span>
              </button>
            </div>

            {/* TAB 1: MULTI-DIMENSIONAL AI AUDIT RESULTS */}
            {activeInspectorTab === "ai_audit" && (
              <div className="space-y-5">
                {/* Overall Score Gauge */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50/50 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-800/50 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      Overall AI Quality Score
                    </span>
                    <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {auditResult?.overallScore ?? question.aiAuditScore ?? 85}
                      <span className="text-sm font-bold text-slate-400">/100</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Confidence: {auditResult?.confidence ?? 92}% • {auditResult?.decision ?? "VERIFIED"}
                    </span>
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      disabled={runningAiAudit}
                      onClick={() => handleRunAiAudit(true)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${runningAiAudit ? "animate-spin" : ""}`} />
                      <span>Re-Audit</span>
                    </button>
                  </div>
                </div>

                {/* AI Exam Fit Recommendation */}
                {auditResult?.examLevelFit && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600 dark:text-slate-300">Exam-Level Fit:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          auditResult.examLevelFit.isAppropriateForCurrent
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {auditResult.examLevelFit.isAppropriateForCurrent
                          ? "MATCHES TARGET"
                          : "MISMATCH RECOMMENDED"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <b>Current:</b> {auditResult.examLevelFit.current} ➔ <b>Recommended:</b>{" "}
                      <span className="text-purple-600 font-bold">{auditResult.examLevelFit.recommended}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 italic">{auditResult.examLevelFit.reason}</p>

                    {auditResult.examLevelFit.current !== auditResult.examLevelFit.recommended && (
                      <button
                        type="button"
                        onClick={() =>
                          handleAcceptAiSuggestion("examLevel", auditResult?.examLevelFit?.recommended)
                        }
                        className="mt-1 px-3 py-1 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                      >
                        Accept {auditResult.examLevelFit.recommended} as Target
                      </button>
                    )}
                  </div>
                )}

                {/* Score Deductions with Explainable Reasons */}
                {auditResult?.deductions && auditResult.deductions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Score Deductions &amp; Reasons:</span>
                    </span>
                    <div className="space-y-1.5">
                      {auditResult.deductions.map((d, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 flex items-start justify-between gap-2"
                        >
                          <div>
                            <b>{d.dimension}:</b> {d.reason}
                          </div>
                          <span className="font-mono font-bold text-rose-700 shrink-0">
                            -{d.pointsDeducted}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specific Detected Issues & Errors */}
                {auditResult?.errors && auditResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Detected Quality Errors:</span>
                    </span>
                    <div className="space-y-2">
                      {auditResult.errors.map((err, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{err.parameter}</span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                err.severity === "CRITICAL"
                                  ? "bg-rose-100 text-rose-800"
                                  : err.severity === "HIGH"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {err.severity}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">{err.explanation}</p>
                          {err.suggestedCorrection && (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                              <b>Suggested Fix:</b> {err.suggestedCorrection}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Suggested Improvements (Traceable Non-Destructive Changes) */}
                {auditResult?.suggestions && auditResult.suggestions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>AI Suggested Corrections:</span>
                    </span>
                    <div className="space-y-2">
                      {auditResult.suggestions.map((sugg, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-bold text-purple-900 dark:text-purple-200">
                            <span className="capitalize">{sugg.field}</span>
                            <span className="text-[10px] text-purple-600 font-medium">
                              Confidence: {sugg.confidence}%
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 line-through">
                            <b>Original:</b> {sugg.original}
                          </div>
                          <div className="text-xs text-slate-900 dark:text-white font-medium">
                            <b>AI Proposed:</b> {sugg.suggested}
                          </div>
                          <div className="text-[11px] text-slate-500 italic">
                            <b>Reason:</b> {sugg.reason}
                          </div>
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAcceptAiSuggestion(sugg.field, sugg.suggested)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                            >
                              Accept Correction
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 20 Dimensions Breakdown Grid */}
                {auditResult?.dimensions && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      20 Quality Dimension Breakdown:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(auditResult.dimensions).map(([dim, score]) => (
                        <div
                          key={dim}
                          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]"
                        >
                          <span className="text-slate-600 dark:text-slate-400 capitalize truncate max-w-[120px]">
                            {dim.replace(/([A-Z])/g, " $1")}
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              score >= 85
                                ? "text-emerald-600"
                                : score >= 70
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                          >
                            {score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ACADEMIC CLASSIFICATION */}
            {activeInspectorTab === "metadata" && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div>
                    <span className="text-slate-400 block font-medium">Subject</span>
                    <b className="text-slate-800 dark:text-slate-200">{question.subject}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Chapter</span>
                    <b className="text-slate-800 dark:text-slate-200">{question.chapter || "N/A"}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Topic</span>
                    <b className="text-slate-800 dark:text-slate-200">{question.topic || "N/A"}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Sub-topic</span>
                    <b className="text-slate-800 dark:text-slate-200">{question.subTopic || "N/A"}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Micro Concept</span>
                    <b className="text-purple-600">{question.microConcept || "N/A"}</b>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div>
                    <span className="text-slate-400 block font-medium">Question Type</span>
                    <b className="text-slate-800 dark:text-slate-200">{question.type}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Difficulty Level</span>
                    <b className="text-slate-800 dark:text-slate-200">{question.difficulty}</b>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Target Exam Level</span>
                    <b className="text-blue-600">{question.examLevel || "NEET"}</b>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition text-center"
                >
                  Edit Academic Taxonomy
                </button>
              </div>
            )}

            {/* TAB 3: AUDIT HISTORY TIMELINE */}
            {activeInspectorTab === "history" && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  AI &amp; Review History Log:
                </span>
                {question.auditLogs && question.auditLogs.length > 0 ? (
                  <div className="space-y-2">
                    {question.auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{log.decision}</span>
                          <span className="font-mono text-purple-600">{log.score}/100</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Model: {log.aiModel} • {new Date(log.createdAt).toLocaleString()}
                        </p>
                        {log.errorStatus && (
                          <p className="text-[11px] text-rose-600">{log.errorStatus}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No historical audit logs recorded yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. STICKY BOTTOM ACTION & SEQUENTIAL NAVIGATION DOCK */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Previous Navigation */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              disabled={!prevQuestionId}
              onClick={handlePrev}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              title="Previous Question (Alt + ←)"
            >
              <ChevronLeft className="w-4 h-4 text-blue-600" />
              <span>Previous Question</span>
            </button>

            <span className="text-xs font-black text-slate-500 dark:text-slate-400 sm:hidden">
              {currentIndex} / {totalCount}
            </span>
          </div>

          {/* Center: Position Indicator & CBT Preview Button */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-xs font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
              Question {currentIndex} of {totalCount}
            </span>

            <button
              type="button"
              onClick={() => {
                setCbtPreviewLang(selectedLanguage === "HINDI" ? "HINDI" : "ENGLISH");
                setShowCbtPreviewModal(true);
              }}
              className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Preview CBT Player</span>
            </button>
          </div>

          {/* Right: Approve & Next / Next Question Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {nextQuestionId && (
              <button
                type="button"
                disabled={submittingWorkflow}
                onClick={() => handleWorkflowDecision(undefined, true)}
                className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title="Approve current question and advance immediately to next"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve &amp; Next</span>
              </button>
            )}

            <button
              type="button"
              disabled={!nextQuestionId}
              onClick={handleNext}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:border-transparent disabled:cursor-not-allowed font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
              title="Next Question (Alt + →)"
            >
              <span>Next Question</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. INTERACTIVE CBT STUDENT TEST PREVIEW MODAL */}
      {showCbtPreviewModal && (() => {
        const transEn = question.translations.find((t) => t.language === "ENGLISH");
        const transHi = question.translations.find((t) => t.language === "HINDI");
        const activeTrans = cbtPreviewLang === "HINDI" && transHi ? transHi : (transEn || question.translations[0]);
        const stmt = activeTrans?.statement || "";
        const optionsObj: Record<string, string> =
          typeof activeTrans?.options === "object" && activeTrans?.options !== null
            ? (activeTrans.options as Record<string, string>)
            : {};
        const correctOptionIds: string[] = Array.isArray(activeTrans?.correctOptionIds)
          ? activeTrans.correctOptionIds
          : [String(activeTrans?.correctOptionIds || "A")];
        const hasHi = Boolean(transHi);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
              {/* CBT Preview Title Bar */}
              <div className="px-6 py-4 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs shadow-xs">
                    Question {currentIndex} of {totalCount}
                  </span>

                  <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                    {canonicalCode}
                  </span>

                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {question.subject} {question.chapter ? `• ${question.chapter}` : ""}
                  </span>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {question.difficulty}
                  </span>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {question.type.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasHi && (
                    <button
                      type="button"
                      onClick={() => setCbtPreviewLang((prev) => (prev === "ENGLISH" ? "HINDI" : "ENGLISH"))}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      {cbtPreviewLang === "HINDI" ? "🌐 Switch to English" : "🌐 हिंदी में देखें"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowCbtPreviewModal(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* CBT Preview Body: Student Test Player Simulator */}
              <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white dark:bg-slate-900">
                {/* Statement Card */}
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1 border-b border-slate-200/60 dark:border-slate-700">
                    <span className="text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      Question Statement ({cbtPreviewLang})
                    </span>
                    {question.topic && <span>Topic: {question.topic}</span>}
                  </div>

                  <FormulaText
                    text={stmt || "No statement text available."}
                    className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed block"
                  />

                  {question.imageUrl && (
                    <div className="pt-2">
                      <img
                        src={question.imageUrl}
                        alt="Question Diagram"
                        className="max-h-72 max-w-full rounded-xl object-contain border border-slate-200 dark:border-slate-700 shadow-sm bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Multiple-Choice Options Grid */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                    Select Your Answer (Interactive Preview)
                  </span>

                  <div className="grid grid-cols-1 gap-2.5">
                    {["A", "B", "C", "D", "E"].map((key) => {
                      const optText = optionsObj[key];
                      if (!optText && !["A", "B", "C", "D"].includes(key)) return null;
                      if (!optText && !optionsObj[key] && !optionsObj["A"]) return null;

                      const isSelected = cbtPreviewSelectedOption === key;
                      const isCorrect = correctOptionIds.includes(key);

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCbtPreviewSelectedOption(key)}
                          className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20"
                              : "bg-slate-50/40 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200"
                            }`}
                          >
                            {key}
                          </div>

                          <div className="flex-1 text-sm text-slate-900 dark:text-white pt-0.5">
                            <FormulaText text={optText || `Option ${key}`} />
                          </div>

                          {cbtPreviewShowSolution && isCorrect && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                              CORRECT
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Solution Toggle Box */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCbtPreviewShowSolution((prev) => !prev)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{cbtPreviewShowSolution ? "Hide Solution & Answer Key" : "Reveal Solution & Answer Key"}</span>
                  </button>

                  {cbtPreviewShowSolution && (
                    <div className="mt-3 p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-2 animate-in fade-in">
                      <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Correct Answer Key: {correctOptionIds.join(", ")}</span>
                      </div>
                      <FormulaText
                        text={activeTrans?.solution || "No detailed step-by-step solution provided."}
                        className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed block"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* CBT Preview Footer: Sequential Navigation */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  disabled={!prevQuestionId}
                  onClick={() => {
                    handlePrev();
                    setCbtPreviewSelectedOption(null);
                    setCbtPreviewShowSolution(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCbtPreviewModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  Close Preview
                </button>

                <button
                  type="button"
                  disabled={!nextQuestionId}
                  onClick={() => {
                    handleNext();
                    setCbtPreviewSelectedOption(null);
                    setCbtPreviewShowSolution(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
