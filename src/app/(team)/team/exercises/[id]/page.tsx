"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Layers,
  Printer,
  Sparkles,
  ExternalLink,
  Plus,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileText,
  FileCheck,
  RefreshCw,
  Clock,
  Eye,
  Settings2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Download,
  Trash2,
  X,
} from "lucide-react";
import { ExerciseImportModal } from "@/components/exercises/ExerciseImportModal";
import { ExercisePdfExportModal } from "@/components/exercises/ExercisePdfExportModal";
import { ExerciseQuestionCard } from "@/components/exercises/ExerciseQuestionCard";

interface ExerciseDetail {
  id: string;
  exerciseCode: string;
  title: string;
  subtitle: string | null;
  subject: string;
  chapter: string;
  topic: string | null;
  subTopic: string | null;
  description: string | null;
  instructions: string | null;
  exerciseType: string;
  organizationMode: string;
  status: string;
  languageMode: string;
  defaultMarks: number;
  defaultNegativeMarks: number;
  testId: string | null;
  sections: {
    id: string;
    title: string;
    description: string | null;
    topic: string | null;
    order: number;
    questions: {
      id: string;
      displayOrder: number;
      marks: number | null;
      negativeMarks: number | null;
      question: any;
    }[];
  }[];
  questions: any[];
  audit: {
    totalQuestions: number;
    totalSections: number;
    missingEnglishCount: number;
    missingHindiCount: number;
    chapterMismatchCount: number;
    missingTopicCount: number;
    unpublishedCount: number;
    pyqCount: number;
    difficultyCounts: Record<string, number>;
    typeCounts: Record<string, number>;
    isExportReadyBilingual: boolean;
    isExportReadyHindi: boolean;
    isExportReadyEnglish: boolean;
  };
}

interface SiblingExercise {
  id: string;
  exerciseCode: string;
  title: string;
  exerciseType: string;
  status: string;
  _count: {
    questions: number;
    sections: number;
  };
}

