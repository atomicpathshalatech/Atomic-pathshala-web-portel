"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UnifiedQuestionEditor } from "@/components/questions/UnifiedQuestionEditor";

type BankQuestion = {
  id: string;
  type: string;
  difficulty: string;
  subject: string | null;
  chapter: string | null;
  statement: string;
  questionCode?: string | null;
};

type CurrentQuestion = {
  id: string; // SectionQuestion id
  order: number;
  question: { id: string; statement: string; questionCode?: string | null };
};

export function TestQuestionPicker({
  testId,
  current,
  editable,
  testSubject,
  testChapter,
}: {
  testId: string;
  current: CurrentQuestion[];
  editable: boolean;
  testSubject?: string;
  testChapter?: string;
}) {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<"search" | "quick-import" | "create">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BankQuestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Quick import state
  const [quickImportRaw, setQuickImportRaw] = useState("");
  const [quickImporting, setQuickImporting] = useState(false);

  const currentIds = new Set(current.map((c) => c.question.id));

  async function search() {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/question-bank?search=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not search the question bank.");
        return;
      }
      setResults(json.data.questions || []);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function addQuestion(questionId: string) {
    setAdding(questionId);
    setError(null);
    try {
      const res = await fetch(`/api/team/tests/${testId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [questionId] }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not add that question.");
        return;
      }
      toast.success("Question added to test!");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(null);
    }
  }

  async function handleQuickImport() {
    if (!quickImportRaw.trim()) {
      toast.error("Please paste at least one Question ID");
      return;
    }
    const ids = Array.from(
      new Set(
        quickImportRaw
          .split(/[\s,;\n\r\t]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      )
    );
    if (ids.length === 0) return;

    setQuickImporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/tests/${testId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: ids }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not import questions into test.");
        return;
      }
      const added = json.data?.added ?? 0;
      const rejected = json.data?.rejected;
      if (added > 0) {
        toast.success(`Imported ${added} question(s) into test!`);
        setQuickImportRaw("");
        router.refresh();
      } else if (rejected?.missing?.length) {
        toast.error(`Question(s) not found: ${rejected.missing.join(", ")}`);
      } else if (rejected?.alreadyAdded?.length) {
        toast.warning(`Questions already in test: ${rejected.alreadyAdded.join(", ")}`);
      }
    } catch {
      setError("Something went wrong during import.");
    } finally {
      setQuickImporting(false);
    }
  }

  async function removeQuestion(sectionQuestionId: string) {
    setRemoving(sectionQuestionId);
    setError(null);
    try {
      const res = await fetch(`/api/team/tests/${testId}/questions/${sectionQuestionId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not remove that question.");
        return;
      }
      toast.success("Question removed from test.");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setRemoving(null);
    }
  }

  async function handleCreated(createdId: string) {
    try {
      const res = await fetch(`/api/team/tests/${testId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [createdId] }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Created question, but failed to attach it to the test.");
        return;
      }
      toast.success("Question created and added to test!");
      setActiveMode("search");
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Test Question Builder
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pick from the Question Bank, Quick Import by Canonical ID, or author new questions.
          </p>
        </div>

        {editable && (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveMode("search")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeMode === "search"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">search</span>
              <span>Pick Existing</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("quick-import")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeMode === "quick-import"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              <span>Quick Import</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("create")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeMode === "create"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span>+ Create New</span>
            </button>
          </div>
        )}
      </div>

      {/* Current Questions List */}
      <div>
        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">
          Questions Attached to this Test ({current.length})
        </h4>
        {current.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
            No questions attached yet. Use the search, quick import, or create option below.
          </div>
        ) : (
          <ul className="space-y-2">
            {current
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-mono text-xs font-bold shrink-0">
                      Q{c.order}
                    </span>
                    {c.question.questionCode && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {c.question.questionCode}
                      </span>
                    )}
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {c.question.statement}
                    </span>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      disabled={removing === c.id}
                      onClick={() => removeQuestion(c.id)}
                      className="shrink-0 text-red-500 hover:text-red-700 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Mode 1: Search & Pick */}
      {editable && activeMode === "search" && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search by statement, Question ID (P26...), topic..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={searching}
              onClick={search}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          {results.length > 0 && (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-96 overflow-y-auto pr-1">
              {results.map((q) => {
                const already = currentIds.has(q.id);
                return (
                  <li key={q.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {q.questionCode && (
                          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                            {q.questionCode}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {q.type}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {q.difficulty}
                        </span>
                        {q.chapter && <span className="text-[10px] text-slate-400 truncate">{q.chapter}</span>}
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2">{q.statement}</p>
                    </div>

                    <button
                      type="button"
                      disabled={already || adding === q.id}
                      onClick={() => addQuestion(q.id)}
                      className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                        already
                          ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                      }`}
                    >
                      {already ? "Added" : adding === q.id ? "Adding..." : "+ Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Mode 2: Quick Import */}
      {editable && activeMode === "quick-import" && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Paste comma, space, or newline separated Canonical Question IDs (e.g. <code className="font-mono font-bold text-blue-600 dark:text-blue-400">P260000001, P260000002, C250000001</code>):
          </div>
          <textarea
            rows={3}
            value={quickImportRaw}
            onChange={(e) => setQuickImportRaw(e.target.value)}
            placeholder="P260000001, P260000002, C250000001..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={quickImporting || !quickImportRaw.trim()}
              onClick={handleQuickImport}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">cloud_download</span>
              <span>{quickImporting ? "Importing..." : "Import into Test"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode 3: Inline Question Creation */}
      {editable && activeMode === "create" && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <UnifiedQuestionEditor
            mode="test"
            testId={testId}
            onSaveSuccess={(created: any) => handleCreated(created?.id)}
          />
        </div>
      )}
    </div>
  );
}
