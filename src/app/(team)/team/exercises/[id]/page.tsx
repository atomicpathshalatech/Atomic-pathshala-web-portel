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

export default function ExerciseBuilderWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const exerciseId = params.id as string;

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isRegrouping, setIsRegrouping] = useState(false);
  const [isLaunchingTest, setIsLaunchingTest] = useState(false);

  // Filter questions within workspace
  const [filterWarningOnly, setFilterWarningOnly] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");

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
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load exercise.");
    } finally {
      setLoading(false);
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

  // Remove question from exercise
  const handleRemoveQuestion = async (eqId: string) => {
    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}/questions/${eqId}`, {
        method: "DELETE",
      });
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

  // Move question to another section
  const handleMoveQuestionSection = async (eqId: string, newSectionId: string) => {
    try {
      const res = await fetch(`/api/team/exercises/${exerciseId}/questions/${eqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: newSectionId }),
      });
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

  // Global question numbering counter
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
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {exercise.title}
            </h1>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {exercise.exerciseCode}
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
            Export PDF
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
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-500"
          >
            <Upload className="h-4 w-4" />
            Import Questions by ID
          </button>

          {/* Regroup by Topic CTA */}
          <button
            type="button"
            disabled={isRegrouping || exercise.audit.totalQuestions === 0}
            onClick={handleRegroup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-50"
          >
            <Layers className="h-4 w-4 text-amber-600" />
            {isRegrouping ? "Regrouping..." : "Mode A: Auto Regroup by Topic"}
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

      {/* Questions by Section */}
      {exercise.sections.length === 0 || exercise.audit.totalQuestions === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
          <Upload className="mx-auto h-12 w-12 text-amber-500/70" />
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            No questions in this exercise yet
          </h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Import existing questions by pasting Question IDs or Codes (e.g. C250000130, chem_001). They will be automatically validated and grouped by topic.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-500"
            >
              <Upload className="h-4 w-4" />
              Import Question IDs Now
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {exercise.sections.map((sec, secIdx) => {
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
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-4"
              >
                {/* Section Title Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
                      Section {secIdx + 1}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {sec.title}
                    </h3>
                    <span className="text-xs text-slate-400">
                      ({sec.questions.length} questions)
                    </span>
                  </div>

                  {sec.topic && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                      Topic: {sec.topic}
                    </span>
                  )}
                </div>

                {/* Section Question Cards */}
                {sectionQuestions.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400 italic">
                    No matching questions in this section.
                  </p>
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
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ExerciseImportModal
        exerciseId={exercise.id}
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadExercise}
        sections={sectionsList}
      />

      <ExercisePdfExportModal
        exerciseId={exercise.id}
        exerciseTitle={exercise.title}
        exerciseCode={exercise.exerciseCode}
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        audit={{
          totalQuestions: exercise.audit.totalQuestions,
          missingEnglishCount: exercise.audit.missingEnglishCount,
          missingHindiCount: exercise.audit.missingHindiCount,
          chapterMismatchCount: exercise.audit.chapterMismatchCount,
        }}
      />
    </div>
  );
}
