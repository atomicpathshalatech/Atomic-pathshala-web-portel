"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  MoreVertical,
  Edit,
  Copy,
  Eye,
  Trash2,
  Calendar,
  RefreshCw,
  Share2,
} from "lucide-react";
import { RescheduleTestModal } from "@/components/team-portal/RescheduleTestModal";
import { ShareTestModal } from "@/components/test-portal/ShareTestModal";
import { formatISTDate, formatISTTime } from "@/lib/date-utils";

export interface SeriesTestItem {
  id: string;
  name: string;
  code?: string | null;
  durationMin: number;
  status: string;
  openTime?: string | null;
  closeTime?: string | null;
  sections: Array<{
    id: string;
    name: string;
    targetCount: number;
    _count: { questions: number };
  }>;
}

export function SeriesTestsList({
  tests,
  testSeriesId,
}: {
  tests: SeriesTestItem[];
  testSeriesId: string;
}) {
  const router = useRouter();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [rescheduleTest, setRescheduleTest] = useState<SeriesTestItem | null>(null);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [shareModalTest, setShareModalTest] = useState<SeriesTestItem | null>(null);

  const handleDeleteTest = async (testId: string) => {
    setActiveMenuId(null);
    if (!confirm("Are you sure you want to delete this test?")) return;

    try {
      const res = await fetch(`/api/team/tests/${testId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to delete test.");
        return;
      }
      toast.success("Test deleted successfully.");
      router.refresh();
    } catch {
      toast.error("Network error while deleting test.");
    }
  };

  const handleDuplicateTest = async (testId: string) => {
    setActiveMenuId(null);
    toast.info("Duplicating test blueprint...");
    try {
      const res = await fetch(`/api/team/tests/${testId}/duplicate`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to duplicate test.");
        return;
      }
      toast.success("Test duplicated successfully!");
      router.refresh();
    } catch {
      toast.error("Network error.");
    }
  };

  const handleRecalculateScores = async (testId: string) => {
    setActiveMenuId(null);
    if (
      !confirm(
        "Are you sure you want to recalculate and reshuffle scores for this test?\n\nIf you have updated question answers or keys, this will re-grade all student submissions and automatically update their marks, percentage, and ranks."
      )
    ) {
      return;
    }

    setRecalculatingId(testId);
    toast.info("Recalculating student scores with updated answers...");
    try {
      const res = await fetch(`/api/team/tests/${testId}/recalculate-scores`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to recalculate scores.");
        return;
      }
      toast.success(json.message || "Student scores updated successfully!");
      router.refresh();
    } catch {
      toast.error("Network error while recalculating scores.");
    } finally {
      setRecalculatingId(null);
    }
  };

  if (tests.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
        <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-900 dark:text-white">No tests in this series yet.</p>
        <p className="text-xs text-slate-500 mt-1">Click &quot;+ Create Test&quot; above to setup sections and author questions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tests.map((t) => {
        const assignedCount = t.sections.reduce((acc, s) => acc + (s._count?.questions || 0), 0);
        const targetCount =
          t.sections.reduce((acc, s) => acc + (s.targetCount || 0), 0) ||
          (assignedCount > 0 ? assignedCount : 180);
        const allQuestionsAdded = assignedCount > 0 && assignedCount >= targetCount;
        const displayCode = t.code || t.id.slice(0, 5).toUpperCase();

        const displaySchedule = t.openTime
          ? `${formatISTDate(t.openTime)} · ${formatISTTime(t.openTime)}${t.closeTime ? ` – ${formatISTTime(t.closeTime)}` : ""}`
          : null;

        return (
          <div
            key={t.id}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4"
          >
            {/* Left: Document Icon + Title & Subtitle */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300 shadow-inner">
                <span className="material-symbols-outlined text-xl text-slate-500">edit_note</span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {t.name}
                  </h4>
                  <span className="text-[11px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 shrink-0">
                    Code: {displayCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {displaySchedule && (
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      📅 {displaySchedule} ·
                    </span>
                  )}
                  <span>{t.durationMin} min</span>
                  <span>·</span>
                  <span>{assignedCount}/{targetCount} questions</span>
                </p>
              </div>
            </div>

            {/* Right: Actions (Add/Edit Question Pill, Review Link, Share, 3-Dots) */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Add / Edit Question Button (Add Question when 0, Edit Questions when > 0) */}
              <Link
                href={`/team/tests/${t.id}/author`}
                className={`px-3.5 py-1.5 rounded-full font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs ${
                  assignedCount === 0
                    ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                }`}
                title={assignedCount === 0 ? "Add and author questions for this test" : "Edit questions for this test"}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {assignedCount === 0 ? "add_circle" : "edit_note"}
                </span>
                <span>{assignedCount === 0 ? "Add Question" : "Edit Questions"}</span>
              </Link>

              {/* Review Link - Clickable ONLY when all questions are added */}
              {allQuestionsAdded ? (
                <Link
                  href={`/team/tests/${t.id}/review`}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 underline hover:text-teal-900 dark:hover:text-teal-300 transition hidden sm:inline"
                  title="Review test in Laptop and Mobile mode"
                >
                  Review
                </Link>
              ) : (
                <span
                  className="text-xs font-semibold text-slate-400 dark:text-slate-600 cursor-not-allowed hidden sm:inline"
                  title={`Add all ${targetCount} questions to unlock Review (${assignedCount}/${targetCount} added)`}
                >
                  Review
                </span>
              )}

              {/* Share Test Button (Direct) */}
              <button
                type="button"
                onClick={() => setShareModalTest(t)}
                className="w-8 h-8 rounded-full hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 flex items-center justify-center text-slate-500 dark:text-slate-400 transition"
                title="Share Test Link with Students"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {/* 3-Dots Action Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActiveMenuId(activeMenuId === t.id ? null : t.id)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {activeMenuId === t.id && (
                  <div className="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 space-y-0.5 animate-in fade-in zoom-in-95">
                    {/* Share Test Link */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuId(null);
                        setShareModalTest(t);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition text-left"
                    >
                      <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Share Test Link</span>
                    </button>

                    {/* Add / Author Questions */}
                    <Link
                      href={`/team/tests/${t.id}/author`}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      onClick={() => setActiveMenuId(null)}
                    >
                      <span className="material-symbols-outlined text-base text-blue-600">add_task</span>
                      <span>Add / Author Questions</span>
                    </Link>

                    {/* Reschedule Test */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuId(null);
                        setRescheduleTest(t);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      <span>Reschedule Test</span>
                    </button>

                    {/* Reshuffle / Recalculate Scores */}
                    <button
                      type="button"
                      disabled={recalculatingId === t.id}
                      onClick={() => handleRecalculateScores(t.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 text-indigo-500 ${
                          recalculatingId === t.id ? "animate-spin" : ""
                        }`}
                      />
                      <span>Reshuffle / Recalculate Scores</span>
                    </button>

                    {/* Edit Test Blueprint */}
                    <Link
                      href={`/team/tests/${t.id}`}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      onClick={() => setActiveMenuId(null)}
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Test Blueprint</span>
                    </Link>

                    {/* Preview Test (Review) */}
                    <Link
                      href={allQuestionsAdded ? `/team/tests/${t.id}/review` : `/team/tests/${t.id}`}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      onClick={() => setActiveMenuId(null)}
                    >
                      <Eye className="w-3.5 h-3.5 text-teal-600" />
                      <span>Preview Test (Laptop &amp; Mobile)</span>
                    </Link>

                    {/* Duplicate Test */}
                    <button
                      type="button"
                      onClick={() => handleDuplicateTest(t.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
                    >
                      <Copy className="w-3.5 h-3.5 text-blue-500" />
                      <span>Duplicate Test</span>
                    </button>

                    <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

                    {/* Delete Test */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTest(t.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Test</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Reschedule Modal */}
      {rescheduleTest && (
        <RescheduleTestModal
          testId={rescheduleTest.id}
          testName={rescheduleTest.name}
          initialOpenTime={rescheduleTest.openTime}
          initialCloseTime={rescheduleTest.closeTime}
          initialDurationMin={rescheduleTest.durationMin}
          isOpen={Boolean(rescheduleTest)}
          onClose={() => setRescheduleTest(null)}
        />
      )}

      {/* Share Test Modal */}
      {shareModalTest && (
        <ShareTestModal
          isOpen={Boolean(shareModalTest)}
          onClose={() => setShareModalTest(null)}
          testId={shareModalTest.id}
          testName={shareModalTest.name}
          testCode={shareModalTest.code}
          durationMin={shareModalTest.durationMin}
        />
      )}
    </div>
  );
}
