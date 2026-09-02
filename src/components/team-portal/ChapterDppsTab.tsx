"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Edit2, FileText, Trash2, Download, CheckCircle2, Clock, Award, Plus, ArrowRight, HelpCircle } from "lucide-react";

export interface DppItem {
  id: string;
  code: string;
  name: string;
  level?: number | null;
  difficulty: string;
  estimatedTimeMin: number;
  correctMarks: number;
  incorrectMarks: number;
  status: string;
  createdAt: string | Date;
  _count?: {
    questions: number;
  };
}

export function ChapterDppsTab({
  chapterId,
  chapterTitle,
  dpps: initialDpps,
  canEdit,
}: {
  chapterId: string;
  chapterTitle: string;
  dpps: DppItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dpps, setDpps] = useState<DppItem[]>(initialDpps);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDpp, setEditingDpp] = useState<DppItem | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [level, setLevel] = useState<number>(1);
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [estimatedTimeMin, setEstimatedTimeMin] = useState<number>(30);
  const [correctMarks, setCorrectMarks] = useState<number>(4);
  const [incorrectMarks, setIncorrectMarks] = useState<number>(-1);
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleOpenCreate = () => {
    setName(`DPP ${String(dpps.length + 1).padStart(2, "0")} — ${chapterTitle}`);
    setLevel(1);
    setDifficulty("MEDIUM");
    setEstimatedTimeMin(30);
    setCorrectMarks(4);
    setIncorrectMarks(-1);
    setInstructions("Solve all questions within the allotted time. +4 for correct, -1 for incorrect.");
    setError("");
    setShowCreateModal(true);
  };

  const handleOpenEdit = (dpp: DppItem) => {
    setActiveMenuId(null);
    setEditingDpp(dpp);
    setName(dpp.name);
    setLevel(dpp.level || 1);
    setDifficulty((dpp.difficulty as any) || "MEDIUM");
    setEstimatedTimeMin(dpp.estimatedTimeMin || 30);
    setCorrectMarks(dpp.correctMarks || 4);
    setIncorrectMarks(dpp.incorrectMarks || -1);
    setError("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a name for this DPP.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/dpps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          level: Number(level),
          difficulty,
          estimatedTimeMin: Number(estimatedTimeMin),
          correctMarks: Number(correctMarks),
          incorrectMarks: Number(incorrectMarks),
          instructions: instructions.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to create DPP.");
        return;
      }

      setDpps((prev) => [...prev, json.data.dpp]);
      setShowCreateModal(false);
      toast.success("DPP created successfully!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDpp || !name.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/dpps/${editingDpp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          level: Number(level),
          difficulty,
          estimatedTimeMin: Number(estimatedTimeMin),
          correctMarks: Number(correctMarks),
          incorrectMarks: Number(incorrectMarks),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to update DPP.");
        return;
      }

      setDpps((prev) => prev.map((d) => (d.id === editingDpp.id ? json.data.dpp : d)));
      setEditingDpp(null);
      toast.success("DPP updated successfully!");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (dppId: string) => {
    setActiveMenuId(null);
    if (!confirm("Are you sure you want to delete this DPP?")) return;

    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/dpps/${dppId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Failed to delete DPP.");
        return;
      }

      setDpps((prev) => prev.filter((d) => d.id !== dppId));
      toast.success("DPP deleted successfully.");
      router.refresh();
    } catch {
      toast.error("Network error while deleting DPP.");
    }
  };

  const handleSubmitDpp = async (dppId: string) => {
    setActiveMenuId(null);
    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/dpps/${dppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const json = await res.json();
      if (json.success) {
        setDpps((prev) => prev.map((d) => (d.id === dppId ? { ...d, status: "ACTIVE" } : d)));
        toast.success("DPP submitted & activated!");
        router.refresh();
      }
    } catch {
      toast.error("Failed to submit DPP.");
    }
  };

  const handleDownloadPdf = (dpp: DppItem) => {
    setActiveMenuId(null);
    window.open(`/api/pdf/dpp/${dpp.id}`, "_blank");
    toast.info(`Generating PDF for ${dpp.name}...`);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Daily Practice Problems (DPPs)</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold">
              {dpps.length} Total
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Targeted daily problem sheets attached to {chapterTitle}.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create DPP</span>
          </button>
        )}
      </div>

      {dpps.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-10 text-center space-y-3 border border-dashed border-slate-300 dark:border-slate-800">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">No DPPs Attached Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create Daily Practice Problem sheets for {chapterTitle} so students can practice targeted question sets.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow hover:bg-indigo-500 transition"
            >
              + Create First DPP
            </button>
          )}
        </div>
      ) : (
        /* Vertical List Layout (Matching Lectures Tab) */
        <div className="space-y-3">
          {dpps.map((d, idx) => {
            const displaySlot = idx + 1;
            const qCount = d._count?.questions || 0;

            return (
              <div
                key={d.id}
                className="bg-white dark:bg-slate-900/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 transition shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative"
              >
                {/* Left: DPP Badge + Info */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex flex-col items-center justify-center font-bold shrink-0 shadow-sm">
                    <span className="text-[9px] uppercase tracking-wider text-indigo-500 font-bold">DPP</span>
                    <span className="text-sm font-black font-mono leading-none">
                      {String(displaySlot).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-md">
                        {d.name}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold">
                        {d.code}
                      </span>
                      {d.level && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          Level {d.level}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{d.estimatedTimeMin} mins</span>
                      </span>

                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                        <Award className="w-3.5 h-3.5 text-indigo-500" />
                        <span>+{d.correctMarks}/{d.incorrectMarks} Marks</span>
                      </span>

                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{d.difficulty}</span>

                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-indigo-600 dark:text-indigo-300 font-bold font-mono">{qCount} Questions</span>
                    </div>
                  </div>
                </div>

                {/* Right: Manage / Add Questions Button + 3-Dot Menu */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      d.status === "ACTIVE" || d.status === "PUBLISHED"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {d.status}
                  </span>

                  {/* Primary Button: Manage / Add Questions */}
                  <Link
                    href={`/team/dpp/${d.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition text-xs font-bold shadow-md shadow-indigo-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Manage Questions</span>
                  </Link>

                  {/* 3-Dot Menu Dropdown */}
                  {canEdit && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === d.id ? null : d.id)}
                        className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === d.id && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5 animate-in fade-in zoom-in-95">
                          <Link
                            href={`/team/dpp/${d.id}`}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            onClick={() => setActiveMenuId(null)}
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Edit Questions</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(d)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                            <span>Edit DPP Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(d)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Download PDF</span>
                          </button>

                          {d.status !== "ACTIVE" && (
                            <button
                              type="button"
                              onClick={() => handleSubmitDpp(d.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Submit / Activate</span>
                            </button>
                          )}

                          <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

                          <button
                            type="button"
                            onClick={() => handleDelete(d.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete DPP</span>
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

      {/* CREATE DPP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Create DPP for {chapterTitle}
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
                  DPP Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={1}>Level 1 (Foundation)</option>
                    <option value={2}>Level 2 (Standard)</option>
                    <option value={3}>Level 3 (Advanced)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Time (Mins)
                  </label>
                  <input
                    type="number"
                    value={estimatedTimeMin}
                    onChange={(e) => setEstimatedTimeMin(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Marks (+)
                  </label>
                  <input
                    type="number"
                    value={correctMarks}
                    onChange={(e) => setCorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
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
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
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
                  className="px-6 py-2.5 text-sm rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 shadow-md transition"
                >
                  {submitting ? "Creating..." : "Create DPP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DPP MODAL */}
      {editingDpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" />
                Edit DPP Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingDpp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  DPP Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={1}>Level 1 (Foundation)</option>
                    <option value={2}>Level 2 (Standard)</option>
                    <option value={3}>Level 3 (Advanced)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Time (Mins)
                  </label>
                  <input
                    type="number"
                    value={estimatedTimeMin}
                    onChange={(e) => setEstimatedTimeMin(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Marks (+)
                  </label>
                  <input
                    type="number"
                    value={correctMarks}
                    onChange={(e) => setCorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
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
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDpp(null)}
                  className="px-4 py-2 text-sm rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-sm rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 shadow-md transition"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}