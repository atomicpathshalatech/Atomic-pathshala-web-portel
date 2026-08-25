"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BankQuestion = {
  id: string;
  body: string;
  type: string;
  difficulty: string;
  marksCorrect: number;
  marksIncorrect: number;
  subject: { title: string } | null;
};

type CurrentQuestion = {
  id: string; // TestQuestion id
  order: number;
  question: { id: string; body: string; marksCorrect: number; marksIncorrect: number };
};

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-sm outline-none focus:ring-2 focus:ring-primary/30";

export function TestQuestionPicker({
  testId,
  current,
  editable,
}: {
  testId: string;
  current: CurrentQuestion[];
  editable: boolean;
}) {
  const router = useRouter();
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
      setResults(json.data.questions);
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
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setAdding(null);
    }
  }

  async function removeQuestion(testQuestionId: string) {
    setRemoving(testQuestionId);
    setError(null);
    try {
      const res = await fetch(`/api/team/tests/${testId}/questions/${testQuestionId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not remove that question.");
        return;
      }
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
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-2">
          <p className="text-label-sm font-label-sm text-error">{error}</p>
        </div>
      )}

      <div>
        <h3 className="font-headline-md text-headline-md text-on-surface mb-3">
          Questions on this test ({current.length})
        </h3>
        {current.length === 0 ? (
          <p className="text-label-sm text-on-surface-variant">No questions added yet.</p>
        ) : (
          <ul className="space-y-2">
            {current
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 bg-surface-container-lowest rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="text-label-sm text-on-surface-variant mr-2">Q{c.order}</span>
                    <span className="text-label-md text-on-surface">{c.question.body}</span>
                    <span className="text-label-sm text-on-surface-variant ml-2">
                      (+{c.question.marksCorrect} / {c.question.marksIncorrect})
                    </span>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      disabled={removing === c.id}
                      onClick={() => removeQuestion(c.id)}
                      className="shrink-0 text-error text-label-sm hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>

      {editable && (
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-3">Add from Question Bank</h3>
          <div className="flex gap-2 mb-3">
            <input
              className={inputClass}
              placeholder="Search verified questions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button
              type="button"
              onClick={search}
              disabled={searching}
              className="shrink-0 bg-primary text-on-primary text-label-sm font-label-sm px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-60"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
          {results.length === 0 ? (
            <p className="text-label-sm text-on-surface-variant">
              {searching ? "Searching..." : "Search the Question Bank to add questions here."}
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((q) => (
                <li
                  key={q.id}
                  className="flex items-start justify-between gap-3 bg-surface-container-lowest rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-secondary/10 text-secondary px-1.5 py-0.5 rounded mr-2">
                      {q.difficulty}
                    </span>
                    {q.subject && <span className="text-label-sm text-on-surface-variant mr-2">{q.subject.title}</span>}
                    <span className="text-label-md text-on-surface">{q.body}</span>
                  </div>
                  <button
                    type="button"
                    disabled={currentIds.has(q.id) || adding === q.id}
                    onClick={() => addQuestion(q.id)}
                    className="shrink-0 text-primary text-label-sm hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {currentIds.has(q.id) ? "Added" : adding === q.id ? "Adding..." : "Add"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
