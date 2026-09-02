"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, MoreVertical, Edit, Copy, Eye, Trash2, CheckCircle2, Award } from "lucide-react";

export interface SeriesTestItem {
  id: string;
  name: string;
  code?: string | null;
  durationMin: number;
  status: string;
  sections: Array<{
    id: string;
    name: string;
    targetCount: number;
    _count: { questions: number };
  }>;
}

export function SeriesTestsList({ tests, testSeriesId }: { tests: SeriesTestItem[]; testSeriesId: string }) {
  const router = useRouter();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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
        const targetCount = t.sections.reduce((acc, s) => acc + (s.targetCount || 0), 0) || (assignedCount > 0 ? assignedCount : 180);
        const displayCode = t.code || t.id.slice(0, 5).toUpperCase();

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
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  {t.name}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Code: {displayCode} · {t.durationMin} min · {assignedCount}/{targetCount} questions
                </p>
              </div>
            </div>

            {/* Right: Actions (Manage Pill, Review Link, Status, 3-Dots) */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Manage Pill Button */}
              <Link
                href={`/team/tests/${t.id}/author`}
                className="px-4 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold text-xs transition"
              >
                Manage
              </Link>

              {/* Review Link */}
              <Link
                href={`/team/tests/${t.id}`}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 underline hover:text-teal-900 dark:hover:text-teal-300 transition hidden sm:inline"
              >
                Review
              </Link>

              {/* Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                  t.status === "PUBLISHED"
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {t.status}
              </span>

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
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 space-y-0.5 animate-in fade-in zoom-in-95">
                    <Link
                      href={`/team/tests/${t.id}/author`}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      onClick={() => setActiveMenuId(null)}
                    >
                      <span className="material-symbols-outlined text-base text-blue-600">add_task</span>
                      <span>Add / Author Questions</span>
                    </Link>

                    <Link
                      href={`/team/tests/${t.id}`}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      onClick={() => setActiveMenuId(null)}
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Test Blueprint</span>
                    </Link>

                    <Link
                      href={`/team/tests/${t.id}`}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      onClick={() => setActiveMenuId(null)}
                    >
                      <Eye className="w-3.5 h-3.5 text-teal-600" />
                      <span>Preview Test / Analytics</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDuplicateTest(t.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Duplicate Test</span>
                    </button>

                    <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

                    <button
                      type="button"
                      onClick={() => handleDeleteTest(t.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
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
    </div>
  );
}
