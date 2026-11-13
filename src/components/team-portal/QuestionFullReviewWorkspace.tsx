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
import { AddToCollectionButton, ChipCard, LanguageQuestionCard, fmtDateTime, humanize } from "@/components/team-portal/question-review/QuestionReviewParts";
import { BLOOM_LEVELS, DIFFICULTIES, IMPORTANCE_LEVELS, KEY_SKILLS, QUESTION_TYPE_OPTIONS, SOLVE_TIMES, labelOf } from "@/lib/questions/classification-options";

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
    category?: string | null;
    pyqSource?: string | null;
    pyqExam?: string | null;
    pyqYear?: number | null;
    pyqMonth?: string | null;
    pyqQuestionNumber?: string | null;
    ncertBook?: string | null;
    ncertClass?: string | null;
    ncertChapter?: string | null;
    ncertPage?: string | null;
    ncertSection?: string | null;
    usageCount?: number | null;
    bloomLevel?: string | null;
    importance?: string | null;
    solveTime?: string | null;
    keySkill?: string | null;
    qcStatus?: string | null;
    createdAt?: string | Date | null;
    editedAt?: string | Date | null;
    editedBy?: { name: string | null } | null;
    review1By?: { name: string | null } | null;
    review2By?: { name: string | null } | null;
    _count?: { sectionLinks?: number; dppLinks?: number; reports?: number; bookmarks?: number; answers?: number; collectionItems?: number };
    assets?: Array<{ id: string; type: string; publicUrl: string; originalName: string }>;
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
  /** Questions that look like this one (from Question QC → Duplicate questions). */
  similar?: Array<{ pairId: string; id: string; questionCode: string | null; questionStatus: string; category: string; score: number; sameAnswer: boolean | null; decision: string; note: string }>;
}

// Only the types the database accepts (enum QuestionType); the old list offered
// 18, and choosing one of the others made the save fail.
const QUESTION_TYPES = QUESTION_TYPE_OPTIONS.map((o) => ({ id: o.value, label: o.label }));

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

// enum Difficulty: EASY | MEDIUM | HARD (the old MODERATE / DIFFICULT / VERY_DIFFICULT could not be saved).
const DIFFICULTY_LEVELS = DIFFICULTIES.map((o) => o.value);

