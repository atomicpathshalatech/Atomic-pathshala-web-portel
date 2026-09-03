"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtomicQuestionEditor } from "@/components/questions/AtomicQuestionEditor";

type BankQuestion = {
  id: string;
  type: string;
  difficulty: string;
  subject: string | null;
  chapter: string | null;
  statement: string;
};

type CurrentQuestion = {
  id: string; // SectionQuestion id
  order: number;
  question: { id: string; statement: string };
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
  const [activeMode, setActiveMode] = useState<"search" | "create">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BankQuestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Header Bar with Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900 text-white">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">quiz</span>
            <span>Test Questions ({current.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Pick from published question bank or create new standardized bilingual questions.
          </p>
        </div>

        {editable && (
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setActiveMode("search")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeMode === "search"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">search</span>
              <span>Pick Existing ({results.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("create")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
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
            No questions attached yet. Use the search or create option below.
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
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {c.question.statement}
                    </span>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      disabled={removing === c.id}
                      onClick={() => removeQuestion(c.id)}
                      className="shrink-0 text-red-500 hover:text-red-700 text-xs font-bold transition disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Mode View */}
      {editable && (
        activeMode === "search" ? (
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Search Question Bank
            </h4>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 px-4 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search published questions by keywords, code, chapter..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <button
                type="button"
                onClick={search}
                disabled={searching}
                className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-2.5 rounded-2xl shadow-md shadow-blue-500/20 transition disabled:opacity-60"
              >
                {searching ? "Searching..." : "Search Bank"}
              </button>
            </div>

            {results.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                {searching ? "Searching..." : "Type keywords to search published questions."}
              </p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {results.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-3 hover:border-blue-300 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg shrink-0">
                        {q.difficulty}
                      </span>
                      {q.subject && (
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                          {q.subject}:
                        </span>
                      )}
                      <span className="text-xs text-slate-800 dark:text-slate-200 truncate">
                        {q.statement}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={currentIds.has(q.id) || adding === q.id}
                      onClick={() => addQuestion(q.id)}
                      className="shrink-0 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm disabled:opacity-40 disabled:bg-slate-300 transition"
                    >
                      {currentIds.has(q.id) ? "Attached" : adding === q.id ? "Adding..." : "+ Add"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Universal Question Engine (Test Creator)
                </h4>
                <p className="text-xs text-slate-400">
                  Author question with Bilingual NTA format, OCR, and Equation live previews.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMode("search")}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕ Cancel
              </button>
            </div>

            <AtomicQuestionEditor
              initialSubject={testSubject || "Chemistry"}
              initialChapter={testChapter || ""}
              onSuccess={(createdQuestion) => {
                toast.success("Question created and submitted for centralized review!");
                if (createdQuestion?.id) {
                  addQuestion(createdQuestion.id);
                }
                setActiveMode("search");
                router.refresh();
              }}
            />
          </div>
        )
      )}
    </div>
  );
}