export default function ExerciseBuilderWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const exerciseId = params.id as string;

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Sibling exercises for this chapter
  const [siblingExercises, setSiblingExercises] = useState<SiblingExercise[]>([]);
  const [loadingSiblings, setLoadingSiblings] = useState(false);

  // Modals & Actions
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTargetSection, setImportTargetSection] = useState<{ id: string; title: string } | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isRegrouping, setIsRegrouping] = useState(false);
  const [isSyncingTopics, setIsSyncingTopics] = useState(false);
  const [isLaunchingTest, setIsLaunchingTest] = useState(false);
  const [isExportingChapterPdf, setIsExportingChapterPdf] = useState(false);

  // New Sibling Modal State
  const [showAddSiblingModal, setShowAddSiblingModal] = useState(false);
  const [newSiblingTitle, setNewSiblingTitle] = useState("Exercise 2 — Advanced Practice");
  const [newSiblingType, setNewSiblingType] = useState("ADVANCED");
  const [isCreatingSibling, setIsCreatingSibling] = useState(false);

  // Section collapse states
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Filter questions within workspace
  const [filterWarningOnly, setFilterWarningOnly] = useState(false);

  // Load exercise details
  const loadExercise = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/team/exercises/${exerciseId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load exercise");
      }
      setExercise(json.data);
      if (json.data?.subject && json.data?.chapter) {
        loadSiblings(json.data.subject, json.data.chapter);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load exercise.");
    } finally {
      setLoading(false);
    }
  };

  const loadSiblings = async (subject: string, chapter: string) => {
    try {
      setLoadingSiblings(true);
      const res = await fetch(
        `/api/team/exercises/chapter?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`
      );
      const json = await res.json();
      if (json.success && json.data?.exercises) {
        setSiblingExercises(json.data.exercises);
      }
    } catch (err) {
      console.warn("Failed to load sibling exercises", err);
    } finally {
      setLoadingSiblings(false);
    }
  };

  useEffect(() => {
    loadExercise();
  }, [exerciseId]);

  // Status update
  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setExercise((prev) => (prev ? { ...prev, status: newStatus } : null));
        setSuccessToast(`Exercise status changed to ${newStatus}`);
        setTimeout(() => setSuccessToast(""), 3000);
      }
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // Regroup by topic
  const handleRegroup = async () => {
    if (
      !confirm(
        "Regroup by Topic will automatically recreate sections based on each question's canonical Question Bank topic. Any empty sections will be pruned. Continue?"
      )
    ) {
      return;
    }

    setIsRegrouping(true);
    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}/regroup`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast("Successfully regrouped questions topic-wise!");
        setTimeout(() => setSuccessToast(""), 3000);
        await loadExercise();
      }
    } catch (err) {
      console.error("Failed to regroup", err);
    } finally {
      setIsRegrouping(false);
    }
  };

  // Sync Chapter Topics / Years
  const handleSyncTopics = async () => {
    if (!exercise) return;
    setIsSyncingTopics(true);
    try {
      const res = await fetch(`/api/team/exercises/${exercise.id}/sync-topics`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast(
          `Syllabus Synced! Added ${json.data.createdSectionsCount} sections, auto-routed ${json.data.routedQuestionsCount} questions.`
        );
        setTimeout(() => setSuccessToast(""), 4000);
        await loadExercise();
      } else {
        alert(json.error || "Sync failed");
      }
    } catch (err: any) {
      alert(err.message || "Failed to sync topics/years");
    } finally {
      setIsSyncingTopics(false);
    }
  };

  // Delete section
  const handleDeleteSection = async (secId: string, secTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${secTitle}"? Any questions in this section will be unassigned from it.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}/sections?sectionId=${secId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast(`Deleted section "${secTitle}"`);
        setTimeout(() => setSuccessToast(""), 3000);
        await loadExercise();
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete section");
    }
  };

  // Create new sibling exercise in same chapter
  const handleCreateSibling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exercise || !newSiblingTitle.trim()) return;

    setIsCreatingSibling(true);
    try {
      const res = await fetch("/api/team/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSiblingTitle.trim(),
          subject: exercise.subject,
          chapter: exercise.chapter,
          exerciseType: newSiblingType,
          organizationMode: newSiblingType.includes("PYQ") ? "YEAR_WISE" : "TOPIC_WISE",
          languageMode: exercise.languageMode,
          defaultMarks: exercise.defaultMarks,
          defaultNegativeMarks: exercise.defaultNegativeMarks,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create exercise.");
      }

      setSuccessToast(`Created ${newSiblingTitle}! Opening workspace...`);
      setShowAddSiblingModal(false);
      router.push(`/team/exercises/${json.data.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create exercise.");
    } finally {
      setIsCreatingSibling(false);
    }
  };

  // Export Complete Chapter Module PDF
  const handleExportChapterPdf = async () => {
    if (!exercise) return;
    setIsExportingChapterPdf(true);
    try {
      const res = await fetch("/api/team/exercises/chapter/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: exercise.subject,
          chapter: exercise.chapter,
          languageMode: exercise.languageMode,
          format: "FULL_WITH_SOLUTIONS",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate chapter PDF");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exercise.subject.toLowerCase()}-${exercise.chapter.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-module.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccessToast("Chapter Module PDF downloaded successfully!");
      setTimeout(() => setSuccessToast(""), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to export chapter module PDF");
    } finally {
      setIsExportingChapterPdf(false);
    }
  };

  // Section collapse toggles
  const toggleSectionCollapse = (secId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [secId]: !prev[secId],
    }));
  };
  const handleExpandAll = () => setCollapsedSections({});
  const handleCollapseAll = () => {
    if (!exercise) return;
    const all: Record<string, boolean> = {};
    for (const sec of exercise.sections) {
      all[sec.id] = true;
    }
    setCollapsedSections(all);
  };

  // Remove question handler
  const handleRemoveQuestion = async (exerciseQuestionId: string) => {
    try {
      const res = await fetch(
        `/api/team/exercises/${exerciseId}/questions/${exerciseQuestionId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.success) {
        setSuccessToast("Question removed from exercise.");
        setTimeout(() => setSuccessToast(""), 3000);
        await loadExercise();
      }
    } catch (err) {
      console.error("Failed to remove question", err);
    }
  };

  // Move question handler
  const handleMoveQuestionSection = async (
    exerciseQuestionId: string,
    targetSectionId: string
  ) => {
    try {
      const res = await fetch(
        `/api/team/exercises/${exerciseId}/questions/${exerciseQuestionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId: targetSectionId }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setSuccessToast("Question moved to section.");
        setTimeout(() => setSuccessToast(""), 3000);
        await loadExercise();
      }
    } catch (err) {
      console.error("Failed to move question", err);
    }
  };

  // Launch online Test in Test Portal
  const handleLaunchTest = async () => {
    setIsLaunchingTest(true);
    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}/launch-test`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast(`Test created! Redirecting to Test Portal...`);
        setTimeout(() => {
          router.push(json.data.redirectUrl);
        }, 1500);
      } else {
        alert(json.error || "Failed to launch test");
      }
    } catch (err: any) {
      alert(err.message || "Failed to launch test");
    } finally {
      setIsLaunchingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
          Loading Exercise Workspace...
        </div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center">
        <h2 className="text-xl font-bold text-slate-800">Exercise not found</h2>
        <Link href="/team/exercises" className="mt-4 inline-block text-xs font-semibold text-amber-600">
          &larr; Back to Exercises
        </Link>
      </div>
    );
  }

  const sectionsList = exercise.sections.map((s) => ({ id: s.id, title: s.title }));
  let globalCounter = 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-2">
          {successToast}
        </div>
      )}

      {/* CHAPTER EXERCISES HUB & SIBLING NAVIGATION */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs shrink-0">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Chapter Practice Module &bull; {exercise.subject}
              </span>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {exercise.chapter}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isExportingChapterPdf}
              onClick={handleExportChapterPdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 transition shadow-2xs cursor-pointer disabled:opacity-50"
              title="Download consolidated PDF of all exercises in this chapter"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExportingChapterPdf ? "Generating Chapter PDF..." : "Export Full Chapter Module PDF"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const count = siblingExercises.length;
                if (count === 1) {
                  setNewSiblingTitle("Exercise 2 — Advanced / Multi-Concept Questions");
                  setNewSiblingType("ADVANCED");
                } else if (count === 2) {
                  setNewSiblingTitle("Exercise 3 — NEET Past Year Questions (PYQs)");
                  setNewSiblingType("NEET_PYQ");
                } else if (count === 3) {
                  setNewSiblingTitle("Exercise 4 — JEE Main Past Year Questions (PYQs)");
                  setNewSiblingType("JEE_PYQ");
                } else {
                  setNewSiblingTitle(`Exercise ${count + 1} — Additional Practice`);
                  setNewSiblingType("TOPIC_WISE");
                }
                setShowAddSiblingModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Exercise to this Chapter</span>
            </button>
          </div>
        </div>

        {/* Exercises Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-bold text-slate-400 mr-1">Exercises in Chapter:</span>
          {siblingExercises.length === 0 ? (
            <span className="text-xs text-slate-400">Loading exercises...</span>
          ) : (
            siblingExercises.map((sib, sIdx) => {
              const isCurrent = sib.id === exercise.id;
              return (
                <Link
                  key={sib.id}
                  href={`/team/exercises/${sib.id}`}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                    isCurrent
                      ? "bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900 ring-2 ring-blue-500/30"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <span>{sib.title}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                      isCurrent
                        ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {sib._count?.questions ?? 0} Qs
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/team/exercises" className="hover:text-slate-600 dark:hover:text-slate-200">
              Exercises
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">{exercise.subject}</span>
            <span>/</span>
            <span>{exercise.chapter}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {exercise.title}
            </h1>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {exercise.exerciseCode}
            </span>
            <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold">
              {exercise.exerciseType}
            </span>
          </div>
        </div>

        {/* Right Status & Launch Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Switcher */}
          <select
            value={exercise.status}
            onChange={(e) => handleUpdateStatus(e.target.value)}
            className={`h-9 rounded-lg border px-3 text-xs font-bold focus:outline-none ${
              exercise.status === "PUBLISHED"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                : exercise.status === "ARCHIVED"
                ? "border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                : "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
            }`}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published (Live)</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* Student Practice Link */}
          <Link
            href={`/practice/exercises/${exercise.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <Eye className="h-3.5 w-3.5" />
            Practice Mode
          </Link>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
          >
            <Printer className="h-3.5 w-3.5" />
            Export Exercise PDF
          </button>

          {/* Launch Test Button */}
          <button
            type="button"
            disabled={isLaunchingTest || exercise.audit.totalQuestions === 0}
            onClick={handleLaunchTest}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-800 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isLaunchingTest ? "Creating Test..." : "Launch Online Test"}
          </button>
        </div>
      </div>

      {/* Primary Actions Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          {/* Import Questions CTA */}
          <button
            type="button"
            onClick={() => {
              setImportTargetSection(null);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-500 transition"
          >
            <Upload className="h-4 w-4" />
            <span>Import Questions by ID</span>
          </button>

          {/* Auto-Populate Topics / Generate Year Sections */}
          <button
            type="button"
            disabled={isSyncingTopics}
            onClick={handleSyncTopics}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 disabled:opacity-50 transition cursor-pointer"
            title="Automatically populate all topics/years for this chapter into this exercise"
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>
              {isSyncingTopics
                ? "Syncing Syllabus..."
                : exercise.exerciseType?.includes("PYQ") || exercise.organizationMode === "YEAR_WISE"
                ? "Auto-Generate Exam Years"
                : "Auto-Populate Chapter Topics"}
            </span>
          </button>

          {/* Regroup by Topic CTA */}
          <button
            type="button"
            disabled={isRegrouping || exercise.audit.totalQuestions === 0}
            onClick={handleRegroup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-50"
          >
            <Layers className="h-4 w-4 text-amber-600" />
            <span>{isRegrouping ? "Regrouping..." : "Auto-Regroup by Topic"}</span>
          </button>
        </div>

        {/* Filter questions toggle */}
        <div className="flex items-center gap-2 text-xs">
          {exercise.audit.chapterMismatchCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterWarningOnly(!filterWarningOnly)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                filterWarningOnly
                  ? "border-amber-500 bg-amber-100 text-amber-900 font-bold"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400"
              }`}
            >
              ⚠ Chapter Warnings ({exercise.audit.chapterMismatchCount})
            </button>
          )}

          <span className="text-slate-400">
            {exercise.audit.totalQuestions} questions in {exercise.audit.totalSections} sections
          </span>
        </div>
      </div>

      {/* Preflight Quality & Audit Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <div>
          <span className="block text-xs text-slate-400">Total Questions</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {exercise.audit.totalQuestions}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-400">Sections</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {exercise.audit.totalSections}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-400">Hindi Coverage</span>
          <span
            className={`text-sm font-bold ${
              exercise.audit.missingHindiCount === 0 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {exercise.audit.totalQuestions - exercise.audit.missingHindiCount} / {exercise.audit.totalQuestions}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-400">English Coverage</span>
          <span
            className={`text-sm font-bold ${
              exercise.audit.missingEnglishCount === 0 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {exercise.audit.totalQuestions - exercise.audit.missingEnglishCount} / {exercise.audit.totalQuestions}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-400">PYQ Questions</span>
          <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
            {exercise.audit.pyqCount}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-400">Total Marks</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {exercise.audit.totalQuestions * exercise.defaultMarks}
          </span>
        </div>
      </div>

      {/* SECTION / TOPIC QUICK-NAVIGATOR PILLS */}
      {exercise.sections.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 text-xs">
          <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider px-2">Jump to Part:</span>
          <button
            type="button"
            onClick={handleExpandAll}
            className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 mr-2 transition"
          >
            Collapse All
          </button>

          {exercise.sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => {
                setCollapsedSections((prev) => ({ ...prev, [sec.id]: false }));
                const el = document.getElementById(`section-${sec.id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/40 transition cursor-pointer"
            >
              <span className="truncate max-w-[180px]">{sec.title}</span>
              <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-black">
                {sec.questions.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Questions by Section */}
      {exercise.sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
          <Upload className="mx-auto h-12 w-12 text-amber-500/70" />
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            No sections in this exercise yet
          </h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Populate all chapter topics from syllabus or import questions directly by ID.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleSyncTopics}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500"
            >
              <Sparkles className="h-4 w-4" />
              <span>Auto-Populate Chapter Topics</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setImportTargetSection(null);
                setShowImportModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-500"
            >
              <Upload className="h-4 w-4" />
              <span>Import Question IDs Now</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {exercise.sections.map((sec, secIdx) => {
            const isCollapsed = Boolean(collapsedSections[sec.id]);
            const sectionQuestions = sec.questions.filter((qItem) => {
              if (filterWarningOnly) {
                const qChap = qItem.question.chapter;
                return (
                  exercise.chapter &&
                  qChap &&
                  qChap.trim().toLowerCase() !== exercise.chapter.trim().toLowerCase()
                );
              }
              return true;
            });

            return (
              <div
                key={sec.id}
                id={`section-${sec.id}`}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-4 transition"
              >
                {/* Section Title Banner with Clickable Expand/Collapse & Direct Import */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div
                    onClick={() => toggleSectionCollapse(sec.id)}
                    className="flex items-center gap-2.5 cursor-pointer select-none group"
                  >
                    <button
                      type="button"
                      className="p-1 rounded-md text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition"
                    >
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
                      Part {secIdx + 1}
                    </span>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                      {sec.title}
                    </h3>

                    <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {sec.questions.length} {sec.questions.length === 1 ? "question" : "questions"}
                    </span>

                    {sec.topic && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                        Topic: {sec.topic}
                      </span>
                    )}
                  </div>

                  {/* Section Right Actions */}
                  <div className="flex items-center gap-2">
                    {/* Direct Import to this Topic */}
                    <button
                      type="button"
                      onClick={() => {
                        setImportTargetSection({ id: sec.id, title: sec.title });
                        setShowImportModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer"
                      title={`Import Question IDs directly into "${sec.title}"`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Import into this Part</span>
                    </button>

                    {sec.questions.length === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(sec.id, sec.title)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete empty section"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Section Question Cards (Collapsible) */}
                {!isCollapsed && (
                  <>
                    {sectionQuestions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 py-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
                        <p className="italic">No questions in this part yet.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setImportTargetSection({ id: sec.id, title: sec.title });
                            setShowImportModal(true);
                          }}
                          className="mt-2 text-xs font-bold text-amber-600 hover:underline cursor-pointer"
                        >
                          + Click to import questions into this part
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sectionQuestions.map((qItem) => {
                          const num = globalCounter++;
                          return (
                            <ExerciseQuestionCard
                              key={qItem.id}
                              exerciseId={exercise.id}
                              exerciseQuestionId={qItem.id}
                              questionNumber={num}
                              question={qItem.question}
                              exerciseChapter={exercise.chapter}
                              currentSectionId={sec.id}
                              sections={sectionsList}
                              onRemove={handleRemoveQuestion}
                              onMoveSection={handleMoveQuestionSection}
                            />
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Import Modal */}
      <ExerciseImportModal
        exerciseId={exercise.id}
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportTargetSection(null);
        }}
        onSuccess={() => {
          setShowImportModal(false);
          setImportTargetSection(null);
          loadExercise();
        }}
        sections={sectionsList}
        defaultSectionId={importTargetSection?.id}
        defaultSectionTitle={importTargetSection?.title}
      />

      {/* PDF Export Modal */}
      <ExercisePdfExportModal
        exerciseId={exercise.id}
        exerciseTitle={exercise.title}
        exerciseCode={exercise.exerciseCode}
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        audit={exercise.audit}
        defaultLanguageMode={exercise.languageMode}
      />

      {/* Add Sibling Exercise Modal */}
      {showAddSiblingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Exercise to {exercise.chapter}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSiblingModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSibling} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Preset Templates
                </label>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "EX1") {
                      setNewSiblingTitle("Exercise 1 — Topic-wise Practice Questions");
                      setNewSiblingType("TOPIC_WISE");
                    } else if (val === "EX2") {
                      setNewSiblingTitle("Exercise 2 — Advanced / Multi-Concept Questions");
                      setNewSiblingType("ADVANCED");
                    } else if (val === "EX3") {
                      setNewSiblingTitle("Exercise 3 — NEET Past Year Questions (PYQs)");
                      setNewSiblingType("NEET_PYQ");
                    } else if (val === "EX4") {
                      setNewSiblingTitle("Exercise 4 — JEE Main Past Year Questions (PYQs)");
                      setNewSiblingType("JEE_PYQ");
                    } else if (val === "EX5") {
                      setNewSiblingTitle("Exercise 5 — Mixed Practice & Mock Questions");
                      setNewSiblingType("MIXED");
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="EX2">Exercise 2 — Advanced / Multi-Concept Questions</option>
                  <option value="EX3">Exercise 3 — NEET Past Year Questions (PYQs)</option>
                  <option value="EX4">Exercise 4 — JEE Main Past Year Questions (PYQs)</option>
                  <option value="EX1">Exercise 1 — Topic-wise Practice Questions</option>
                  <option value="EX5">Exercise 5 — Mixed Practice &amp; Mock Questions</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Exercise Title *
                </label>
                <input
                  type="text"
                  required
                  value={newSiblingTitle}
                  onChange={(e) => setNewSiblingTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Exercise Type &amp; Organization
                </label>
                <select
                  value={newSiblingType}
                  onChange={(e) => setNewSiblingType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="TOPIC_WISE">Topic-Wise (Auto-Populate Chapter Topics)</option>
                  <option value="ADVANCED">Advanced Level Practice</option>
                  <option value="NEET_PYQ">NEET Past Year Questions (Year-Wise 2024, 2023...)</option>
                  <option value="JEE_PYQ">JEE Main Past Year Questions (Year-Wise)</option>
                  <option value="MIXED">Mixed Practice</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSiblingModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingSibling || !newSiblingTitle.trim()}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                >
                  {isCreatingSibling ? "Creating..." : "Create & Open Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
