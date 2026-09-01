"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [level, setLevel] = useState<number>(1);
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [estimatedTimeMin, setEstimatedTimeMin] = useState<number>(30);
  const [correctMarks, setCorrectMarks] = useState<number>(4);
  const [incorrectMarks, setIncorrectMarks] = useState<number>(-1);
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      setShowModal(false);
      setName("");
      setInstructions("");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>Daily Practice Problems (DPPs)</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 text-xs font-mono">
            {dpps.length}
          </span>
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow hover:bg-indigo-500 transition"
          >
            <span className="material-symbols-outlined text-base">post_add</span>
            <span>+ Create DPP</span>
          </button>
        )}
      </div>

      {dpps.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3 border border-dashed border-slate-700">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">assignment</span>
          </div>
          <h4 className="text-sm font-bold text-white">No DPPs Attached Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Create Daily Practice Problem sheets for {chapterTitle} so students can practice targeted question sets.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow hover:bg-indigo-500"
            >
              + Create First DPP
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {dpps.map((d) => (
            <div
              key={d.id}
              className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2.5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                      {d.code}
                    </span>
                    {d.level && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Level {d.level}
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {d.difficulty}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white line-clamp-1">{d.name}</h4>
                </div>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  {d.status}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div>
                  ⏱ {d.estimatedTimeMin} mins · Marks: +{d.correctMarks}/{d.incorrectMarks}
                </div>
                <Link
                  href={`/team/dpp/${d.id}`}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <span>Manage Questions</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400">assignment</span>
                Create DPP for Chapter
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">DPP Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DPP 01 — Atomic Models & Quantum Numbers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-indigo-500"
                  >
                    <option value={1}>Level 1 (Foundation)</option>
                    <option value={2}>Level 2 (Standard)</option>
                    <option value={3}>Level 3 (Advanced)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-indigo-500"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Time (Mins)</label>
                  <input
                    type="number"
                    value={estimatedTimeMin}
                    onChange={(e) => setEstimatedTimeMin(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Correct (+)</label>
                  <input
                    type="number"
                    value={correctMarks}
                    onChange={(e) => setCorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Incorrect (-)</label>
                  <input
                    type="number"
                    value={incorrectMarks}
                    onChange={(e) => setIncorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Instructions (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Solve all questions within 30 minutes."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-indigo-500"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500"
                >
                  {submitting ? "Creating..." : "Create DPP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}