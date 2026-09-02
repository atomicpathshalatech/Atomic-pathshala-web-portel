"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Edit2, FileText, Trash2, Download, CheckCircle2, Clock, Award, Plus, Layers, HelpCircle } from "lucide-react";
import { SecureDeleteResourceModal } from "@/components/common/SecureDeleteResourceModal";

export interface TestItem {
  id: string;
  code?: string | null;
  name: string;
  durationMin: number;
  correctMarks: number;
  incorrectMarks: number;
  examType?: string | null;
  status: string;
  createdAt: string | Date;
  _count?: {
    sections: number;
    attempts: number;
  };
}

export function ChapterTestsTab({
  chapterId,
  chapterTitle,
  tests: initialTests,
  canEdit,
}: {
  chapterId: string;
  chapterTitle: string;
  tests: TestItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [tests, setTests] = useState<TestItem[]>(initialTests);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTest, setEditingTest] = useState<TestItem | null>(null);
  const [deleteModalTest, setDeleteModalTest] = useState<TestItem | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [correctMarks, setCorrectMarks] = useState<number>(4);
  const [incorrectMarks, setIncorrectMarks] = useState<number>(-1);
  const [examType, setExamType] = useState("NEET");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleOpenCreate = () => {
    setName(`Chapter Assessment — ${chapterTitle}`);
    setDurationMin(60);
    setCorrectMarks(4);
    setIncorrectMarks(-1);
    setExamType("NEET");
    setInstructions("Standard computer-based assessment. +4 for correct, -1 for incorrect.");
    setError("");
    setShowCreateModal(true);
  };

  const handleOpenEdit = (t: TestItem) => {
    setActiveMenuId(null);
    setEditingTest(t);
    setName(t.name);
    setDurationMin(t.durationMin || 60);
    setCorrectMarks(t.correctMarks || 4);
    setIncorrectMarks(t.incorrectMarks || -1);
    setExamType(t.examType || "NEET");
    setError("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a name for this chapter test.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          durationMin: Number(durationMin),
          correctMarks: Number(correctMarks),
          incorrectMarks: Number(incorrectMarks),
          examType,
          instructions: instructions.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to create test.");
        return;
      }

      setTests((prev) => [json.data.test, ...prev]);
      setShowCreateModal(false);
      toast.success("Chapter Test created successfully!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest || !name.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/tests/${editingTest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          durationMin: Number(durationMin),
          correctMarks: Number(correctMarks),
          incorrectMarks: Number(incorrectMarks),
          examType,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to update test.");
        return;
      }

      setTests((prev) => prev.map((t) => (t.id === editingTest.id ? json.data.test : t)));
      setEditingTest(null);
      toast.success("Test updated successfully!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (testId: string) => {
    setActiveMenuId(null);
    if (!confirm("Are you sure you want to delete this chapter test?")) return;

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/tests/${testId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to delete test.");
        return;
      }

      setTests((prev) => prev.filter((t) => t.id !== testId));
      toast.success("Chapter test deleted.");
      router.refresh();
    } catch {
      toast.error("Network error while deleting test.");
    }
  };

  const handleSubmitTest = async (testId: string) => {
    setActiveMenuId(null);
    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });
      const json = await res.json();
      if (json.success) {
        setTests((prev) => prev.map((t) => (t.id === testId ? { ...t, status: "PUBLISHED" } : t)));
        toast.success("Test submitted & published!");
        router.refresh();
      }
    } catch {
      toast.error("Failed to submit test.");
    }
  };

  const handleDownloadPdf = (t: TestItem) => {
    setActiveMenuId(null);
    window.open(`/api/pdf/test/${t.id}`, "_blank");
    toast.info(`Generating PDF for ${t.name}...`);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Chapter Tests &amp; Quizzes</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
              {tests.length} Total
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Computer-based chapter tests (CBT) and evaluations for {chapterTitle}.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 hover:bg-emerald-500 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Chapter Test</span>
          </button>
        )}
      </div>

      {tests.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-10 text-center space-y-3 border border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Chapter Tests Created Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Schedule online CBT tests and quizzes to assess student mastery of {chapterTitle}.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow hover:bg-emerald-500 transition"
            >
              + Create First Test
            </button>
          )}
        </div>
      ) : (
        /* Vertical List Layout (Matching Lectures Tab) */
        <div className="space-y-3">
          {tests.map((t, idx) => {
            const displaySlot = idx + 1;

            return (
              <div
                key={t.id}
                className="bg-white dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative"
              >
                {/* Left: Test Badge + Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex flex-col items-center justify-center font-bold shrink-0 shadow-sm">
                    <span className="text-[9px] uppercase tracking-wider text-emerald-500 font-bold">TEST</span>
                    <span className="text-sm font-black font-mono leading-none">
                      {String(displaySlot).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">
                        {t.name}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold">
                        {t.code || `TEST_${t.id.slice(0, 4)}`}
                      </span>
                      {t.examType && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {t.examType}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{t.durationMin} mins</span>
                      </span>

                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                        <Award className="w-3.5 h-3.5 text-emerald-500" />
                        <span>+{t.correctMarks}/{t.incorrectMarks} Marks</span>
                      </span>

                      {t._count?.sections && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-emerald-600 dark:text-emerald-300 font-semibold font-mono">
                            {t._count.sections} Sections
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Manage / Add Questions Button + 3-Dot Menu */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      t.status === "PUBLISHED" || t.status === "ACTIVE"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {t.status}
                  </span>

                  {/* Primary Action Button: Manage / Add Questions */}
                  <Link
                    href={`/team/tests/${t.id}/author`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition text-xs font-bold shadow-md shadow-emerald-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Manage Questions</span>
                  </Link>

                  {/* 3-Dot Menu Dropdown */}
                  {canEdit && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === t.id ? null : t.id)}
                        className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === t.id && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5 animate-in fade-in zoom-in-95">
                          <Link
                            href={`/team/tests/${t.id}/author`}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            onClick={() => setActiveMenuId(null)}
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Edit Questions</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                            <span>Edit Test Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(t)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Download className="w-3.5 h-3.5 text-teal-500" />
                            <span>Download PDF</span>
                          </button>

                          {t.status !== "PUBLISHED" && (
                            <button
                              type="button"
                              onClick={() => handleSubmitTest(t.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Submit / Publish</span>
                            </button>
                          )}

                          <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              setDeleteModalTest(t);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Test</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE TEST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                Create Chapter Test for {chapterTitle}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Test Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    step={5}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Exam Type
                  </label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="NEET">NEET Pattern</option>
                    <option value="JEE_MAIN">JEE Main Pattern</option>
                    <option value="CBSE_BOARD">CBSE Board Pattern</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Marks (+)
                  </label>
                  <input
                    type="number"
                    value={correctMarks}
                    onChange={(e) => setCorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Marks (-)
                  </label>
                  <input
                    type="number"
                    value={incorrectMarks}
                    onChange={(e) => setIncorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-sm rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-md transition"
                >
                  {submitting ? "Creating..." : "Create Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEST MODAL */}
      {editingTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-600" />
                Edit Test Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingTest(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Test Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    step={5}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Exam Type
                  </label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="NEET">NEET Pattern</option>
                    <option value="JEE_MAIN">JEE Main Pattern</option>
                    <option value="CBSE_BOARD">CBSE Board Pattern</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Marks (+)
                  </label>
                  <input
                    type="number"
                    value={correctMarks}
                    onChange={(e) => setCorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Marks (-)
                  </label>
                  <input
                    type="number"
                    value={incorrectMarks}
                    onChange={(e) => setIncorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTest(null)}
                  className="px-4 py-2 text-sm rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-sm rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-md transition"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECURE DELETE MODAL */}
      {deleteModalTest && (
        <SecureDeleteResourceModal
          isOpen={Boolean(deleteModalTest)}
          onClose={() => setDeleteModalTest(null)}
          resourceId={deleteModalTest.code || `TST-${deleteModalTest.id.slice(0, 6).toUpperCase()}`}
          resourceTitle={deleteModalTest.name}
          resourceType="TEST"
          onDeleted={() => {
            setTests((prev) => prev.filter((t) => t.id !== deleteModalTest.id));
            setDeleteModalTest(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}