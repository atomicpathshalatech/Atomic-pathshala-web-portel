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
  FileUp,
  MoreHorizontal,
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
  Pencil,
  X,
} from "lucide-react";
import { ExerciseImportModal } from "@/components/exercises/ExerciseImportModal";
import { ExercisePdfExportModal } from "@/components/exercises/ExercisePdfExportModal";
import { ExerciseQuestionCard } from "@/components/exercises/ExerciseQuestionCard";
import { ExercisePdfUploadModal } from "@/components/exercises/ExercisePdfUploadModal";
import { STANDARD_EXERCISES } from "@/lib/exercises/standard-exercises";

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

  // "Upload PDF": the whole PDF is extracted into this exercise (optionally one part)
  const [pdfUploadSection, setPdfUploadSection] = useState<string | null>(null);

  // Section collapse states
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Filter questions within workspace
  const [filterWarningOnly, setFilterWarningOnly] = useState(false);

  // Add / Edit Section & Topic Modal State
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionTopic, setNewSectionTopic] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);

  const [editingSection, setEditingSection] = useState<{
    id: string;
    title: string;
    topic: string;
    description: string;
  } | null>(null);
  const [isUpdatingSection, setIsUpdatingSection] = useState(false);

  // Edit Exercise Name & Metadata State
  const [showEditExerciseModal, setShowEditExerciseModal] = useState(false);
  const [editExerciseTitle, setEditExerciseTitle] = useState("");
  const [editExerciseSubtitle, setEditExerciseSubtitle] = useState("");
  const [editExerciseType, setEditExerciseType] = useState("TOPIC_WISE");
  const [editExerciseDescription, setEditExerciseDescription] = useState("");
  const [isUpdatingExercise, setIsUpdatingExercise] = useState(false);

  // Available chapter topics from academic hierarchy
  const [availableChapterTopics, setAvailableChapterTopics] = useState<{ id: string; name: string }[]>([]);

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
        loadChapterTopics(json.data.subject, json.data.chapter);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load exercise.");
    } finally {
      setLoading(false);
    }
  };

  const loadChapterTopics = async (subject: string, chapter: string) => {
    try {
      const res = await fetch(
        `/api/team/questions/academic-hierarchy?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.topics)) {
        setAvailableChapterTopics(json.data.topics);
      }
    } catch (err) {
      console.warn("Failed to load hierarchy topics", err);
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

  // Open Edit Exercise Name Modal
  const openEditExerciseModal = () => {
    if (!exercise) return;
    setEditExerciseTitle(exercise.title || "");
    setEditExerciseSubtitle(exercise.subtitle || "");
    setEditExerciseType(exercise.exerciseType || "TOPIC_WISE");
    setEditExerciseDescription(exercise.description || "");
    setShowEditExerciseModal(true);
  };

  // Save Exercise Name & Metadata
  const handleUpdateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exercise || !editExerciseTitle.trim()) return;

    setIsUpdatingExercise(true);
    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editExerciseTitle.trim(),
          subtitle: editExerciseSubtitle.trim() || null,
          exerciseType: editExerciseType,
          description: editExerciseDescription.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update exercise");
      }

      const updatedTitle = editExerciseTitle.trim();
      const updatedSubtitle = editExerciseSubtitle.trim() || null;
      const updatedType = editExerciseType;
      const updatedDesc = editExerciseDescription.trim() || null;

      setExercise((prev) =>
        prev
          ? {
              ...prev,
              title: updatedTitle,
              subtitle: updatedSubtitle,
              exerciseType: updatedType,
              description: updatedDesc,
            }
          : null
      );

      // Also update sibling list in local state
      setSiblingExercises((prev) =>
        prev.map((s) =>
          s.id === exerciseId
            ? {
                ...s,
                title: updatedTitle,
                exerciseType: updatedType,
              }
            : s
        )
      );

      setSuccessToast("Exercise name updated successfully!");
      setTimeout(() => setSuccessToast(""), 3500);
      setShowEditExerciseModal(false);
    } catch (err: any) {
      alert(err.message || "Failed to update exercise name");
    } finally {
      setIsUpdatingExercise(false);
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
  // Add new Section / Topic
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;

    setIsAddingSection(true);
    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSectionTitle.trim(),
          topic: newSectionTopic.trim() || null,
          description: newSectionDescription.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to add section");
      }

      setSuccessToast(`Added section "${newSectionTitle.trim()}"`);
      setTimeout(() => setSuccessToast(""), 3500);
      setShowAddSectionModal(false);
      setNewSectionTitle("");
      setNewSectionTopic("");
      setNewSectionDescription("");
      await loadExercise();
    } catch (err: any) {
      alert(err.message || "Failed to add section");
    } finally {
      setIsAddingSection(false);
    }
  };

  // Update existing Section / Topic
  const handleUpdateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection || !editingSection.title.trim()) return;

    setIsUpdatingSection(true);
    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}/sections`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: editingSection.id,
          title: editingSection.title.trim(),
          topic: editingSection.topic.trim() || null,
          description: editingSection.description.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update section");
      }

      setSuccessToast(`Updated section & topic successfully!`);
      setTimeout(() => setSuccessToast(""), 3500);
      setEditingSection(null);
      await loadExercise();
    } catch (err: any) {
      alert(err.message || "Failed to update section");
    } finally {
      setIsUpdatingSection(false);
    }
  };

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
            {siblingExercises.length > 1 && (
              <select
                value={exercise.id}
                onChange={(e) => router.push(`/team/exercises/${e.target.value}`)}
                className="ml-1 h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                title="Open another exercise of this chapter"
              >
                {siblingExercises.map((sib) => (
                  <option key={sib.id} value={sib.id}>
                    {sib.title} ({sib._count?.questions ?? 0} Qs)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {exercise.title}
            </h1>
            <button
              type="button"
              onClick={openEditExerciseModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Edit Exercise Name and Details"
            >
              <Pencil className="h-3 w-3 text-blue-600" />
              <span>Edit Name</span>
            </button>
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
          <Link
            href={`/team/exercises/${exercise.id}/author`}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Question</span>
          </Link>

          <button
            type="button"
            onClick={() => setPdfUploadSection("")}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-500 transition"
          >
            <FileUp className="h-4 w-4" />
            <span>Upload PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportTargetSection(null);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
          >
            <Upload className="h-4 w-4 text-amber-600" />
            <span>Import by ID</span>
          </button>

          {/* Less-used tools */}
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <MoreHorizontal className="h-4 w-4" />
              <span>More</span>
            </summary>
            <div className="absolute left-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {[
                {
                  label: "Add Section / Topic",
                  onClick: () => {
                    const defaultNum = (exercise?.sections.length || 0) + 1;
                    setNewSectionTitle(`Part ${defaultNum}: Topic Practice`);
                    setNewSectionTopic("");
                    setNewSectionDescription("");
                    setShowAddSectionModal(true);
                  },
                  disabled: false,
                },
                {
                  label: isSyncingTopics
                    ? "Syncing Syllabus..."
                    : exercise.exerciseType?.includes("PYQ") || exercise.organizationMode === "YEAR_WISE"
                    ? "Auto-Generate Exam Years"
                    : "Auto-Populate Chapter Topics",
                  onClick: handleSyncTopics,
                  disabled: isSyncingTopics,
                },
                {
                  label: isRegrouping ? "Regrouping..." : "Auto-Regroup by Topic",
                  onClick: handleRegroup,
                  disabled: isRegrouping || exercise.audit.totalQuestions === 0,
                },
                {
                  label: isExportingChapterPdf ? "Generating Chapter PDF..." : "Export Full Chapter PDF",
                  onClick: handleExportChapterPdf,
                  disabled: isExportingChapterPdf,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.disabled}
                  onClick={(e) => {
                    (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                    item.onClick();
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </details>
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
          <button
            type="button"
            onClick={() => {
              const defaultNum = (exercise?.sections.length || 0) + 1;
              setNewSectionTitle(`Part ${defaultNum}: Topic Practice`);
              setNewSectionTopic("");
              setNewSectionDescription("");
              setShowAddSectionModal(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-indigo-400 bg-indigo-50/70 px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 mr-1.5 transition cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>Add Part</span>
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
            Add questions one by one, upload a whole PDF, or set up the chapter&apos;s topics first.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/team/exercises/${exercise.id}/author`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Question</span>
            </Link>
            <button
              type="button"
              onClick={() => setPdfUploadSection("")}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-500"
            >
              <FileUp className="h-4 w-4" />
              <span>Upload PDF</span>
            </button>
            <button
              type="button"
              onClick={handleSyncTopics}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>Auto-Populate Chapter Topics</span>
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

                  {/* Edit Section / Topic Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSection({
                          id: sec.id,
                          title: sec.title,
                          topic: sec.topic || "",
                          description: sec.description || "",
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 transition cursor-pointer"
                      title="Edit Section Name and Topic"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit Topic / Title</span>
                    </button>

                    {/* Section Right Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/team/exercises/${exercise.id}/author?section=${sec.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs"
                      title={`Write a new question into "${sec.title}"`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add New Question</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPdfUploadSection(sec.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1.5 text-xs font-bold transition dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                      title={`Upload a PDF into "${sec.title}"`}
                    >
                      <FileUp className="h-3.5 w-3.5" />
                      <span>PDF</span>
                    </button>
                    {/* Direct Import to this Topic */}
                    <button
                      type="button"
                      onClick={() => {
                        setImportTargetSection({ id: sec.id, title: sec.title });
                        setShowImportModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 text-xs font-bold transition cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      title={`Import Question IDs directly into "${sec.title}"`}
                    >
                      <Upload className="h-3.5 w-3.5 text-amber-600" />
                      <span>Import by ID</span>
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
                        <Link
                          href={`/team/exercises/${exercise.id}/author?section=${sec.id}`}
                          className="mt-2 mr-3 inline-block text-xs font-bold text-blue-600 hover:underline"
                        >
                          + Add a new question
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setImportTargetSection({ id: sec.id, title: sec.title });
                            setShowImportModal(true);
                          }}
                          className="mt-2 text-xs font-bold text-amber-600 hover:underline cursor-pointer"
                        >
                          + Import by ID
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
{/* Bottom Add Section CTA */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const defaultNum = (exercise?.sections.length || 0) + 1;
                setNewSectionTitle(`Part ${defaultNum}: Topic Practice`);
                setNewSectionTopic("");
                setNewSectionDescription("");
                setShowAddSectionModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/60 px-6 py-3 text-xs font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 transition shadow-2xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Add Another Section / Topic to this Exercise</span>
            </button>
          </div>
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

      <ExercisePdfUploadModal
        exerciseId={exercise.id}
        exerciseTitle={exercise.title}
        isOpen={pdfUploadSection !== null}
        onClose={() => setPdfUploadSection(null)}
        sections={sectionsList}
        defaultSectionId={pdfUploadSection || undefined}
      />

      {/* Modal: Add New Section / Topic */}
      {showAddSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Add New Section / Topic
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add a new part to this exercise for organizing questions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSectionModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Section / Part Title *
                </label>
                <input
                  type="text"
                  required
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="e.g. Part 1: Periodic Trends or Topic 1"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Associated Topic Name (Optional)
                </label>
                <input
                  type="text"
                  list="available-topics-list"
                  value={newSectionTopic}
                  onChange={(e) => setNewSectionTopic(e.target.value)}
                  placeholder="e.g. Modern Periodic Law or select from chapter below"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
                <datalist id="available-topics-list">
                  {availableChapterTopics.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>

                {availableChapterTopics.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[11px] text-slate-400">Quick select from chapter:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1 max-h-28 overflow-y-auto">
                      {availableChapterTopics.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setNewSectionTopic(t.name);
                            if (!newSectionTitle || newSectionTitle.startsWith("Part")) {
                              setNewSectionTitle(`Part ${(exercise?.sections.length || 0) + 1}: ${t.name}`);
                            }
                          }}
                          className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                            newSectionTopic.toLowerCase() === t.name.toLowerCase()
                              ? "border-indigo-600 bg-indigo-600 text-white font-bold"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Subtitle (Optional)
                </label>
                <input
                  type="text"
                  value={newSectionDescription}
                  onChange={(e) => setNewSectionDescription(e.target.value)}
                  placeholder="Optional note or subtitle for this section"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingSection || !newSectionTitle.trim()}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isAddingSection ? "Adding..." : "Add Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Exercise Name & Details */}
      {showEditExerciseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Exercise Name &amp; Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rename this exercise (e.g. &quot;Exercise 2: Advanced Practice&quot;) and update its metadata.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditExerciseModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateExercise} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Exercise Name / Title *
                </label>
                <input
                  type="text"
                  required
                  value={editExerciseTitle}
                  onChange={(e) => setEditExerciseTitle(e.target.value)}
                  placeholder="e.g. Exercise 2"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                />

                {/* Quick Name Presets */}
                <div className="mt-2">
                  <span className="text-[11px] text-slate-400">Quick name presets:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {STANDARD_EXERCISES.map((e) => e.title).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEditExerciseTitle(preset)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] transition cursor-pointer ${
                          editExerciseTitle === preset
                            ? "border-blue-600 bg-blue-50 text-blue-700 font-bold dark:bg-blue-950 dark:text-blue-300"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Exercise Type &amp; Category
                </label>
                <select
                  value={editExerciseType}
                  onChange={(e) => setEditExerciseType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="TOPIC_WISE">Topic-Wise (Foundational / Syllabus Order)</option>
                  <option value="BASIC_PRACTICE">Level 1: Basic &amp; Conceptual</option>
                  <option value="ADVANCED">Level 2: Advanced / Multi-Concept</option>
                  <option value="NEET_PYQ">NEET Past Year Questions (PYQ)</option>
                  <option value="JEE_PYQ">JEE Main Past Year Questions (PYQ)</option>
                  <option value="MIXED">Mixed Concept &amp; Speed Test</option>
                  <option value="NCERT">NCERT &amp; NCERT Exemplar</option>
                  <option value="CUSTOM">Custom Practice Sheet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subtitle / Target Audience (Optional)
                </label>
                <input
                  type="text"
                  value={editExerciseSubtitle}
                  onChange={(e) => setEditExerciseSubtitle(e.target.value)}
                  placeholder="e.g. Recommended for NEET &amp; JEE Droppers / 12th Board"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Instructions / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editExerciseDescription}
                  onChange={(e) => setEditExerciseDescription(e.target.value)}
                  placeholder="Optional instructions for students or print module header..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditExerciseModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingExercise || !editExerciseTitle.trim()}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer"
                >
                  {isUpdatingExercise ? "Saving..." : "Save Exercise"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Section Title & Topic */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Section &amp; Topic Name
                  </h3>
                  <p className="text-xs text-slate-500">
                    Change the section heading, topic name, or description.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Section / Part Title *
                </label>
                <input
                  type="text"
                  required
                  value={editingSection.title}
                  onChange={(e) =>
                    setEditingSection({ ...editingSection, title: e.target.value })
                  }
                  placeholder="e.g. Part 1: Chemical Kinetics"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Topic Name
                </label>
                <input
                  type="text"
                  list="edit-available-topics-list"
                  value={editingSection.topic}
                  onChange={(e) =>
                    setEditingSection({ ...editingSection, topic: e.target.value })
                  }
                  placeholder="e.g. Rate of Reaction"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
                <datalist id="edit-available-topics-list">
                  {availableChapterTopics.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>

                {availableChapterTopics.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[11px] text-slate-400">Quick select from chapter topics:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1 max-h-28 overflow-y-auto">
                      {availableChapterTopics.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setEditingSection({
                              ...editingSection,
                              topic: t.name,
                            });
                          }}
                          className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                            editingSection.topic.toLowerCase() === t.name.toLowerCase()
                              ? "border-indigo-600 bg-indigo-600 text-white font-bold"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Subtitle (Optional)
                </label>
                <input
                  type="text"
                  value={editingSection.description}
                  onChange={(e) =>
                    setEditingSection({ ...editingSection, description: e.target.value })
                  }
                  placeholder="Optional section description or instructions"
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSection || !editingSection.title.trim()}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isUpdatingSection ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
