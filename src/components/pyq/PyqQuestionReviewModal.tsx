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
} from "@/lib/academic/master-ncert-catalog";
import {
  StructuredSolution,
  createEmptyStructuredSolution,
  parseStructuredSolution,
  formatStructuredSolution,
  isEmptyStructuredSolution,
} from "@/lib/pyq/structured-solution";
import { StandardSolutionView } from "@/components/solutions/StandardSolutionView";

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
  solution: boolean;
  imagesDiagrams: boolean;
  // Legacy fields for backward compatibility:
  explanation?: boolean;
  chapterMapping?: boolean;
  topic?: boolean;
  subtopic?: boolean;
  examNameYear?: boolean;
}

const CANONICAL_CHECKLIST_KEYS: (keyof ChecklistState)[] = [
  "englishStatement",
  "hindiTranslation",
  "allOptions",
  "correctAnswer",
  "solution",
  "imagesDiagrams",
];

const DEFAULT_CHECKLIST: ChecklistState = {
  englishStatement: false,
  hindiTranslation: false,
  allOptions: false,
  correctAnswer: false,
  solution: false,
  imagesDiagrams: false,
};

interface FormSnapshot {
  enStatement: string;
  hiStatement: string;
  enOptions: Record<string, string>;
  hiOptions: Record<string, string>;
  correctKey: string;
  structuredEn: StructuredSolution;
  structuredHi: StructuredSolution;
  editSubject: string;
  editChapter: string;
  editTopic: string;
  editSubTopic: string;
  editMicroConcept: string;
  editBloomLevel: string;
  editImportance: string;
  editSolveTime: string;
  editKeySkill: string;
  editDifficulty: string;
  editType: string;
  editPyqExam: string;
  editPyqYear: number | string;
  editSession: string;
  editShift: string;
  editTags: string;
  editNcertClass: string;
  editNcertChapter: string;
  editNcertPage: string;
  editNcertSection: string;
  editNcertRelevance: string;
  editSyllabusInclusion: string;
}

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
  const [isFullscreen, setIsFullscreen] = useState(true);

  // Dedicated keyboard navigation for reviewers (Alt+N: Next, Alt+P: Prev)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      
      if ((e.altKey && e.key.toLowerCase() === "n") || (e.ctrlKey && e.key === "ArrowRight" && !isInput)) {
        e.preventDefault();
        if (nav.nextQuestionId && !loading && !submitting) {
          setActiveQuestionId(nav.nextQuestionId);
        }
      } else if ((e.altKey && e.key.toLowerCase() === "p") || (e.ctrlKey && e.key === "ArrowLeft" && !isInput)) {
        e.preventDefault();
        if (nav.previousQuestionId && !loading && !submitting) {
          setActiveQuestionId(nav.previousQuestionId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, nav.nextQuestionId, nav.previousQuestionId, loading, submitting]);

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

  // Form Fields - Exam Classification (Note: Question Number in Paper strictly excluded per Section 7)
  const [editPyqExam, setEditPyqExam] = useState("");
  const [editPyqYear, setEditPyqYear] = useState<number | string>("");
  const [editSession, setEditSession] = useState("");
  const [editShift, setEditShift] = useState("");
  const [editPaper, setEditPaper] = useState("");
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

  // AI Intelligence Engine State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [aiDerivedOption, setAiDerivedOption] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<{
    correlationId: string;
    modelUsed: string;
    latencyMs: number;
    estimatedCostInr: number;
    source: string;
  } | null>(null);
  const [suggestedCorrections, setSuggestedCorrections] = useState<{
    issues: string[];
    suggestedEnStatement: string | null;
    suggestedHiStatement: string | null;
    suggestedEnOptions: Record<string, string> | null;
    suggestedHiOptions: Record<string, string> | null;
  } | null>(null);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [previousSnapshot, setPreviousSnapshot] = useState<FormSnapshot | null>(null);

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
          setEditType(q.type || "SINGLE_CORRECT");
          setEditDifficulty(q.difficulty || "MEDIUM");
          setEditTags(q.tags || "");

          setEditNcertClass(q.ncertClass || "11");
          setEditNcertChapter(q.ncertChapter || q.chapter || "");
          setEditNcertPage(q.ncertPage || "");
          setEditNcertSection(q.ncertSection || "");
          setEditNcertRelevance("DIRECT");
          setEditSyllabusInclusion("INCLUDED");
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
          const savedChecklist = q.pyqReviews?.[0]?.checklistData as any;
          if (savedChecklist && typeof savedChecklist === "object") {
            setChecklist({
              englishStatement: Boolean(savedChecklist.englishStatement),
              hindiTranslation: Boolean(savedChecklist.hindiTranslation),
              allOptions: Boolean(savedChecklist.allOptions),
              correctAnswer: Boolean(savedChecklist.correctAnswer),
              solution: Boolean(savedChecklist.solution ?? savedChecklist.explanation),
              imagesDiagrams: Boolean(savedChecklist.imagesDiagrams),
              explanation: Boolean(savedChecklist.solution ?? savedChecklist.explanation),
            });
          } else if (q.pyqVerificationStatus === "VERIFIED") {
            setChecklist({
              englishStatement: true,
              hindiTranslation: true,
              allOptions: true,
              correctAnswer: true,
              solution: true,
              imagesDiagrams: true,
              explanation: true,
            });
          } else {
            setChecklist(DEFAULT_CHECKLIST);
          }

          setIsEditing(false);
          setShowFlagDrawer(false);
          setReviewComments("");
          setAiWarning(null);
          setAiDerivedOption(null);
          setAiMeta(null);
          setSuggestedCorrections(null);
          setSuggestedTags([]);
          setPreviousSnapshot(null);
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [open, activeQuestionId]);

  if (!open) return null;

  const allChecksPassed = CANONICAL_CHECKLIST_KEYS.every((k) => Boolean(checklist[k]));
  const checkedCount = CANONICAL_CHECKLIST_KEYS.filter((k) => Boolean(checklist[k])).length;

  function toggleCheck(key: keyof ChecklistState) {
    setChecklist((prev) => {
      const nextVal = !prev[key];
      return {
        ...prev,
        [key]: nextVal,
        ...(key === "solution" ? { explanation: nextVal } : {}),
        ...(key === "explanation" ? { solution: nextVal } : {}),
      };
    });
  }

  function markAllChecks() {
    setChecklist({
      englishStatement: true,
      hindiTranslation: true,
      allOptions: true,
      correctAnswer: true,
      solution: true,
      explanation: true,
      imagesDiagrams: true,
    });
  }

  /**
   * Take current state snapshot before applying AI changes
   */
  function captureCurrentSnapshot(): FormSnapshot {
    return {
      enStatement,
      hiStatement,
      enOptions,
      hiOptions,
      correctKey,
      structuredEn,
      structuredHi,
      editSubject,
      editChapter,
      editTopic,
      editSubTopic,
      editMicroConcept,
      editBloomLevel,
      editImportance,
      editSolveTime,
      editKeySkill,
      editDifficulty,
      editType,
      editPyqExam,
      editPyqYear,
      editSession,
      editShift,
      editTags,
      editNcertClass,
      editNcertChapter,
      editNcertPage,
      editNcertSection,
      editNcertRelevance,
      editSyllabusInclusion,
    };
  }

  /**
   * Restore previous form snapshot
   */
  function handleRestoreOriginal() {
    if (!previousSnapshot) return;
    setEnStatement(previousSnapshot.enStatement);
    setHiStatement(previousSnapshot.hiStatement);
    setEnOptions(previousSnapshot.enOptions);
    setHiOptions(previousSnapshot.hiOptions);
    setCorrectKey(previousSnapshot.correctKey);
    setStructuredEn(previousSnapshot.structuredEn);
    setStructuredHi(previousSnapshot.structuredHi);
    setEditSubject(previousSnapshot.editSubject);
    setEditChapter(previousSnapshot.editChapter);
    setEditTopic(previousSnapshot.editTopic);
    setEditSubTopic(previousSnapshot.editSubTopic);
    setEditMicroConcept(previousSnapshot.editMicroConcept);
    setEditBloomLevel(previousSnapshot.editBloomLevel);
    setEditImportance(previousSnapshot.editImportance);
    setEditSolveTime(previousSnapshot.editSolveTime);
    setEditKeySkill(previousSnapshot.editKeySkill);
    setEditDifficulty(previousSnapshot.editDifficulty);
    setEditType(previousSnapshot.editType);
    setEditPyqExam(previousSnapshot.editPyqExam);
    setEditPyqYear(previousSnapshot.editPyqYear);
    setEditSession(previousSnapshot.editSession);
    setEditShift(previousSnapshot.editShift);
    setEditTags(previousSnapshot.editTags);
    setEditNcertClass(previousSnapshot.editNcertClass);
    setEditNcertChapter(previousSnapshot.editNcertChapter);
    setEditNcertPage(previousSnapshot.editNcertPage);
    setEditNcertSection(previousSnapshot.editNcertSection);
    setEditNcertRelevance(previousSnapshot.editNcertRelevance);
    setEditSyllabusInclusion(previousSnapshot.editSyllabusInclusion);
    setAiMeta(null);
    setAiWarning(null);
    setSuggestedCorrections(null);
    setSuggestedTags([]);
    toast.info("Restored original question data.");
  }

  /**
   * ONE-CLICK UNIFIED AI INTELLIGENCE ENGINE
   * Single call populates all 5 tabs
   */
  async function handleOneClickAiIntelligence() {
    if (!activeQuestionId) return;
    setAiGenerating(true);
    setAiWarning(null);

    // Save snapshot before applying AI changes
    setPreviousSnapshot(captureCurrentSnapshot());

    try {
      const res = await fetch(`/api/team/pyq/questions/${activeQuestionId}/ai-solution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `AI processing failed with status ${res.status}`);
      }

      const intelligence = json.data;

      // 1. Auto-populate Structured Solutions (Tab 2)
      if (intelligence.structuredSolutions?.english) {
        setStructuredEn(intelligence.structuredSolutions.english);
      }
      if (intelligence.structuredSolutions?.hindi) {
        setStructuredHi(intelligence.structuredSolutions.hindi);
      }

      // 2. Auto-populate Academic & Exam Metadata (Tab 3)
      if (intelligence.academicMetadata) {
        const meta = intelligence.academicMetadata;
        if (meta.subject) setEditSubject(meta.subject);
        if (meta.class) setEditNcertClass(String(meta.class));
        if (meta.chapter) setEditChapter(meta.chapter);
        if (meta.topic) setEditTopic(meta.topic);
        if (meta.subtopic) setEditSubTopic(meta.subtopic);
        if (Array.isArray(meta.microConcepts)) setEditMicroConcept(meta.microConcepts.join(", "));
        if (meta.difficulty) setEditDifficulty(meta.difficulty);
        if (meta.questionType) setEditType(meta.questionType);
        if (meta.bloomLevel) setEditBloomLevel(meta.bloomLevel);
        if (meta.importance) setEditImportance(meta.importance);
        if (meta.keySkill) setEditKeySkill(meta.keySkill);
        if (meta.estimatedSolveTimeSeconds) {
          const s = meta.estimatedSolveTimeSeconds;
          setEditSolveTime(s <= 45 ? "QUICK" : s <= 90 ? "MODERATE" : "LENGTHY");
        }
      }

      if (intelligence.examMetadata) {
        const em = intelligence.examMetadata;
        if (em.exam) setEditPyqExam(em.exam);
        if (em.year) setEditPyqYear(em.year);
        if (em.shift) setEditShift(em.shift);
        if (em.session) setEditSession(em.session);
      }

      // 3. Auto-populate NCERT & Syllabus Mapping (Tab 4)
      if (intelligence.ncertMapping) {
        const nm = intelligence.ncertMapping;
        if (nm.class) setEditNcertClass(String(nm.class));
        if (nm.chapter) setEditNcertChapter(nm.chapter);
        if (nm.section) setEditNcertSection(nm.section);
        if (nm.pageNumber) setEditNcertPage(nm.pageNumber);
        if (nm.relevance) setEditNcertRelevance(nm.relevance);
        if (nm.syllabusStatus) setEditSyllabusInclusion(nm.syllabusStatus);
      }

      // 4. Auto-populate Question & Options (Tab 1)
      if (intelligence.questionReview) {
        const qr = intelligence.questionReview;
        // If Hindi translation was missing, auto-fill it
        if (!hiStatement && qr.suggestedHiStatement) {
          setHiStatement(qr.suggestedHiStatement);
        }
        if (Object.keys(hiOptions).length === 0 || !hiOptions.A) {
          if (qr.suggestedHiOptions && typeof qr.suggestedHiOptions === "object") {
            setHiOptions(qr.suggestedHiOptions);
          }
        }
        if (qr.issues && qr.issues.length > 0) {
          setSuggestedCorrections(qr);
        }
      }

      // 5. Tags preservation & suggestions
      if (intelligence.tags?.suggested && Array.isArray(intelligence.tags.suggested)) {
        setSuggestedTags(intelligence.tags.suggested);
      }

      // 6. Answer Key Verification & Sanity Check
      const derived = intelligence.answerVerification?.suggestedAnswer || null;
      setAiDerivedOption(derived);
      if (intelligence.answerVerification?.mismatchWarning) {
        setAiWarning(intelligence.answerVerification.mismatchWarning);
      } else {
        setAiWarning(null);
      }

      // Record performance metadata
      if (intelligence.performance) {
        setAiMeta(intelligence.performance);
      }

      setIsEditing(true);
      toast.success(
        `One-Click AI Question Intelligence Engine completed! (${intelligence.performance?.latencyMs || 0}ms)`
      );
    } catch (err: any) {
      console.error("[OneClickAI Error]", err);
      toast.error(err.message || "Something went wrong during AI analysis. Please try again.");
    } finally {
      setAiGenerating(false);
    }
  }

  function applySuggestedCorrections() {
    if (!suggestedCorrections) return;
    if (suggestedCorrections.suggestedEnStatement) setEnStatement(suggestedCorrections.suggestedEnStatement);
    if (suggestedCorrections.suggestedHiStatement) setHiStatement(suggestedCorrections.suggestedHiStatement);
    if (suggestedCorrections.suggestedEnOptions) setEnOptions(suggestedCorrections.suggestedEnOptions);
    if (suggestedCorrections.suggestedHiOptions) setHiOptions(suggestedCorrections.suggestedHiOptions);
    toast.success("Applied AI suggested text corrections.");
    setSuggestedCorrections(null);
  }

  function addSuggestedTag(tag: string) {
    const existing = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    if (!existing.includes(tag)) {
      const updated = [...existing, tag].join(", ");
      setEditTags(updated);
      setSuggestedTags((prev) => prev.filter((t) => t !== tag));
      toast.success(`Tag "${tag}" added.`);
    }
  }

  /**
   * Submit Review Decision
   */
  async function handleDecision(action: "VERIFY" | "NEEDS_CORRECTION" | "SAVE_LATER") {
    if (!activeQuestionId) return;

    if (action === "VERIFY" && !allChecksPassed) {
      toast.error("All 6 verification checklist items must be verified before approving.");
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
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? "p-0" : "p-2 sm:p-4"} bg-slate-900/85 backdrop-blur-xs animate-in fade-in duration-150`}>
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${isFullscreen ? "w-screen h-screen rounded-none" : "rounded-3xl shadow-2xl max-w-7xl w-full h-[96vh]"} flex flex-col overflow-hidden`}>
        {/* TOP HEADER */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80">
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

            {/* ONE-CLICK AI INTELLIGENCE BUTTON */}
            <button
              type="button"
              onClick={handleOneClickAiIntelligence}
              disabled={aiGenerating || loading}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs hover:from-purple-700 hover:to-indigo-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="One-click AI intelligence: Complete Academic QC, Bilingual Solutions, and NCERT Mapping in 1 call"
            >
              {aiGenerating ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              )}
              <span>{aiGenerating ? "Analyzing Question…" : "Generate AI Solution"}</span>
            </button>

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

            {/* Fullscreen Workspace Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
              title={isFullscreen ? "Restore Window Size" : "Full Window Workspace"}
            >
              <span className="material-symbols-outlined text-[19px]">
                {isFullscreen ? "fullscreen_exit" : "fullscreen"}
              </span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* AI INTELLIGENCE APPLIED TOP BANNER */}
        {aiMeta && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-b border-indigo-200 dark:border-indigo-800/60 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">bolt</span>
                <span>{aiMeta.source === "GEMINI_AI" ? "AI Intelligence Engine" : "Academic Synthesizer"}</span>
              </span>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                All 5 Tabs Auto-Populated
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                • {aiMeta.latencyMs}ms • ₹{aiMeta.estimatedCostInr} • Ref: {aiMeta.correlationId.slice(-7)}
              </span>

              {/* Answer Key Match Status */}
              {aiDerivedOption && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 font-mono ${
                    aiDerivedOption === correctKey
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  <span className="material-symbols-outlined text-[12px]">
                    {aiDerivedOption === correctKey ? "verified" : "warning"}
                  </span>
                  <span>AI Key: Option ({aiDerivedOption}) {aiDerivedOption === correctKey ? "✓ Verified Match" : "✕ Mismatch"}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAiMeta(null);
                  toast.success("AI suggestions confirmed for inspection.");
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
              >
                Accept All Suggestions
              </button>
              {previousSnapshot && (
                <button
                  type="button"
                  onClick={handleRestoreOriginal}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  Restore Previous State
                </button>
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE NAVIGATION TABS */}
        <div className="flex items-center gap-1 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-x-auto">
          {[
            { id: "content" as const, label: "Question & Options", icon: "quiz", badge: suggestedCorrections ? "Suggestions" : null },
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
                <div className="text-xs flex-1">
                  <h4 className="font-black text-amber-900 dark:text-amber-200">POTENTIAL ANSWER KEY MISMATCH — HUMAN REVIEW REQUIRED</h4>
                  <p className="text-amber-800 dark:text-amber-300 font-medium mt-0.5">{aiWarning}</p>
                </div>
              </div>
            )}

            {/* TAB 1: QUESTION & OPTIONS CONTENT */}
            {activeTab === "content" && (
              <div className="space-y-6">
                {/* Suggested Corrections Alert Banner if Detected */}
                {suggestedCorrections && (
                  <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-600">spellcheck</span>
                      <div>
                        <span className="font-bold text-blue-900 dark:text-blue-200 block">AI Detected Text or Formatting Improvements</span>
                        <span className="text-[11px] text-blue-700 dark:text-blue-300">
                          {suggestedCorrections.issues.join(", ") || "Standardized scientific notation and LaTeX formatting"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={applySuggestedCorrections}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition cursor-pointer text-xs"
                    >
                      Apply Suggested Text
                    </button>
                  </div>
                )}

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
                      onClick={handleOneClickAiIntelligence}
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

                {/* Sub-view: English or Hindi Structured Solution Editor (3 Clean Sections) */}
                {(solutionLanguageTab === "en" || solutionLanguageTab === "hi") && (
                  <div className="space-y-4">
                    {[
                      {
                        key: "correctAnswer" as const,
                        number: "1",
                        title: solutionLanguageTab === "en" ? "1. Correct Answer" : "1. सही उत्तर",
                        desc: solutionLanguageTab === "en" ? "Displayed at the very beginning (e.g. Option B)." : "शुरुआत में प्रदर्शित सही उत्तर (उदा. विकल्प B)।",
                        placeholder: solutionLanguageTab === "en" ? "Option B" : "विकल्प B",
                        rows: 1,
                      },
                      {
                        key: "concept" as const,
                        number: "2",
                        title: solutionLanguageTab === "en" ? "2. Concept Used" : "2. प्रयुक्त अवधारणा",
                        desc: solutionLanguageTab === "en" ? "Concise governing principle, law, formula, or NCERT rule." : "संक्षिप्त मूल वैज्ञानिक सिद्धांत, नियम, सूत्र अथवा NCERT अवधारणा।",
                        placeholder: solutionLanguageTab === "en" ? "Explain primary concept/formula here..." : "यहाँ मुख्य अवधारणा/सूत्र दर्ज करें...",
                        rows: 3,
                      },
                      {
                        key: "solution" as const,
                        number: "3",
                        title: solutionLanguageTab === "en" ? "3. Step-by-Step Solution" : "3. चरण-दर-चरण हल",
                        desc: solutionLanguageTab === "en" ? "Complete, logically connected steps with ~1 line visual spacing between steps." : "प्रत्यक्ष एवं संपूर्ण हल, चरणों के बीच दृश्य रिक्त स्थान सहित।",
                        placeholder: solutionLanguageTab === "en" ? "Step 1 : ...\n\nStep 2 : ..." : "चरण 1 : ...\n\nचरण 2 : ...",
                        rows: 6,
                      },
                      {
                        key: "finalAnswer" as const,
                        number: "4",
                        title: solutionLanguageTab === "en" ? "4. Final Answer" : "4. अंतिम उत्तर",
                        desc: solutionLanguageTab === "en" ? "Final numerical value + unit / chemical product / biological conclusion + option." : "अंतिम मान, इकाई, उत्पाद, निष्कर्ष एवं विकल्प।",
                        placeholder: solutionLanguageTab === "en" ? "3.2 m/s — Option B" : "3.2 m/s — विकल्प B",
                        rows: 2,
                      },
                    ].map((sec) => {
                      const curVal = ((solutionLanguageTab === "en" ? structuredEn[sec.key] : structuredHi[sec.key]) || "") as string;
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
                              {curVal.trim() ? "Completed ✓" : "Required"}
                            </span>
                          </div>

                          {isEditing ? (
                            <textarea
                              value={curVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (solutionLanguageTab === "en") {
                                  setStructuredEn((prev) => ({
                                    ...prev,
                                    [sec.key]: val,
                                    ...(sec.key === "solution" ? { stepByStep: val } : {}),
                                  }));
                                } else {
                                  setStructuredHi((prev) => ({
                                    ...prev,
                                    [sec.key]: val,
                                    ...(sec.key === "solution" ? { stepByStep: val } : {}),
                                  }));
                                }
                              }}
                              placeholder={sec.placeholder}
                              rows={sec.rows}
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

                    {/* Full Structured Solution Standard Preview */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="material-symbols-outlined text-purple-600 text-lg">verified</span>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                          Mandatory Universal 4-Section Solution
                        </h4>
                      </div>
                      <StandardSolutionView
                        solution={structuredEn}
                        activeLanguage="ENGLISH"
                        correctOptionKey={correctKey}
                        options={enOptions}
                        subject={editSubject}
                        imageUrl={editImageUrl}
                      />
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
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Micro-concepts</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editMicroConcept}
                          onChange={(e) => setEditMicroConcept(e.target.value)}
                          placeholder="e.g. Taxonomic Hierarchy in Plants, Binomial Nomenclature Rules"
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

                {/* Exam Classification & Properties (Strictly hides Question Number in Paper per Section 7) */}
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

                    <div className="grid grid-cols-2 gap-3">
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
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Exam Shift</label>
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
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tags</label>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            placeholder="e.g. Living World, Binomial Nomenclature, AIPMT 2012"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                          />
                          {suggestedTags.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Suggested Tags:</span>
                              {suggestedTags.map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => addSuggestedTag(st)}
                                  className="text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition"
                                >
                                  <span>+ {st}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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

            {/* MANDATORY 6-POINT VERIFICATION CHECKLIST (Always Visible at Bottom of Form) */}
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
                        {checkedCount} / 6 Verified
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      All 6 checks must be confirmed by reviewer before approving into the Verified Questions collection.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={markAllChecks}
                  className="self-start sm:self-auto px-3 py-1 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 transition cursor-pointer"
                >
                  Mark All 6 Checked
                </button>
              </div>

              {/* Checklist Grid (6 canonical checks) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 text-xs">
                {[
                  { key: "englishStatement" as const, label: "1. English Statement Verified", desc: "Scientific phrasing & symbols" },
                  { key: "hindiTranslation" as const, label: "2. Hindi Translation Verified", desc: "Grammar & Hindi terminology" },
                  { key: "allOptions" as const, label: "3. All Options Verified", desc: "A, B, C, D complete & matched" },
                  { key: "correctAnswer" as const, label: "4. Correct Answer Key Verified", desc: "Official key match" },
                  { key: "solution" as const, label: "5. Solution Verified", desc: "Direct, complete & subject-adaptive" },
                  { key: "imagesDiagrams" as const, label: "6. Images & Diagrams Verified", desc: "Clarity, cropping & labels" },
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
                title={allChecksPassed ? "Confirm all 6 checks and mark verified" : "All 6 checks must be marked to approve"}
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
