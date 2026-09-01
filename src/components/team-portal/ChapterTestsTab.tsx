"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [durationMin, setDurationMin] = useState<number>(60);
  const [correctMarks, setCorrectMarks] = useState<number>(4);
  const [incorrectMarks, setIncorrectMarks] = useState<number>(-1);
  const [examType, setExamType] = useState("NEET");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
          <span>Chapter Tests & Quizzes</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 text-xs font-mono">
            {tests.length}
          </span>
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow hover:bg-emerald-500 transition"
          >
            <span className="material-symbols-outlined text-base">add_task</span>
            <span>+ Create Chapter Test</span>
          </button>
        )}
      </div>

      {tests.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-3 border border-dashed border-slate-700">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">quiz</span>
          </div>
          <h4 className="text-sm font-bold text-white">No Chapter Tests Created Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Schedule online computer-based tests (CBT) and quizzes to assess student mastery of {chapterTitle}.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow hover:bg-emerald-500"
            >
              + Create First Test
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {tests.map((t) => (
            <div
              key={t.id}
              className="glass-card rounded-2xl p-4 border border-slate-800 space-y-2.5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                      {t.code || "TEST"}
                    </span>
                    {t.examType && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        {t.examType}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white line-clamp-1">{t.name}</h4>
                </div>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  {t.status}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                <div>
                  ⏱ {t.durationMin} mins · Marks: +{t.correctMarks}/{t.incorrectMarks}
                </div>
                <Link
                  href={`/team/tests/${t.id}`}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                >
                  <span>Manage Test</span>
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
                <span className="material-symbols-outlined text-emerald-400">quiz</span>
                Create Chapter Test
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
                <label className="block text-xs font-medium text-slate-300 mb-1">Test Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter Test — Atomic Structure & Orbitals"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Exam Type</label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-emerald-500"
                  >
                    <option value="NEET">NEET Pattern</option>
                    <option value="JEE_MAIN">JEE Main Pattern</option>
                    <option value="CBSE_BOARD">CBSE Board Pattern</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Correct (+)</label>
                  <input
                    type="number"
                    value={correctMarks}
                    onChange={(e) => setCorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Incorrect (-)</label>
                  <input
                    type="number"
                    value={incorrectMarks}
                    onChange={(e) => setIncorrectMarks(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Instructions (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Standard CBT marking scheme applies."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-sm text-white focus:border-emerald-500"
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
                  className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500"
                >
                  {submitting ? "Creating..." : "Create Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}