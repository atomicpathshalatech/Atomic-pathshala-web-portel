"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";
import {
  BLOOM_LEVELS,
  IMPORTANCE_LEVELS,
  SOLVE_TIMES,
  KEY_SKILLS,
  DIFFICULTIES,
  QUESTION_TYPE_OPTIONS,
} from "@/lib/questions/classification-options";
import {
  getMasterNcertChapters,
  getMasterNcertTopics,
} from "@/lib/academic/master-ncert-catalog";
import {
  StructuredSolution,
  createEmptyStructuredSolution,
  parseStructuredSolution,
  formatStructuredSolution,
  isEmptyStructuredSolution,
} from "@/lib/pyq/structured-solution";

interface QuestionTranslationData {
  id?: string;
  language: string;
  statement: string;
  options: Record<string, string>;
  correctOptionIds: string[];
  solution?: string | null;
}

interface QuestionReviewData {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  microConcept?: string | null;
  type: string;
  difficulty: string;
  imageUrl: string | null;
  referenceImageUrl?: string | null;
  solution: string | null;
  bloomLevel?: string | null;
  importance?: string | null;
  solveTime?: string | null;
  keySkill?: string | null;
  ncertBook?: string | null;
  ncertClass?: string | null;
  ncertChapter?: string | null;
  ncertPage?: string | null;
  ncertSection?: string | null;
  ncertLine?: string | null;
  tags?: string | null;
  pyqSource?: string | null;
  pyqExam: string | null;
  pyqYear: number | null;
  pyqMonth: string | null;
  pyqQuestionNumber: string | null;
  pyqVerificationStatus: string;
  pyqVerifiedAt: string | null;
  pyqVerifiedBy?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string } | null;
  translations: QuestionTranslationData[];
  pyqOccurrences: any[];
  pyqReviews: any[];
  pyqReviewHistories: any[];
}

interface ChecklistState {
  englishStatement: boolean;
  hindiTranslation: boolean;
  allOptions: boolean;
  correctAnswer: boolean;
  explanation: boolean;
  imagesDiagrams: boolean;
  chapterMapping: boolean;
  topic: boolean;
  subtopic: boolean;
  examNameYear: boolean;
}

const DEFAULT_CHECKLIST: ChecklistState = {
  englishStatement: false,
  hindiTranslation: false,
  allOptions: false,
  correctAnswer: false,
  explanation: false,
  imagesDiagrams: false,
  chapterMapping: false,
  topic: false,
  subtopic: false,
  examNameYear: false,
};

interface PyqQuestionReviewModalProps {
  questionId: string | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  currentUserId?: string;
}