export function QuestionFullReviewWorkspace({
  question: initialQuestion,
  currentIndex = 1,
  totalCount = 1,
  prevQuestionId = null,
  nextQuestionId = null,
  siblingQuestions = [],
  queryParamsString = "",
  similar = [],
}: QuestionFullReviewProps) {
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const [selectedLanguage, setSelectedLanguage] = useState<"ENGLISH" | "HINDI" | "BILINGUAL">("ENGLISH");
  const [generatingTranslation, setGeneratingTranslation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [runningAiAudit, setRunningAiAudit] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<
    "ai_audit" | "bilingual" | "reference" | "similar" | "history" | "usage"
  >("ai_audit");

  const [usageData, setUsageData] = useState<any>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const englishT = question.translations?.find((t) => t.language.toUpperCase() === "ENGLISH");
  const hindiT = question.translations?.find((t) => t.language.toUpperCase() === "HINDI");

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
    (selectedLanguage === "HINDI" ? hindiT : englishT) ||
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
    bloomLevel: question.bloomLevel || "",
    importance: question.importance || "",
    solveTime: question.solveTime || "",
    keySkill: question.keySkill || "",
  });
  const [collectionCount, setCollectionCount] = useState<number>(initialQuestion._count?.collectionItems ?? 0);

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

  // Load question usage breakdown on demand
  useEffect(() => {
    if (activeInspectorTab === "usage" && !usageData) {
      setLoadingUsage(true);
      fetch(`/api/team/questions/${question.id}/usage`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data?.usage) {
            setUsageData(d.data.usage);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingUsage(false));
    }
  }, [activeInspectorTab, question.id, usageData]);

  // Synchronize editForm when selectedLanguage changes
  useEffect(() => {
    const targetLang = selectedLanguage === "BILINGUAL" ? "ENGLISH" : selectedLanguage;
    const t =
      question.translations.find((item) => item.language.toUpperCase() === targetLang.toUpperCase()) ||
      question.translations[0];
    if (t) {
      setEditForm((prev) => ({
        ...prev,
        statement: t.statement || "",
        options: t.options || { A: "", B: "", C: "", D: "" },
        correctOptionIds: Array.isArray(t.correctOptionIds)
          ? t.correctOptionIds
          : [String(t.correctOptionIds || "A")],
        solution: t.solution || "",
      }));
    }
  }, [selectedLanguage, question]);

  // Generate Missing Translation On Demand
  const handleGenerateTranslation = async (targetLang: "HINDI" | "ENGLISH") => {
    setGeneratingTranslation(true);
    try {
      const res = await fetch(`/api/team/questions/${question.id}/generate-translation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: targetLang }),
      });
      const data = await res.json();
      if (data.success && data.data?.question) {
        setQuestion((prev) => ({ ...prev, ...data.data.question }));
        toast.success(`Generated and saved ${targetLang} translation!`);
        router.refresh();
      } else {
        toast.error(data.error?.message || "Failed to generate translation");
      }
    } catch {
      toast.error("Network error while generating translation");
    } finally {
      setGeneratingTranslation(false);
    }
  };

  // Accept All AI Suggestions
  const handleAcceptAllAiSuggestions = async () => {
    try {
      const res = await fetch(`/api/team/questions/${question.id}/accept-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACCEPT_ALL" }),
      });
      const data = await res.json();
      if (data.success && data.data?.question) {
        toast.success("All AI recommendations accepted and applied!");
        setQuestion((prev) => ({ ...prev, ...data.data.question }));
        router.refresh();
      } else {
        toast.error(data.error?.message || "Failed to accept suggestions");
      }
    } catch {
      toast.error("Network error while accepting suggestions");
    }
  };

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
        setQuestion((prev) => ({ ...prev, ...data.data.question }));
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
        // The save answers with the question row only: keep counts, people and files we already have.
        setQuestion((prev) => ({ ...prev, ...data.data.question }));
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
  const handleWorkflowDecision = async (
    e?: React.FormEvent,
    autoAdvance = false,
    overrideAction?: "APPROVE" | "REQUEST_CHANGES" | "REWORK" | "VERIFY"
  ) => {
    if (e) e.preventDefault();
    const actionToUse = overrideAction || workflowAction;
    if (actionToUse !== "APPROVE" && actionToUse !== "VERIFY" && !workflowNotes.trim()) {
      toast.error("Review comments are required when requesting changes or rework");
      return;
    }

    setSubmittingWorkflow(true);
    try {
      const stage = actionToUse === "VERIFY" ? "VERIFY" : question.status === "REVIEW_2" ? "REVIEW_2" : "REVIEW_1";
      const status =
        actionToUse === "VERIFY" ? "VERIFIED" : actionToUse === "APPROVE" ? "APPROVED" : actionToUse === "REQUEST_CHANGES" ? "REJECTED" : "REWORK";

      const res = await fetch(`/api/team/questions/${question.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          action: actionToUse,
          status,
          notes: workflowNotes.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(actionToUse === "VERIFY" ? "Question officially verified and published to Atomic Question Bank!" : `Workflow decision recorded: ${status}`);
        setQuestion((prev) => ({
          ...prev,
          status: actionToUse === "VERIFY" ? "VERIFIED" : stage === "REVIEW_1" && status === "APPROVED" ? "REVIEW_2" : stage === "REVIEW_2" && status === "APPROVED" ? "VERIFIED" : "REJECTED",
          aiVerified: actionToUse === "VERIFY" ? true : prev.aiVerified,
          qcStatus: actionToUse === "VERIFY" ? "VERIFIED" : prev.qcStatus,
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
  const visibleSiblings = (siblingQuestions || []).slice(
    Math.max(0, currentSiblingIdx - 3),
    Math.min((siblingQuestions || []).length, currentSiblingIdx + 5)
  );

  return (
    <div className="min-h-screen space-y-5 pb-28">
      {/* 0. PREV · BACK TO THE LIST (position) · NEXT */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!prevQuestionId}
          onClick={handlePrev}
          title="Previous question (Alt + ←)"
          className="px-4 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-800 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50"
        >
          ← Prev
        </button>
        <Link
          href={`/team/questions${queryParamsString ? `?${queryParamsString}` : ""}`}
          className="min-w-0 truncate px-4 py-1.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90"
          title="Back to the question list"
        >
          ↩ Back to list: {[question.subject, question.chapter].filter(Boolean).join(" · ")} ({currentIndex} of {totalCount})
        </Link>
        <button
          type="button"
          disabled={!nextQuestionId}
          onClick={handleNext}
          title="Next question (Alt + →)"
          className="px-4 py-1.5 rounded-full bg-amber-200 hover:bg-amber-300 dark:bg-amber-900/60 text-sm font-semibold text-slate-900 dark:text-amber-100 disabled:opacity-40"
        >
          Next →
        </button>
      </div>

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

              {/* Type */}
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                {QUESTION_TYPES.find((t) => t.id === question.type)?.label ?? humanize(question.type)}
              </span>

              {/* Languages this question has */}
              {question.translations.map((t) => (
                <span key={t.id} className="px-2 py-1 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700">
                  {humanize(t.language)} · v{question.version}
                </span>
              ))}

              {/* AI audit — the real score only; nothing when it has not run */}
              {typeof question.aiAuditScore === "number" ? (
                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI {question.aiAuditScore}/100</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>AI audit not run</span>
                </span>
              )}

              {question.needsReaudit && question.aiAuditedAt && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                  ⚠ changed since AI review
                </span>
              )}

              {question.qcStatus && question.qcStatus !== "UNREVIEWED" && (
                <Link href="/team/qc" className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:underline">
                  QC: {humanize(question.qcStatus)}
                </Link>
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
              <button
                type="button"
                onClick={() => setSelectedLanguage("BILINGUAL")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  selectedLanguage === "BILINGUAL"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
                title="Bilingual Side-by-Side Synchronized View"
              >
                <Languages className="w-3 h-3" />
                <span>Bilingual</span>
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
        {(siblingQuestions || []).length > 1 && (
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
        {showAllQuestionsDrawer && (siblingQuestions || []).length > 0 && (
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
        <div className="lg:col-span-8 space-y-5">
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
                        {labelOf(DIFFICULTIES, d)}
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

              {/* Teaching classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(
                  [
                    ["bloomLevel", "Bloom's level", BLOOM_LEVELS],
                    ["importance", "Importance", IMPORTANCE_LEVELS],
                    ["solveTime", "Time", SOLVE_TIMES],
                    ["keySkill", "Key skill", KEY_SKILLS],
                  ] as const
                ).map(([field, label, options]) => (
                  <div key={field}>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{label}</label>
                    <select
                      value={editForm[field]}
                      onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      <option value="">— not set —</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
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
            /* TRUE BILINGUAL / ENGLISH / HINDI VIEW */
            <div className="space-y-4">
              {/* 1. ENGLISH ONLY VIEW */}
              {selectedLanguage === "ENGLISH" && (
                englishT ? (
                  <LanguageQuestionCard t={englishT} showLanguageTag={false} imageUrl={question.imageUrl} />
                ) : (
                  <div className="p-8 rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-center space-y-3">
                    <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">English Translation Not Available</h4>
                      <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto">
                        This question currently only has content in Hindi. You can generate an accurate NCERT English translation with formulas preserved using AI.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={generatingTranslation}
                      onClick={() => handleGenerateTranslation("ENGLISH")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${generatingTranslation ? "animate-spin" : ""}`} />
                      <span>{generatingTranslation ? "Generating English..." : "Generate English with AI"}</span>
                    </button>
                  </div>
                )
              )}

              {/* 2. HINDI ONLY VIEW */}
              {selectedLanguage === "HINDI" && (
                hindiT ? (
                  <LanguageQuestionCard t={hindiT} showLanguageTag={false} imageUrl={question.imageUrl} />
                ) : (
                  <div className="p-8 rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-center space-y-3">
                    <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Hindi Translation Not Available</h4>
                      <p className="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto">
                        This question currently only has content in English. You can generate an authentic NCERT Hindi translation with equations and formulas preserved using AI.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={generatingTranslation}
                      onClick={() => handleGenerateTranslation("HINDI")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${generatingTranslation ? "animate-spin" : ""}`} />
                      <span>{generatingTranslation ? "Generating Hindi..." : "Generate Hindi with AI"}</span>
                    </button>
                  </div>
                )
              )}

              {/* 3. BILINGUAL SIDE-BY-SIDE SYNCHRONIZED VIEW */}
              {selectedLanguage === "BILINGUAL" && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <Languages className="w-4 h-4 text-indigo-600" />
                      <span>Bilingual Quality Control View (English &amp; Hindi Synchronized)</span>
                    </span>
                    <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                      Dual-column aligned statement &amp; options
                    </span>
                  </div>

                  {/* Figure if available */}
                  {question.imageUrl && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 max-w-md mx-auto">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 text-center">Shared Question Figure</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={question.imageUrl} alt="Question figure" className="rounded-lg object-contain max-h-64 w-full" />
                    </div>
                  )}

                  {/* Dual Column Statements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* English Statement */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-xs font-black tracking-wider text-blue-600 dark:text-blue-400">ENGLISH STATEMENT</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-mono">EN</span>
                      </div>
                      {englishT ? (
                        <div className="text-sm leading-relaxed text-slate-900 dark:text-white">
                          <FormulaText text={englishT.statement || "(empty statement)"} />
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-dashed border-amber-300 text-center space-y-2">
                          <p className="text-xs text-amber-700">English translation missing</p>
                          <button
                            type="button"
                            disabled={generatingTranslation}
                            onClick={() => handleGenerateTranslation("ENGLISH")}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow transition"
                          >
                            + Generate English
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Hindi Statement */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-xs font-black tracking-wider text-purple-600 dark:text-purple-400">हिंदी प्रश्न (HINDI STATEMENT)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 font-mono">HI</span>
                      </div>
                      {hindiT ? (
                        <div className="text-sm leading-relaxed text-slate-900 dark:text-white">
                          <FormulaText text={hindiT.statement || "(empty statement)"} />
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-dashed border-amber-300 text-center space-y-2">
                          <p className="text-xs text-amber-700">Hindi translation missing</p>
                          <button
                            type="button"
                            disabled={generatingTranslation}
                            onClick={() => handleGenerateTranslation("HINDI")}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow transition"
                          >
                            + Generate Hindi
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dual Column Synchronized Options Matrix */}
                  {(englishT || hindiT) && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-xs font-black tracking-wider text-slate-700 dark:text-slate-300">SYNCHRONIZED OPTIONS MATRIX</span>
                        <span className="text-[11px] text-slate-500">Option A, B, C, D Across Languages</span>
                      </div>

                      <div className="space-y-2">
                        {["A", "B", "C", "D"].map((key, idx) => {
                          const enOpt = (englishT?.options as any)?.[key] || (Array.isArray(englishT?.options) ? (englishT?.options as any)[idx] : "");
                          const hiOpt = (hindiT?.options as any)?.[key] || (Array.isArray(hindiT?.options) ? (hindiT?.options as any)[idx] : "");
                          const isCorrectEn = Array.isArray(englishT?.correctOptionIds) ? englishT?.correctOptionIds.includes(key) : englishT?.correctOptionIds === key;
                          const isCorrectHi = Array.isArray(hindiT?.correctOptionIds) ? hindiT?.correctOptionIds.includes(key) : hindiT?.correctOptionIds === key;
                          const isCorrect = isCorrectEn || isCorrectHi;

                          return (
                            <div
                              key={key}
                              className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-2.5 rounded-xl border transition ${
                                isCorrect
                                  ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {/* Option EN */}
                              <div className="flex items-start gap-2 text-xs">
                                <span className={`font-bold tabular-nums px-2 py-0.5 rounded text-[11px] shrink-0 ${isCorrect ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}>
                                  ({key})
                                </span>
                                <div className="flex-1 min-w-0 pt-0.5 text-slate-800 dark:text-slate-200">
                                  <FormulaText text={enOpt || "—"} />
                                </div>
                                {isCorrectEn && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                              </div>

                              {/* Option HI */}
                              <div className="flex items-start gap-2 text-xs border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-1.5 md:pt-0 md:pl-3">
                                <span className={`font-bold tabular-nums px-2 py-0.5 rounded text-[11px] shrink-0 ${isCorrect ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}>
                                  ({key})
                                </span>
                                <div className="flex-1 min-w-0 pt-0.5 text-slate-800 dark:text-slate-200">
                                  <FormulaText text={hiOpt || "—"} />
                                </div>
                                {isCorrectHi && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dual Column Solutions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                      <span className="text-xs font-black tracking-wider text-slate-600 dark:text-slate-300">ENGLISH SOLUTION</span>
                      <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                        <FormulaText text={englishT?.solution || "None provided"} />
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                      <span className="text-xs font-black tracking-wider text-slate-600 dark:text-slate-300">हिंदी व्याख्या (HINDI SOLUTION)</span>
                      <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                        <FormulaText text={hindiT?.solution || "None provided"} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(question.review1Notes || question.review2Notes || question.correctionNotes) && (
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
                  <h3 className="text-xs font-black tracking-[0.14em] text-slate-600 dark:text-slate-300">REVIEWER &amp; ADMIN NOTES</h3>
                  {question.review1Notes && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 border border-amber-200">
                      <b>Stage 1 reviewer{question.review1By?.name ? ` (${question.review1By.name})` : ""}:</b> {question.review1Notes}
                    </div>
                  )}
                  {question.review2Notes && (
                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-xs text-indigo-900 dark:text-indigo-200 border border-indigo-200">
                      <b>Stage 2 quality{question.review2By?.name ? ` (${question.review2By.name})` : ""}:</b> {question.review2Notes}
                    </div>
                  )}
                  {question.correctionNotes && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-900 dark:text-rose-200 border border-rose-200">
                      <b>Rework instruction:</b> {question.correctionNotes}
                    </div>
                  )}
                </section>
              )}

              <ChipCard
                title="Classification"
                tone="highlight"
                action={
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-1.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit classification
                  </button>
                }
                groups={[
                  {
                    heading: "Academic",
                    chips: [
                      { label: "Class", value: question.ncertClass },
                      { label: "Subject", value: question.subject },
                      { label: "Chapter", value: question.chapter },
                      { label: "Topic", value: question.topic },
                      { label: "Subtopic", value: question.subTopic },
                      { label: "Micro concept", value: question.microConcept },
                    ],
                  },
                  {
                    heading: "Exam & difficulty",
                    chips: [
                      { label: "Difficulty", value: labelOf(DIFFICULTIES, question.difficulty) },
                      { label: "Importance", value: labelOf(IMPORTANCE_LEVELS, question.importance) },
                      { label: "Time", value: labelOf(SOLVE_TIMES, question.solveTime).replace(/ \(.*\)$/, "") },
                      { label: "Bloom's level", value: labelOf(BLOOM_LEVELS, question.bloomLevel) },
                      { label: "Key skill", value: labelOf(KEY_SKILLS, question.keySkill) },
                      { label: "Exam", value: question.examLevel ? question.examLevel.replace(/_/g, " ") : "" },
                      { label: "Category", value: question.category },
                      { label: "Tags", value: question.tags },
                    ],
                  },
                ]}
              />

              <ChipCard
                title="Source info"
                groups={[
                  {
                    chips: [
                      { label: "Code", value: canonicalCode },
                      { label: "PYQ", value: [question.pyqExam, question.pyqYear, question.pyqMonth].filter(Boolean).join(" ") },
                      { label: "PYQ no.", value: question.pyqQuestionNumber },
                      { label: "Source", value: question.pyqSource },
                      { label: "NCERT", value: [question.ncertBook, question.ncertChapter && `Ch ${question.ncertChapter}`, question.ncertPage && `p. ${question.ncertPage}`, question.ncertSection].filter(Boolean).join(" · ") },
                    ],
                  },
                ]}
              />

              <ChipCard
                title="Usage"
                groups={[
                  {
                    chips: [
                      { label: "Tests", value: String(question._count?.sectionLinks ?? 0) },
                      { label: "DPPs", value: String(question._count?.dppLinks ?? 0) },
                      { label: "Student answers", value: String(question._count?.answers ?? 0) },
                      { label: "Bookmarks", value: String(question._count?.bookmarks ?? 0) },
                      { label: "Collections", value: String(collectionCount) },
                      {
                        label: "Reports",
                        value: question._count?.reports ? (
                          <Link href={`/team/questions/reports?search=${encodeURIComponent(question.questionCode || question.id)}`} className="text-rose-600 font-semibold hover:underline">
                            {question._count.reports}
                          </Link>
                        ) : (
                          "0"
                        ),
                      },
                    ],
                  },
                ]}
              />

              <div className="px-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2 gap-y-1">
                {question.createdAt && <span>Created {fmtDateTime(question.createdAt)}{question.createdBy?.name ? ` by ${question.createdBy.name}` : ""}</span>}
                {question.editedAt && <span>· Updated {fmtDateTime(question.editedAt)}{question.editedBy?.name ? ` by ${question.editedBy.name}` : ""}</span>}
                <span>· Version {question.version}</span>
              </div>
              <div className="flex justify-end">
                <AddToCollectionButton questionId={question.id} onCountChange={setCollectionCount} />
              </div>
            </div>
          )}

          {/* WORKFLOW DECISION & SIGN-OFF ACTIONS BAR */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Review Workflow Sign-off</span>
              </h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                question.status === "VERIFIED" || question.status === "PUBLISHED"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}>
                {question.status} {question.aiVerified ? "• AI Verified" : ""}
              </span>
            </div>

            {/* Critical Errors Alert Banner */}
            {auditResult?.errors && auditResult.errors.some((e: any) => e.severity === "CRITICAL") && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <b>Critical Academic Flaws Flagged by AI:</b> There are{" "}
                  {(auditResult?.errors || []).filter((e: any) => e.severity === "CRITICAL").length} critical issue(s) detected. Please ensure formulas, option distractors, and answer keys are corrected before publishing.
                </div>
              </div>
            )}

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
                    {question.status === "REVIEW_2" ? "Stage 2 Approval" : "Approve to Stage 2"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {question.status === "REVIEW_2" ? "Advances quality approval" : "Moves to QC Director review"}
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
                  placeholder="e.g. Verified NCERT references, LaTeX derivation and bilingual options."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                <button
                  type="button"
                  disabled={submittingWorkflow}
                  onClick={() => handleWorkflowDecision(undefined, false, "VERIFY")}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  title="Directly verify and publish into the official Atomic Question Bank"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Verify &amp; Publish to Atomic Bank</span>
                </button>

                <button
                  type="submit"
                  disabled={submittingWorkflow}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingWorkflow ? "Submitting..." : "Submit Review Decision"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: MULTI-DIMENSIONAL AI AUDIT INSPECTOR & METADATA (5 cols) */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-4">
          {/* Tabs: AI Audit | Academic Metadata | History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-[0.14em] text-slate-600 dark:text-slate-300">VIEWER</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              {(
                [
                  { id: "ai_audit", label: typeof question.aiAuditScore === "number" ? `AI Audit (${question.aiAuditScore})` : "AI Audit" },
                  { id: "bilingual", label: "Bilingual" },
                  { id: "reference", label: "NCERT Ref" },
                  { id: "similar", label: `Similar (${(auditResult?.similarQuestions?.length || (similar || []).length) || 0})` },
                  { id: "history", label: "History" },
                  { id: "usage", label: "Usage" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveInspectorTab(tab.id)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition border truncate ${
                    activeInspectorTab === tab.id
                      ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: MULTI-DIMENSIONAL AI AUDIT RESULTS */}
            {activeInspectorTab === "ai_audit" && (
              <div className="space-y-4 text-xs">
                {/* Overall Score Gauge */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50/50 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-800/50 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      Overall AI Quality Score
                    </span>
                    <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {auditResult?.overallScore ?? question.aiAuditScore ?? "—"}
                      <span className="text-sm font-bold text-slate-400">/100</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {auditResult
                        ? `${typeof auditResult.confidence === "number" ? `Confidence ${auditResult.confidence}% • ` : ""}${auditResult.decision ?? ""}`
                        : "The AI audit has not run for this question yet."}
                    </span>
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      disabled={runningAiAudit}
                      onClick={() => handleRunAiAudit(true)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${runningAiAudit ? "animate-spin" : ""}`} />
                      <span>Re-Audit</span>
                    </button>
                  </div>
                </div>

                {/* Distractor & Independent Answer Verification */}
                {auditResult?.distractorAudit && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-700 dark:text-slate-300">Answer Key &amp; Distractor Audit</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        auditResult.distractorAudit.markedOptionMatchesSolved
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}>
                        {auditResult.distractorAudit.markedOptionMatchesSolved ? "ANSWER KEY VERIFIED" : "KEY MISMATCH FLAGGED"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">Independently Solved:</span>
                        <b className="text-emerald-600 text-sm">Option ({auditResult.distractorAudit.solvedAnswerKey})</b>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 block">All Options Distinct:</span>
                        <b className={auditResult.distractorAudit.allOptionsDistinct ? "text-emerald-600" : "text-rose-600"}>
                          {auditResult.distractorAudit.allOptionsDistinct ? "Yes (No duplicates)" : "Duplicate options detected"}
                        </b>
                      </div>
                    </div>
                  </div>
                )}

                {/* Multi-Exam Suitability Matrix */}
                {auditResult?.examSuitability && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 space-y-2.5">
                    <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-200">
                      <span>Multi-Exam Suitability Matrix</span>
                      <span className="text-[10px] text-indigo-600 font-medium">NEET · JEE · CUET · Boards</span>
                    </div>

                    <div className="space-y-1.5">
                      {[
                        { exam: "NEET UG", data: auditResult.examSuitability.neet },
                        { exam: "JEE Main", data: auditResult.examSuitability.jeeMain },
                        { exam: "JEE Advanced", data: auditResult.examSuitability.jeeAdvanced },
                        { exam: "CUET", data: auditResult.examSuitability.cuet },
                        { exam: "CBSE / State Boards", data: auditResult.examSuitability.board },
                      ].map(({ exam, data }) => (
                        <div
                          key={exam}
                          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 font-bold">
                              <span>{exam}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                                  data?.isFit
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {data?.isFit ? "SUITABLE" : "UNSUITABLE"}
                              </span>
                            </div>
                            {data?.notes && (
                              <p className="text-[10px] text-slate-500 truncate">{data.notes}</p>
                            )}
                          </div>
                          <span
                            className={`font-mono font-bold text-xs shrink-0 ${
                              (data?.score || 0) >= 80
                                ? "text-emerald-600"
                                : (data?.score || 0) >= 60
                                ? "text-amber-600"
                                : "text-slate-400"
                            }`}
                          >
                            {data?.score || 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detected Quality Errors */}
                {auditResult?.errors && auditResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Detected Quality Errors ({auditResult?.errors?.length || 0}):</span>
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

                {/* AI Suggested Improvements with One-Click Accept All */}
                {auditResult?.suggestions && auditResult.suggestions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                        <span>AI Suggested Corrections ({auditResult?.suggestions?.length || 0}):</span>
                      </span>

                      {(auditResult?.suggestions?.length || 0) > 1 && (
                        <button
                          type="button"
                          onClick={handleAcceptAllAiSuggestions}
                          className="px-2.5 py-1 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-xs transition cursor-pointer"
                        >
                          Accept All ({auditResult?.suggestions?.length || 0})
                        </button>
                      )}
                    </div>

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
                          <div className="text-[11px] text-slate-500 line-through truncate">
                            <b>Original:</b> {sugg.original}
                          </div>
                          <div className="text-xs text-slate-900 dark:text-white font-medium">
                            <b>AI Proposed:</b> {sugg.field === "translation" ? "NCERT Translation Draft" : sugg.suggested}
                          </div>
                          <div className="text-[11px] text-slate-500 italic">
                            <b>Reason:</b> {sugg.reason}
                          </div>
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAcceptAiSuggestion(sugg.field, sugg.suggested)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition cursor-pointer"
                            >
                              {sugg.field === "translation" ? "Apply Translation" : "Accept Correction"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step-by-Step KaTeX Derivation */}
                {auditResult?.stepByStepSolution && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      AI Verified Step-by-Step Derivation
                    </span>
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 leading-relaxed font-serif">
                      <FormulaText text={auditResult.stepByStepSolution.solutionText} />
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

            {/* TAB 2: BILINGUAL TRANSLATION FIDELITY & QC */}
            {activeInspectorTab === "bilingual" && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                      Translation Fidelity Score
                    </span>
                    <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {auditResult?.bilingualAudit?.translationFidelityScore ?? (englishT && hindiT ? 92 : 0)}
                      <span className="text-sm font-bold text-slate-400">/100</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {englishT && hindiT ? "Both English and Hindi verified" : "One language translation missing"}
                    </span>
                  </div>
                </div>

                {/* Negation Symmetry Check */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Negation &amp; Terminology Symmetry Check
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Ensures inverted negative keywords ("NOT", "INCORRECT", "EXCEPT", "नहीं", "गलत") are not introduced or dropped.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 block">English Negation:</span>
                      <b>{auditResult?.bilingualAudit?.negationSymmetry?.englishNegation ? "Detected (NOT/EXCEPT)" : "None"}</b>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 block">Hindi Negation:</span>
                      <b>{auditResult?.bilingualAudit?.negationSymmetry?.hindiNegation ? "Detected (नहीं/गलत)" : "None"}</b>
                    </div>
                  </div>
                </div>

                {/* Missing Translation Quick Generators */}
                {!englishT && (
                  <div className="p-3.5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-center space-y-2">
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-bold">English Translation is missing</p>
                    <button
                      type="button"
                      disabled={generatingTranslation}
                      onClick={() => handleGenerateTranslation("ENGLISH")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition"
                    >
                      {generatingTranslation ? "Generating..." : "Generate English Translation"}
                    </button>
                  </div>
                )}

                {!hindiT && (
                  <div className="p-3.5 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-center space-y-2">
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-bold">Hindi Translation is missing</p>
                    <button
                      type="button"
                      disabled={generatingTranslation}
                      onClick={() => handleGenerateTranslation("HINDI")}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition"
                    >
                      {generatingTranslation ? "Generating..." : "Generate Hindi Translation"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: REFERENCE & NCERT TEXTBOOK VERIFICATION */}
            {activeInspectorTab === "reference" && (
              <div className="space-y-4 text-xs">
                {/* Genuine NCERT Reference Verification */}
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
                    <span>NCERT Textbook Verification</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      auditResult?.ncertVerification?.status === "VERIFIED_IN_NCERT"
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}>
                      {auditResult?.ncertVerification?.status === "VERIFIED_IN_NCERT"
                        ? "VERIFIED IN SYLLABUS"
                        : "REFERENCE NOT CONFIRMED"}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-700 dark:text-slate-300">
                    <div><b>Book:</b> {auditResult?.ncertVerification?.book || question.ncertBook || `NCERT ${question.subject}`}</div>
                    <div><b>Chapter:</b> {auditResult?.ncertVerification?.chapter || question.ncertChapter || question.chapter || "Standard Syllabus"}</div>
                    <div><b>Topic/Section:</b> {auditResult?.ncertVerification?.topicOrSection || question.ncertSection || question.topic || "Core Concept"}</div>
                    {auditResult?.ncertVerification?.quoteOrExcerpt && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 text-[11px] italic">
                        "{auditResult.ncertVerification.quoteOrExcerpt}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Source Images */}
                <div className="space-y-3">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">Uploaded Source Assets</span>
                  {(() => {
                    const images = [
                      ...(question.referenceImageUrl ? [{ key: "ref", label: "Source page", url: question.referenceImageUrl }] : []),
                      ...(question.imageUrl ? [{ key: "img", label: "Question figure", url: question.imageUrl }] : []),
                      ...(question.assets ?? []).map((a) => ({ key: a.id, label: `${humanize(a.type)} — ${a.originalName}`, url: a.publicUrl })),
                    ];
                    if (images.length === 0) return <p className="p-6 text-center text-slate-400">No source image or file is attached to this question.</p>;
                    return images.map((img) => (
                      <div key={img.key} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex justify-between gap-2">
                          <span className="truncate">{img.label}</span>
                          <a href={img.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline shrink-0">Open</a>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.label} className="w-full object-contain max-h-80 bg-white" />
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* TAB 4: SIMILAR QUESTIONS & DUPLICATE DETECTION */}
            {activeInspectorTab === "similar" && (
              <div className="space-y-3 text-xs">
                {/* Real-time similarity matches from AI audit */}
                {auditResult?.similarQuestions && auditResult.similarQuestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-bold text-purple-700 dark:text-purple-300 block">
                      Real-Time Similar Questions ({auditResult.similarQuestions.length})
                    </span>
                    {auditResult.similarQuestions.map((sim, i) => (
                      <div key={sim.id || i} className="p-3 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/30 dark:bg-purple-950/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <Link href={`/team/questions/${sim.id}/review`} className="font-mono font-bold text-blue-600 hover:underline">
                            #{sim.questionCode || sim.id.slice(0, 8)}
                          </Link>
                          <span className="font-mono font-bold text-purple-700 dark:text-purple-300 text-[11px]">
                            {sim.similarityScore}% Match
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] line-clamp-2">
                          {sim.statementSnippet}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Legacy Duplicate Candidate Pairs */}
                {(similar || []).length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                      Logged Candidate Pairs ({(similar || []).length})
                    </span>
                    {(similar || []).map((d) => (
                      <div key={d.pairId} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/team/questions/${d.id}/review`} className="font-mono font-bold text-blue-600 hover:underline">
                            #{d.questionCode || d.id.slice(-8)}
                          </Link>
                          <span className="text-[10px] text-slate-500">{humanize(d.questionStatus)}</span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">{humanize(d.category)} — {d.note}</div>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          {d.sameAnswer === false && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">Answer keys differ</span>}
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600">{d.decision === "PENDING" ? "Not decided yet" : humanize(d.decision)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!auditResult?.similarQuestions?.length && (!similar || similar.length === 0) && (
                  <p className="p-6 text-center text-slate-400">
                    No duplicate or similar questions detected in the active bank.
                  </p>
                )}
              </div>
            )}

            {/* TAB 5: LIFECYCLE TIMELINE & VERSION HISTORY */}
            {activeInspectorTab === "history" && (
              <div className="space-y-4 text-xs">
                {/* Question Authors & Reviewers */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">Question Personnel</span>
                  {question.createdBy && (
                    <div className="text-slate-600 dark:text-slate-400">
                      <b>Created By:</b> {question.createdBy.name || question.createdBy.email} {question.createdAt && `(${fmtDateTime(question.createdAt)})`}
                    </div>
                  )}
                  {question.editedBy && (
                    <div className="text-slate-600 dark:text-slate-400">
                      <b>Last Edited By:</b> {question.editedBy.name} {question.editedAt && `(${fmtDateTime(question.editedAt)})`}
                    </div>
                  )}
                  {question.review1By && (
                    <div className="text-slate-600 dark:text-slate-400">
                      <b>Review 1 (QC Expert):</b> {question.review1By.name}
                    </div>
                  )}
                  {question.review2By && (
                    <div className="text-slate-600 dark:text-slate-400">
                      <b>Review 2 (QC Director):</b> {question.review2By.name}
                    </div>
                  )}
                </div>

                {/* Revision History from QuestionVersion */}
                {(question as any).versions && (question as any).versions.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                      Content Revision History ({(question as any).versions.length})
                    </span>
                    {(question as any).versions.map((ver: any) => (
                      <div key={ver.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span>Version {ver.versionNumber} ({humanize(ver.changeType)})</span>
                          <span className="text-[10px] text-slate-400">{fmtDateTime(ver.editedAt)}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">{ver.reason || "Updated"}</p>
                        {ver.editedBy?.name && (
                          <p className="text-[10px] text-slate-500">By {ver.editedBy.name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Audit Logs */}
                {question.auditLogs && question.auditLogs.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                      AI Audit Runs ({question.auditLogs.length})
                    </span>
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
                )}
              </div>
            )}

            {/* TAB 6: QUESTION USAGE & LINKAGE REPORT */}
            {activeInspectorTab === "usage" && (
              <div className="space-y-4 text-xs">
                {loadingUsage ? (
                  <div className="p-8 text-center text-slate-400">Loading live usage data...</div>
                ) : usageData ? (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 flex items-center justify-between">
                      <span className="font-bold">Total Platform Usages</span>
                      <span className="text-lg font-black font-mono">{usageData.totalUsages}</span>
                    </div>

                    {/* Tests */}
                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">
                        Linked Tests ({(usageData?.tests || []).length})
                      </span>
                      {(!usageData?.tests || usageData.tests.length === 0) ? (
                        <p className="text-slate-400 italic">Not used in any active tests yet.</p>
                      ) : (
                        (usageData.tests || []).map((t: any) => (
                          <div key={t.linkId} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{t.testTitle}</div>
                            <div className="text-[10px] text-slate-500">
                              Section: {t.sectionName || "Default"} · {t.examType} · {t.isPublished ? "Published" : "Draft"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* DPPs */}
                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">
                        Daily Practice Problems ({(usageData?.dpps || []).length})
                      </span>
                      {(!usageData?.dpps || usageData.dpps.length === 0) ? (
                        <p className="text-slate-400 italic">Not used in any DPPs yet.</p>
                      ) : (
                        (usageData.dpps || []).map((d: any) => (
                          <div key={d.linkId} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{d.title}</div>
                            <div className="text-[10px] text-slate-500">Chapter: {d.chapter} · DPP #{d.dppNumber}</div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Exercises */}
                    <div className="space-y-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">
                        Exercise Practice Sheets ({(usageData?.exercises || []).length})
                      </span>
                      {(!usageData?.exercises || usageData.exercises.length === 0) ? (
                        <p className="text-slate-400 italic">Not used in any practice sheets yet.</p>
                      ) : (
                        (usageData.exercises || []).map((e: any) => (
                          <div key={e.linkId} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{e.title}</div>
                            <div className="text-[10px] text-slate-500">{e.subject} · {e.chapter}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="p-6 text-center text-slate-400">Click to load question usage details.</p>
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
