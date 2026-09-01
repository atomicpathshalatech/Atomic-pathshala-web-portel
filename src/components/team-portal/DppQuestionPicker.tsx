"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type QuestionApiRow = {
  id: string;
  translations: { language: string; statement: string }[];
  subject: string | null;
  chapter: string | null;
  difficulty: string;
};

type QuestionRow = {
  id: string;
  body: string;
  subject: string | null;
  chapter: string | null;
  difficulty: string;
};

export function DppQuestionPicker({
  dppId,
  linkedQuestionIds,
}: {
  dppId: string;
  linkedQuestionIds: string[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);
  const linked = new Set(linkedQuestionIds);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/team/questions?${params.toString()}`);
      const body = await res.json();
      if (res.ok && body.success) {
        setResults(
          (body.data.questions as QuestionApiRow[]).map((q) => ({
            id: q.id,
            body:
              q.translations.find((t) => t.language === "ENGLISH")?.statement ??
              q.translations[0]?.statement ??
              "",
            subject: q.subject,
            chapter: q.chapter,
            difficulty: q.difficulty,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function attachSelected() {
    if (selected.size === 0) return;
    setAttaching(true);
    try {
      const res = await fetch(`/api/team/dpp/${dppId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: Array.from(selected) }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not add questions");
        return;
      }
      toast.success(`Added ${body.data.added} question${body.data.added === 1 ? "" : "s"}`);
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAttaching(false);
    }
  }

  async function detach(questionId: string) {
    try {
      const res = await fetch(`/api/team/dpp/${dppId}/questions?questionId=${questionId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not remove question");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <div className="glass-card rounded-xl p-stack-lg space-y-stack-md">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-headline-md text-headline-md text-primary">Add Questions</h3>
        {selected.size > 0 && (
          <button
            onClick={attachSelected}
            disabled={attaching}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md disabled:opacity-60"
          >
            {attaching ? "Adding..." : `Add ${selected.size} Selected`}
          </button>
        )}
      </div>
      <input
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 px-3 text-body-md outline-none focus:ring-2 focus:ring-primary/30"
        placeholder="Search question text..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-96 overflow-y-auto divide-y divide-outline-variant/20">
        {loading && <p className="text-label-sm text-on-surface-variant py-3">Searching...</p>}
        {!loading && results.length === 0 && (
          <p className="text-label-sm text-on-surface-variant py-3">No questions found.</p>
        )}
        {results.map((q) => {
          const isLinked = linked.has(q.id);
          return (
            <div
              key={q.id}
              className={`flex items-start gap-3 py-3 ${isLinked ? "opacity-60" : "hover:bg-surface-container-lowest/50"}`}
            >
              <input
                type="checkbox"
                className="mt-1"
                disabled={isLinked}
                checked={selected.has(q.id)}
                onChange={() => toggle(q.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="line-clamp-2 text-body-md">{q.body}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {q.subject ?? "Unclassified"}
                  {q.chapter ? ` · ${q.chapter}` : ""} · {q.difficulty}
                  {isLinked ? " · Already added" : ""}
                </p>
              </div>
              {isLinked && (
                <button type="button" onClick={() => detach(q.id)} className="text-error text-label-sm shrink-0">
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