export function PyqQuestionReviewModal({
  questionId,
  open,
  onClose,
  onRefresh,
}: PyqQuestionReviewModalProps) {
  const [data, setData] = useState<QuestionReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(questionId);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<"content" | "metadata" | "solution" | "ncert" | "history">("content");

  // Navigation
  const [nav, setNav] = useState<{
    currentIndex: number;
    totalInChapter: number;
    previousQuestionId: string | null;
    nextQuestionId: string | null;
  }>({
    currentIndex: 1,
    totalInChapter: 1,
    previousQuestionId: null,
    nextQuestionId: null,
  });

  // Edit Mode toggle
  const [isEditing, setIsEditing] = useState(false);

  // Form Fields - Academic Classification
  const [editSubject, setEditSubject] = useState("");
  const [editChapter, setEditChapter] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editSubTopic, setEditSubTopic] = useState("");
  const [editMicroConcept, setEditMicroConcept] = useState("");
  const [editBloomLevel, setEditBloomLevel] = useState("APPLY");
  const [editImportance, setEditImportance] = useState("HIGH_YIELD");
  const [editSolveTime, setEditSolveTime] = useState("MODERATE");
  const [editKeySkill, setEditKeySkill] = useState("CONCEPTUAL_UNDERSTANDING");

  // Form Fields - Exam Classification
  const [editPyqExam, setEditPyqExam] = useState("");
  const [editPyqYear, setEditPyqYear] = useState<number | string>("");
  const [editSession, setEditSession] = useState("");
  const [editShift, setEditShift] = useState("");
  const [editPaper, setEditPaper] = useState("");
  const [editPyqQuestionNumber, setEditPyqQuestionNumber] = useState("");
  const [editType, setEditType] = useState("SINGLE_CORRECT");
  const [editDifficulty, setEditDifficulty] = useState("MEDIUM");
  const [editTags, setEditTags] = useState("");

  // NCERT Syllabus Mapping
  const [editNcertClass, setEditNcertClass] = useState("11");
  const [editNcertChapter, setEditNcertChapter] = useState("");
  const [editNcertPage, setEditNcertPage] = useState("");
  const [editNcertSection, setEditNcertSection] = useState("");
  const [editNcertRelevance, setEditNcertRelevance] = useState("DIRECT"); // DIRECT | CONCEPT_BASED | BEYOND
  const [editSyllabusInclusion, setEditSyllabusInclusion] = useState("INCLUDED"); // INCLUDED | EXCLUDED | NEEDS_REVIEW

  // English & Hindi Content
  const [enStatement, setEnStatement] = useState("");
  const [enOptions, setEnOptions] = useState<Record<string, string>>({ A: "", B: "", C: "", D: "" });
  const [correctKey, setCorrectKey] = useState("A");
  const [editImageUrl, setEditImageUrl] = useState("");

  const [hiStatement, setHiStatement] = useState("");
  const [hiOptions, setHiOptions] = useState<Record<string, string>>({ A: "", B: "", C: "", D: "" });

  // Structured Solutions
  const [structuredEn, setStructuredEn] = useState<StructuredSolution>(createEmptyStructuredSolution());
  const [structuredHi, setStructuredHi] = useState<StructuredSolution>(createEmptyStructuredSolution());
  const [solutionLanguageTab, setSolutionLanguageTab] = useState<"en" | "hi" | "preview">("en");

  // AI Solution Generation State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiDerivedOption, setAiDerivedOption] = useState<string | null>(null);

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistState>(DEFAULT_CHECKLIST);

  // Flag & Comment Drawer
  const [showFlagDrawer, setShowFlagDrawer] = useState(false);
  const [flaggedIssue, setFlaggedIssue] = useState("ANSWER_KEY_WRONG");
  const [reviewComments, setReviewComments] = useState("");

  useEffect(() => {
    setActiveQuestionId(questionId);
  }, [questionId]);

  // Master NCERT Chapters based on subject
  const availableNcertChapters = useMemo(() => {
    if (!editSubject) return [];
    return getMasterNcertChapters(editSubject);
  }, [editSubject]);

  useEffect(() => {
    if (!open || !activeQuestionId) return;

    setLoading(true);
    fetch(`/api/team/pyq/questions/${activeQuestionId}/review`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const q = json.data.question as QuestionReviewData;
          setData(q);
          setNav(json.data.navigation || { currentIndex: 1, totalInChapter: 1, previousQuestionId: null, nextQuestionId: null });

          // Initialize form state
          setEditSubject(q.subject || "");
          setEditChapter(q.chapter || "");
          setEditTopic(q.topic || "");
          setEditSubTopic(q.subTopic || "");
          setEditMicroConcept(q.microConcept || "");
          setEditBloomLevel(q.bloomLevel || "APPLY");
          setEditImportance(q.importance || "HIGH_YIELD");
          setEditSolveTime(q.solveTime || "MODERATE");
          setEditKeySkill(q.keySkill || "CONCEPTUAL_UNDERSTANDING");

          setEditPyqExam(q.pyqExam || (q.pyqOccurrences?.[0]?.exam?.name ?? "NEET UG"));
          setEditPyqYear(q.pyqYear || (q.pyqOccurrences?.[0]?.year ?? ""));
          setEditSession(q.pyqOccurrences?.[0]?.session || "");
          setEditShift(q.pyqOccurrences?.[0]?.shift || "");
          setEditPaper(q.pyqOccurrences?.[0]?.paper || "");
          setEditPyqQuestionNumber(q.pyqQuestionNumber || (q.pyqOccurrences?.[0]?.questionNumber ?? ""));
          setEditType(q.type || "SINGLE_CORRECT");
          setEditDifficulty(q.difficulty || "MEDIUM");
          setEditTags(q.tags || "");

          setEditNcertClass(q.ncertClass || "11");
          setEditNcertChapter(q.ncertChapter || q.chapter || "");
          setEditNcertPage(q.ncertPage || "");
          setEditNcertSection(q.ncertSection || "");
          setEditImageUrl(q.imageUrl || "");

          const en = q.translations.find((t) => t.language.toUpperCase() === "ENGLISH");
          const hi = q.translations.find((t) => t.language.toUpperCase() === "HINDI");

          setEnStatement(en?.statement || "");
          setEnOptions(
            en?.options && typeof en.options === "object"
              ? (en.options as Record<string, string>)
              : { A: "", B: "", C: "", D: "" }
          );
          setCorrectKey(en?.correctOptionIds?.[0] || "A");

          setHiStatement(hi?.statement || "");
          setHiOptions(
            hi?.options && typeof hi.options === "object"
              ? (hi.options as Record<string, string>)
              : { A: "", B: "", C: "", D: "" }
          );

          // Parse structured solutions
          const initialEnSolution = en?.solution || q.solution || "";
          const initialHiSolution = hi?.solution || "";
          setStructuredEn(parseStructuredSolution(initialEnSolution));
          setStructuredHi(parseStructuredSolution(initialHiSolution));

          // Load previous checklist if available or reset
          const savedChecklist = q.pyqReviews?.[0]?.checklistData as ChecklistState | undefined;
          if (savedChecklist && typeof savedChecklist === "object") {
            setChecklist(savedChecklist);
          } else if (q.pyqVerificationStatus === "VERIFIED") {
            setChecklist({
              englishStatement: true,
              hindiTranslation: true,
              allOptions: true,
              correctAnswer: true,
              explanation: true,
              imagesDiagrams: true,
              chapterMapping: true,
              topic: true,
              subtopic: true,
              examNameYear: true,
            });
          } else {
            setChecklist(DEFAULT_CHECKLIST);
          }

          setIsEditing(false);
          setShowFlagDrawer(false);
          setReviewComments("");
          setAiWarning(null);
          setAiDerivedOption(null);
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, activeQuestionId]);

  if (!open) return null;

  const allChecksPassed = Object.values(checklist).every(Boolean);
  const checkedCount = Object.values(checklist).filter(Boolean).length;

  function toggleCheck(key: keyof ChecklistState) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function markAllChecks() {
    setChecklist({
      englishStatement: true,
      hindiTranslation: true,
      allOptions: true,
      correctAnswer: true,
      explanation: true,
      imagesDiagrams: true,
      chapterMapping: true,
      topic: true,
      subtopic: true,
      examNameYear: true,
    });
  }

  /**
   * AI Solution Generator Action
   */
  async function handleGenerateAiSolution(lang: "both" | "en" | "hi") {
    if (!activeQuestionId) return;
    setAiGenerating(true);
    setAiWarning(null);

    try {
      const res = await fetch(`/api/team/pyq/questions/${activeQuestionId}/ai-solution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          mode: "full",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate AI solution");
      }

      if (json.data?.solutionEn && (lang === "both" || lang === "en")) {
        setStructuredEn(json.data.solutionEn);
      }
      if (json.data?.solutionHi && (lang === "both" || lang === "hi")) {
        setStructuredHi(json.data.solutionHi);
      }

      setAiDerivedOption(json.data?.derivedOption || null);
      if (json.data?.mismatchWarning) {
        setAiWarning(json.data.mismatchWarning);
        toast.warning(json.data.mismatchWarning);
      } else {
        toast.success("AI pedagogical solution generated successfully!");
      }
      setIsEditing(true);
      setActiveTab("solution");
    } catch (err: any) {
      toast.error(err.message || "AI solution generation failed");
    } finally {
      setAiGenerating(false);
    }
  }

  /**
   * Submit Review Decision
   */
  async function handleDecision(action: "VERIFY" | "NEEDS_CORRECTION" | "SAVE_LATER") {
    if (!activeQuestionId) return;

    if (action === "VERIFY" && !allChecksPassed) {
      toast.error("All 10 verification checklist items must be verified before approving.");
      return;
    }

    if (action === "NEEDS_CORRECTION" && !reviewComments.trim()) {
      toast.error("Please provide comments explaining what needs correction.");
      return;
    }

    setSubmitting(true);
    try {
      const formattedEnSolution = formatStructuredSolution(structuredEn);
      const formattedHiSolution = formatStructuredSolution(structuredHi);

      const payload: any = {
        action,
        checklistData: checklist,
        reviewComments: reviewComments || undefined,
        flaggedIssue: action === "NEEDS_CORRECTION" ? flaggedIssue : undefined,
        correctionsNeeded: action === "NEEDS_CORRECTION" ? reviewComments : undefined,
      };

      // Always send editedQuestion if in editing mode or if solutions were modified
      if (isEditing || !isEmptyStructuredSolution(structuredEn)) {
        payload.editedQuestion = {
          subject: editSubject,
          chapter: editChapter,
          topic: editTopic,
          subTopic: editSubTopic,
          microConcept: editMicroConcept,
          bloomLevel: editBloomLevel,
          importance: editImportance,
          solveTime: editSolveTime,
          keySkill: editKeySkill,
          difficulty: editDifficulty,
          type: editType,
          imageUrl: editImageUrl || null,
          solution: formattedEnSolution,
          tags: editTags || null,
          ncertClass: editNcertClass || null,
          ncertChapter: editNcertChapter || null,
          ncertPage: editNcertPage || null,
          ncertSection: editNcertSection || null,
          pyqExam: editPyqExam || null,
          pyqYear: editPyqYear || null,
          session: editSession || null,
          shift: editShift || null,
          paper: editPaper || null,
          pyqQuestionNumber: editPyqQuestionNumber || null,
          english: {
            statement: enStatement,
            options: enOptions,
            correctOptionIds: [correctKey],
            solution: formattedEnSolution,
          },
          hindi: {
            statement: hiStatement,
            options: hiOptions,
            correctOptionIds: [correctKey],
            solution: formattedHiSolution,
          },
        };
      }

      const res = await fetch(`/api/team/pyq/questions/${activeQuestionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Action failed");
      }

      toast.success(json.data?.message || "Review decision recorded!");
      onRefresh();

      if (action === "VERIFY" && nav.nextQuestionId) {
        setActiveQuestionId(nav.nextQuestionId);
      } else {
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to record review decision");
    } finally {
      setSubmitting(false);
    }
  }

  const occ = data?.pyqOccurrences?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-7xl w-full h-[96vh] flex flex-col overflow-hidden">
        {/* TOP HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-black bg-blue-600 text-white px-3 py-1.5 rounded-xl shadow-xs">
              Q.{nav.currentIndex} / {nav.totalInChapter}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {occ ? `${occ.exam?.name || "PYQ"} ${occ.year || ""}` : data?.pyqExam ? `${data.pyqExam} ${data.pyqYear || ""}` : "PYQ Review"}
                </h3>
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  {data?.questionCode || data?.id.slice(-6)}
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    data?.pyqVerificationStatus === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : data?.pyqVerificationStatus === "NEEDS_CORRECTION"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : data?.pyqVerificationStatus === "IN_REVIEW"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  }`}
                >
                  {data?.pyqVerificationStatus || "UNVERIFIED"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-md">
                {data?.subject} • {data?.chapter} {data?.topic ? `• ${data.topic}` : ""}
              </p>
            </div>
          </div>

          {/* Navigation & Action Controls */}
          <div className="flex items-center gap-2">
            {/* Sibling Question Navigation */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => nav.previousQuestionId && setActiveQuestionId(nav.previousQuestionId)}
                disabled={!nav.previousQuestionId || loading || submitting}
                className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition flex items-center gap-1 text-xs font-bold"
                title="Previous Question"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                <span className="hidden sm:inline">Prev</span>
              </button>
              <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700" />
              <button
                type="button"
                onClick={() => nav.nextQuestionId && setActiveQuestionId(nav.nextQuestionId)}
                disabled={!nav.nextQuestionId || loading || submitting}
                className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition flex items-center gap-1 text-xs font-bold"
                title="Next Question"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>

            {/* AI Solution Quick Action */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                onClick={() => handleGenerateAiSolution("both")}
                disabled={aiGenerating || loading}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs hover:from-purple-700 hover:to-indigo-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {aiGenerating ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                )}
                <span>Generate AI Solution</span>
              </button>
            </div>

            {/* Toggle Edit Mode */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isEditing
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isEditing ? "visibility" : "edit"}
              </span>
              <span>{isEditing ? "Review Mode" : "Edit Question"}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE NAVIGATION TABS */}
        <div className="flex items-center gap-1 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-x-auto">
          {[
            { id: "content" as const, label: "Question & Options", icon: "quiz", badge: null },
            { id: "solution" as const, label: "Structured Solutions", icon: "psychology", badge: "6 Parts" },
            { id: "metadata" as const, label: "Academic & Exam Metadata", icon: "school", badge: null },
            { id: "ncert" as const, label: "NCERT & Syllabus Mapping", icon: "menu_book", badge: editNcertChapter ? "Mapped" : null },
            { id: "history" as const, label: "Revision History", icon: "history", badge: data?.pyqReviewHistories?.length ? String(data.pyqReviewHistories.length) : null },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${isActive ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* MAIN BODY AREA */}
        {loading || !data ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-blue-600 animate-spin">refresh</span>
              <p className="text-xs font-bold text-slate-400">Loading complete question data, metadata and solutions…</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* AI Warning or Answer Discrepancy Alert */}
            {aiWarning && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-xl shrink-0 mt-0.5">warning</span>
                <div className="text-xs">
                  <h4 className="font-black text-amber-900 dark:text-amber-200">AI Sanity Check Warning</h4>
                  <p className="text-amber-800 dark:text-amber-300 font-medium mt-0.5">{aiWarning}</p>
                </div>
              </div>
            )}

            {/* TAB 1: QUESTION & OPTIONS CONTENT */}
            {activeTab === "content" && (
              <div className="space-y-6">
                {/* Quick Info Bar */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Topic:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{editTopic || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Subtopic:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{editSubTopic || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Difficulty:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{editDifficulty}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Correct Key:</span>
                      {isEditing ? (
                        <select
                          value={correctKey}
                          onChange={(e) => setCorrectKey(e.target.value)}
                          className="px-2 py-0.5 rounded-lg border border-emerald-500 bg-emerald-50 dark:bg-emerald-950 font-mono font-bold text-emerald-800 dark:text-emerald-200 text-xs"
                        >
                          {["A", "B", "C", "D"].map((opt) => (
                            <option key={opt} value={opt}>Option ({opt})</option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded">
                          ({correctKey})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {data.assignedTo?.name ? (
                      <span>Assigned to <strong className="text-slate-700 dark:text-slate-300">{data.assignedTo.name}</strong></span>
                    ) : (
                      <span className="text-amber-600 font-semibold">Unassigned</span>
                    )}
                  </div>
                </div>

                {/* Bilingual Side-by-Side Question Statement & Options */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left Column: English Statement & Options */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                          English Statement &amp; Options
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Primary Statement</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Question Statement (LaTeX Supported)
                      </label>
                      {isEditing ? (
                        <textarea
                          value={enStatement}
                          onChange={(e) => setEnStatement(e.target.value)}
                          rows={5}
                          className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-blue-500 resize-y"
                        />
                      ) : (
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          <FormulaText text={enStatement || "(No statement)"} />
                        </div>
                      )}
                    </div>

                    {/* Figure / Diagram Image */}
                    {(editImageUrl || data.imageUrl || isEditing) && (
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Figure / Diagram Image URL
                        </label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editImageUrl}
                            onChange={(e) => setEditImageUrl(e.target.value)}
                            placeholder="Image URL or relative path (e.g. /uploads/pyq_diagram.png)"
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                          />
                        ) : null}
                        {(editImageUrl || data.imageUrl) && (
                          <div className="max-w-md rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={editImageUrl || data.imageUrl || ""}
                              alt="Question diagram"
                              className="w-full max-h-52 object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* English Options */}
                    <div className="space-y-2.5 pt-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Options (A, B, C, D)
                      </label>
                      {["A", "B", "C", "D"].map((opt) => {
                        const isAns = correctKey === opt;
                        return (
                          <div
                            key={opt}
                            className={`p-2.5 rounded-xl border text-xs transition ${
                              isAns
                                ? "bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"
                                : "bg-slate-50/40 border-slate-200/80 dark:bg-slate-950/40 dark:border-slate-800"
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <button
                                type="button"
                                onClick={() => isEditing && setCorrectKey(opt)}
                                className={`w-7 h-7 rounded-lg font-mono font-bold text-[11px] shrink-0 flex items-center justify-center transition cursor-pointer ${
                                  isAns
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                                }`}
                                title={isEditing ? `Click to mark (${opt}) as correct answer` : undefined}
                              >
                                ({opt})
                              </button>
                              <div className="flex-1">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={enOptions[opt] || ""}
                                    onChange={(e) =>
                                      setEnOptions({ ...enOptions, [opt]: e.target.value })
                                    }
                                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium"
                                  />
                                ) : (
                                  <div className="text-slate-800 dark:text-slate-200 font-medium pt-1">
                                    <FormulaText text={enOptions[opt] || "—"} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Hindi Statement & Options */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                          Hindi Statement &amp; Options (हिंदी अनुवाद)
                        </h4>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${hiStatement ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800"}`}>
                        {hiStatement ? "Hindi Available ✓" : "Hindi Missing ✕"}
                      </span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        प्रश्न कथन (Hindi Statement)
                      </label>
                      {isEditing ? (
                        <textarea
                          value={hiStatement}
                          onChange={(e) => setHiStatement(e.target.value)}
                          placeholder="हिंदी प्रश्न कथन दर्ज करें..."
                          rows={5}
                          className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-emerald-500 resize-y"
                        />
                      ) : (
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-relaxed bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          <FormulaText text={hiStatement || "(हिंदी अनुवाद उपलब्ध नहीं है)"} />
                        </div>
                      )}
                    </div>

                    {/* Hindi Options */}
                    <div className="space-y-2.5 pt-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        विकल्प (Options A, B, C, D)
                      </label>
                      {["A", "B", "C", "D"].map((opt) => {
                        const isAns = correctKey === opt;
                        return (
                          <div
                            key={opt}
                            className={`p-2.5 rounded-xl border text-xs transition ${
                              isAns
                                ? "bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"
                                : "bg-slate-50/40 border-slate-200/80 dark:bg-slate-950/40 dark:border-slate-800"
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`w-7 h-7 rounded-lg font-mono font-bold text-[11px] shrink-0 flex items-center justify-center ${
                                  isAns
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                ({opt})
                              </span>
                              <div className="flex-1">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={hiOptions[opt] || ""}
                                    onChange={(e) =>
                                      setHiOptions({ ...hiOptions, [opt]: e.target.value })
                                    }
                                    placeholder={`विकल्प (${opt}) हिंदी में...`}
                                    className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium"
                                  />
                                ) : (
                                  <div className="text-slate-800 dark:text-slate-200 font-medium pt-1">
                                    <FormulaText text={hiOptions[opt] || "—"} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: STRUCTURED 6-PART SOLUTION BUILDER */}
            {activeTab === "solution" && (
              <div className="space-y-6">
                {/* Solution Language / Preview Selector & AI Action Bar */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSolutionLanguageTab("en")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        solutionLanguageTab === "en"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <span>English Solution</span>
                      {!isEmptyStructuredSolution(structuredEn) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSolutionLanguageTab("hi")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        solutionLanguageTab === "hi"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <span>Hindi Solution (हिंदी हल)</span>
                      {!isEmptyStructuredSolution(structuredHi) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSolutionLanguageTab("preview")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        solutionLanguageTab === "preview"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">devices</span>
                      <span>Student Portal Live Preview</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {aiDerivedOption && (
                      <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        AI Derived: Option ({aiDerivedOption})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleGenerateAiSolution("both")}
                      disabled={aiGenerating}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                      {aiGenerating ? (
                        <span className="material-symbols-outlined text-[15px] animate-spin">refresh</span>
                      ) : (
                        <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                      )}
                      <span>{aiGenerating ? "Generating Solution…" : "Regenerate AI Solution"}</span>
                    </button>
                  </div>
                </div>

                {/* Sub-view: English or Hindi Structured Solution Editor */}
                {(solutionLanguageTab === "en" || solutionLanguageTab === "hi") && (
                  <div className="space-y-4">
                    {[
                      {
                        key: "concept" as const,
                        number: "1",
                        title: solutionLanguageTab === "en" ? "Concept & Core Theory" : "अवधारणा एवं सिद्धांत",
                        desc: solutionLanguageTab === "en" ? "Underlying scientific principles, theorems, and mechanisms." : "मूल वैज्ञानिक सिद्धांत, नियम व अवधारणाएं।",
                        placeholder: solutionLanguageTab === "en" ? "Explain the primary theoretical concept here..." : "यहाँ मुख्य वैज्ञानिक अवधारणा व सिद्धांत दर्ज करें...",
                      },
                      {
                        key: "formula" as const,
                        number: "2",
                        title: solutionLanguageTab === "en" ? "Required Formulas & Rules" : "आवश्यक सूत्र एवं नियम",
                        desc: solutionLanguageTab === "en" ? "Equations, standard laws, or reaction schemes in LaTeX KaTeX ($...$). " : "संबंधित गणितीय व रासायनिक सूत्र LaTeX KaTeX ($...$) में।",
                        placeholder: solutionLanguageTab === "en" ? "State relevant formulas, e.g. $F = ma$ or reaction equations..." : "प्रासंगिक सूत्र दर्ज करें, जैसे $v = u + at$...",
                      },
                      {
                        key: "stepByStep" as const,
                        number: "3",
                        title: solutionLanguageTab === "en" ? "Step-by-Step Solution" : "चरणबद्ध विस्तृत हल",
                        desc: solutionLanguageTab === "en" ? "Detailed logical working and algebraic steps leading to the answer." : "उत्तर तक पहुँचने की क्रमिक व तार्किक गणना।",
                        placeholder: solutionLanguageTab === "en" ? "Write the detailed step-by-step working here..." : "यहाँ चरणबद्ध हल दर्ज करें...",
                      },
                      {
                        key: "finalAnswer" as const,
                        number: "4",
                        title: solutionLanguageTab === "en" ? "Final Answer Conclusion" : "अंतिम उत्तर व्याख्या",
                        desc: solutionLanguageTab === "en" ? "Explicit conclusion confirming the correct option and key derivation." : "सही विकल्प की पुष्टि करने वाला संक्षिप्त निष्कर्ष।",
                        placeholder: solutionLanguageTab === "en" ? `Hence, Option (${correctKey}) is the correct answer because...` : `अतः विकल्प (${correctKey}) सही उत्तर है क्योंकि...`,
                      },
                      {
                        key: "optionExplanation" as const,
                        number: "5",
                        title: solutionLanguageTab === "en" ? "Option-wise Analysis" : "विकल्पवार विश्लेषण",
                        desc: solutionLanguageTab === "en" ? "Why the correct option is right, and why the other options are distractors." : "सही विकल्प क्यों सही है और अन्य विकल्प क्यों गलत हैं।",
                        placeholder: solutionLanguageTab === "en" ? "Option (A): ... \nOption (B): ... \nOption (C): ... \nOption (D): ..." : "विकल्प (A): ... \nविकल्प (B): ...",
                      },
                      {
                        key: "takeaway" as const,
                        number: "6",
                        title: solutionLanguageTab === "en" ? "Important Takeaway & Pitfalls" : "महत्वपूर्ण बिंदु व ट्रिक्स",
                        desc: solutionLanguageTab === "en" ? "High-yield memory tip, common student mistakes to avoid, or mnemonic." : "महत्वपूर्ण परीक्षा सुझाव, सामान्य गलतियाँ व याद रखने की ट्रिक।",
                        placeholder: solutionLanguageTab === "en" ? "Exam Tip / Common Trap: Students often confuse..." : "परीक्षा सुझाव / सामान्य भूल: विद्यार्थी अक्सर...",
                      },
                    ].map((sec) => {
                      const curVal = solutionLanguageTab === "en" ? structuredEn[sec.key] : structuredHi[sec.key];
                      return (
                        <div
                          key={sec.key}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2.5 transition"
                        >
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-mono font-black text-xs flex items-center justify-center">
                                {sec.number}
                              </span>
                              <div>
                                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                                  {sec.title}
                                </h4>
                                <p className="text-[10px] text-slate-400">{sec.desc}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                              {curVal.trim() ? "Completed ✓" : "Optional"}
                            </span>
                          </div>

                          {isEditing ? (
                            <textarea
                              value={curVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (solutionLanguageTab === "en") {
                                  setStructuredEn((prev) => ({ ...prev, [sec.key]: val }));
                                } else {
                                  setStructuredHi((prev) => ({ ...prev, [sec.key]: val }));
                                }
                              }}
                              placeholder={sec.placeholder}
                              rows={3}
                              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium focus:ring-2 focus:ring-blue-500 resize-y"
                            />
                          ) : (
                            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                              <FormulaText text={curVal || "(Not specified)"} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Sub-view: Student Portal Live Preview */}
                {solutionLanguageTab === "preview" && (
                  <div className="space-y-5 bg-slate-100 dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-purple-600 dark:text-purple-400 font-bold">
                          Live Test Portal Renderer
                        </span>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          Student-Facing Solution &amp; Answer Key Experience
                        </h4>
                      </div>
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-3 py-1 rounded-xl">
                        Official Key: Option ({correctKey})
                      </span>
                    </div>

                    {/* Question Statement */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question Statement</div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                        <FormulaText text={enStatement} />
                      </div>
                      {editImageUrl && (
                        <div className="my-3 max-w-sm rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={editImageUrl} alt="Question" className="w-full max-h-48 object-contain" />
                        </div>
                      )}
                    </div>

                    {/* Options list as rendered in test portal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {["A", "B", "C", "D"].map((opt) => {
                        const isAns = correctKey === opt;
                        return (
                          <div
                            key={opt}
                            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-start gap-3 ${
                              isAns
                                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg font-mono font-bold text-xs shrink-0 flex items-center justify-center ${
                                isAns ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {opt}
                            </span>
                            <div className="flex-1 pt-0.5">
                              <FormulaText text={enOptions[opt] || "—"} />
                            </div>
                            {isAns && (
                              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded">
                                Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Full Structured Solution Markdown Preview */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="material-symbols-outlined text-purple-600 text-lg">lightbulb</span>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                          Comprehensive Solution Explanation
                        </h4>
                      </div>
                      <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed space-y-3 prose dark:prose-invert max-w-none">
                        <FormulaText text={formatStructuredSolution(structuredEn) || "(No structured solution compiled yet)"} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ACADEMIC & EXAM METADATA */}
            {activeTab === "metadata" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Academic Classification */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="material-symbols-outlined text-blue-600 text-lg">school</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Academic Classification
                    </h4>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                        />
                      ) : (
                        <span className="font-bold text-slate-800 dark:text-slate-200">{editSubject || "—"}</span>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Chapter</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editChapter}
                          onChange={(e) => setEditChapter(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                        />
                      ) : (
                        <span className="font-bold text-slate-800 dark:text-slate-200">{editChapter || "—"}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Topic</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editTopic}
                            onChange={(e) => setEditTopic(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editTopic || "—"}</span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subtopic</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editSubTopic}
                            onChange={(e) => setEditSubTopic(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editSubTopic || "—"}</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Micro-concept</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editMicroConcept}
                          onChange={(e) => setEditMicroConcept(e.target.value)}
                          placeholder="e.g. Taxonomic Hierarchy in Plants"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                        />
                      ) : (
                        <span className="font-bold text-slate-800 dark:text-slate-200">{editMicroConcept || "—"}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bloom Level</label>
                        {isEditing ? (
                          <select
                            value={editBloomLevel}
                            onChange={(e) => setEditBloomLevel(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          >
                            {BLOOM_LEVELS.map((b) => (
                              <option key={b.value} value={b.value}>{b.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editBloomLevel}</span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Importance</label>
                        {isEditing ? (
                          <select
                            value={editImportance}
                            onChange={(e) => setEditImportance(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          >
                            {IMPORTANCE_LEVELS.map((imp) => (
                              <option key={imp.value} value={imp.value}>{imp.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editImportance}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimated Solve Time</label>
                        {isEditing ? (
                          <select
                            value={editSolveTime}
                            onChange={(e) => setEditSolveTime(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          >
                            {SOLVE_TIMES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editSolveTime}</span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Primary Skill</label>
                        {isEditing ? (
                          <select
                            value={editKeySkill}
                            onChange={(e) => setEditKeySkill(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          >
                            {KEY_SKILLS.map((k) => (
                              <option key={k.value} value={k.value}>{k.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editKeySkill}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exam Classification & Properties */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="material-symbols-outlined text-purple-600 text-lg">history_edu</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Exam Classification &amp; Attributes
                    </h4>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Exam Name</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editPyqExam}
                            onChange={(e) => setEditPyqExam(e.target.value)}
                            placeholder="e.g. NEET UG, AIPMT"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editPyqExam || "—"}</span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Year</label>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editPyqYear}
                            onChange={(e) => setEditPyqYear(e.target.value)}
                            placeholder="e.g. 2024"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editPyqYear || "—"}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Session / Phase</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editSession}
                            onChange={(e) => setEditSession(e.target.value)}
                            placeholder="Phase 1 / Re-NEET"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editSession || "—"}</span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Shift</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editShift}
                            onChange={(e) => setEditShift(e.target.value)}
                            placeholder="Morning / Shift 1"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editShift || "—"}</span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Question # in Paper</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editPyqQuestionNumber}
                            onChange={(e) => setEditPyqQuestionNumber(e.target.value)}
                            placeholder="e.g. Q.142"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          />
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editPyqQuestionNumber || "—"}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Question Type</label>
                        {isEditing ? (
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          >
                            {QUESTION_TYPE_OPTIONS.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editType}</span>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Difficulty</label>
                        {isEditing ? (
                          <select
                            value={editDifficulty}
                            onChange={(e) => setEditDifficulty(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          >
                            {DIFFICULTIES.map((d) => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-slate-800 dark:text-slate-200">{editDifficulty}</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tags (Comma-separated)</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder="e.g. Living World, Binomial Nomenclature, AIPMT 2012"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                        />
                      ) : (
                        <span className="font-bold text-slate-800 dark:text-slate-200">{editTags || "—"}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: NCERT & SYLLABUS MAPPING */}
            {activeTab === "ncert" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl">menu_book</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        Official NCERT Syllabus Alignment &amp; Textbook Citation
                      </h4>
                      <p className="text-xs text-slate-400">
                        Map directly to Class 11 / 12 NCERT textbooks for NEET 2026/2027 relevance tracking.
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-xl ${editSyllabusInclusion === "INCLUDED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800"}`}>
                    {editSyllabusInclusion === "INCLUDED" ? "In-Syllabus (NEET)" : "Out-of-Syllabus / Rationalized"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      NCERT Class
                    </label>
                    {isEditing ? (
                      <select
                        value={editNcertClass}
                        onChange={(e) => setEditNcertClass(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                      >
                        <option value="11">Class 11</option>
                        <option value="12">Class 12</option>
                      </select>
                    ) : (
                      <span className="font-bold text-slate-800 dark:text-slate-200">Class {editNcertClass}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      NCERT Chapter Mapping
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editNcertChapter}
                        onChange={(e) => setEditNcertChapter(e.target.value)}
                        list="ncert-chapters-list"
                        placeholder="e.g. The Living World"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                      />
                    ) : (
                      <span className="font-bold text-slate-800 dark:text-slate-200">{editNcertChapter || "—"}</span>
                    )}
                    <datalist id="ncert-chapters-list">
                      {availableNcertChapters.map((c) => (
                        <option key={c.id} value={c.title}>{c.displayTitle}</option>
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      NCERT Page Number
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editNcertPage}
                        onChange={(e) => setEditNcertPage(e.target.value)}
                        placeholder="e.g. Page 8-11"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold font-mono"
                      />
                    ) : (
                      <span className="font-bold text-slate-800 dark:text-slate-200">{editNcertPage || "—"}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Section / Paragraph Reference
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editNcertSection}
                        onChange={(e) => setEditNcertSection(e.target.value)}
                        placeholder="e.g. Section 1.3: Taxonomic Categories"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                      />
                    ) : (
                      <span className="font-bold text-slate-800 dark:text-slate-200">{editNcertSection || "—"}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      NCERT Relevance Level
                    </label>
                    {isEditing ? (
                      <select
                        value={editNcertRelevance}
                        onChange={(e) => setEditNcertRelevance(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                      >
                        <option value="DIRECT">Direct NCERT (Verbatim / Direct Line)</option>
                        <option value="CONCEPT_BASED">Concept-Based NCERT (Derived Application)</option>
                        <option value="BEYOND">Beyond NCERT (Advanced / Historical AIPMT)</option>
                      </select>
                    ) : (
                      <span className="font-bold text-slate-800 dark:text-slate-200">{editNcertRelevance}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Current Syllabus Status
                    </label>
                    {isEditing ? (
                      <select
                        value={editSyllabusInclusion}
                        onChange={(e) => setEditSyllabusInclusion(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                      >
                        <option value="INCLUDED">In-Syllabus (NMC / NEET 2026)</option>
                        <option value="EXCLUDED">Out-of-Syllabus (Rationalized NCERT)</option>
                        <option value="NEEDS_REVIEW">Needs Syllabus Committee Review</option>
                      </select>
                    ) : (
                      <span className="font-bold text-slate-800 dark:text-slate-200">{editSyllabusInclusion}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: REVISION HISTORY & AUDIT TRAIL */}
            {activeTab === "history" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">history</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Complete Verification Audit Trail ({data.pyqReviewHistories.length} entries)
                    </h4>
                  </div>
                </div>

                {data.pyqReviewHistories.length === 0 ? (
                  <p className="text-slate-400 text-xs py-4">No prior audit records found for this question.</p>
                ) : (
                  <div className="space-y-3">
                    {data.pyqReviewHistories.map((h: any) => (
                      <div
                        key={h.id}
                        className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-start justify-between gap-4 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                              {h.action}
                            </span>
                            {h.reviewer?.name && (
                              <span className="font-bold text-slate-700 dark:text-slate-300">by {h.reviewer.name}</span>
                            )}
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 font-medium">
                            {h.comments || "No comments recorded."}
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          {new Date(h.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MANDATORY 10-POINT VERIFICATION CHECKLIST (Always Visible at Bottom of Form) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">checklist</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                      Mandatory Verification Checklist
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${allChecksPassed ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800"}`}>
                        {checkedCount} / 10 Verified
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      All 10 checks must be confirmed by reviewer before approving into the Verified Questions collection.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={markAllChecks}
                  className="self-start sm:self-auto px-3 py-1 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 transition cursor-pointer"
                >
                  Mark All 10 Checked
                </button>
              </div>

              {/* Checklist Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                {[
                  { key: "englishStatement" as const, label: "1. English Statement Verified", desc: "Scientific phrasing & symbols" },
                  { key: "hindiTranslation" as const, label: "2. Hindi Translation Verified", desc: "Grammar & Hindi terminology" },
                  { key: "allOptions" as const, label: "3. All Options Verified", desc: "A, B, C, D complete & matched" },
                  { key: "correctAnswer" as const, label: "4. Correct Answer Key Verified", desc: "Official key match" },
                  { key: "explanation" as const, label: "5. Structured Solution Verified", desc: "6-part pedagogical logic" },
                  { key: "imagesDiagrams" as const, label: "6. Images & Diagrams Verified", desc: "Clarity, cropping & labels" },
                  { key: "chapterMapping" as const, label: "7. NCERT Mapping Verified", desc: "Class 11/12 chapter & page" },
                  { key: "topic" as const, label: "8. Topic Verified", desc: "Topic tag accurately classified" },
                  { key: "subtopic" as const, label: "9. Subtopic Verified", desc: "Micro-concept correctly assigned" },
                  { key: "examNameYear" as const, label: "10. Exam Name & Year Verified", desc: "Year, shift & paper verified" },
                ].map((item) => {
                  const isChecked = checklist[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleCheck(item.key)}
                      className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                        isChecked
                          ? "bg-emerald-50/80 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200"
                          : "bg-slate-50/40 border-slate-200 dark:bg-slate-950/40 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100/50"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                          isChecked
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-slate-400 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {isChecked && <span className="material-symbols-outlined text-[12px]">check</span>}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-[11px] block truncate">{item.label}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{item.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flag / Correction Comments Drawer */}
            {(showFlagDrawer || data.pyqVerificationStatus === "NEEDS_CORRECTION") && (
              <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-3xl p-5 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">flag</span>
                    Flag Issue / Correction Notes
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowFlagDrawer(false)}
                    className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    Hide
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                      Issue Category
                    </label>
                    <select
                      value={flaggedIssue}
                      onChange={(e) => setFlaggedIssue(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="ANSWER_KEY_WRONG">Incorrect Answer Key</option>
                      <option value="TRANSLATION_INCORRECT">Hindi Translation Error</option>
                      <option value="DIAGRAM_MISSING">Diagram / Figure Missing or Blurry</option>
                      <option value="EXPLANATION_WRONG">Explanation / Solution Error</option>
                      <option value="TOPIC_MISMATCH">Incorrect Chapter / Topic Tag</option>
                      <option value="QUESTION_AMBIGUOUS">Typo / Ambiguous Question</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                      Detailed Correction Instructions
                    </label>
                    <textarea
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      placeholder="Explain what needs to be fixed..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs resize-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL ACTION BAR (Sticky Footer) */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFlagDrawer(!showFlagDrawer)}
              className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 dark:text-rose-400 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">flag</span>
              <span>Needs Correction</span>
            </button>

            <button
              type="button"
              onClick={() => handleDecision("SAVE_LATER")}
              disabled={submitting}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">bookmark</span>
              <span>Save &amp; Continue Later</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Close
            </button>

            {showFlagDrawer ? (
              <button
                type="button"
                onClick={() => handleDecision("NEEDS_CORRECTION")}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {submitting && <span className="material-symbols-outlined text-sm animate-spin">refresh</span>}
                <span>Submit Flag / Correction</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleDecision("VERIFY")}
                disabled={submitting || !allChecksPassed}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition shadow-sm flex items-center gap-2 ${
                  allChecksPassed
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                }`}
                title={allChecksPassed ? "Confirm all 10 checks and mark verified" : "All 10 checks must be marked to approve"}
              >
                {submitting ? (
                  <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                )}
                <span>Approve &amp; Verify Question</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
