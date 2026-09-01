"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtomicQuestionEditor } from "@/components/questions/AtomicQuestionEditor";

type QuestionApiRow = {
  id: string;
  questionCode?: string | null;
  translations: { language: string; statement: string }[];
  subject: string | null;
  chapter: string | null;
  difficulty: string;
};

type QuestionRow = {
  id: string;
  questionCode?: string | null;
  body: string;
  subject: string | null;
  chapter: string | null;
  difficulty: string;
};

export function DppQuestionPicker({
  dppId,
  linkedQuestionIds,
  dppSubject,
  dppChapter,
}: {
  dppId: string;
  linkedQuestionIds: string[];
  dppSubject?: string;
  dppChapter?: string;
}) {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<"search" | "create">("search");
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
      if (search.trim()) params.set("query", search.trim());
      const res = await fetch(`/api/team/questions/engine?${params.toString()}`);
      const body = await res.json();
      if (res.ok && body.success) {
        setResults(
          (body.data.questions as QuestionApiRow[]).map((q) => ({
            id: q.id,
            questionCode: q.questionCode,
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
    <div className="glass-card rounded-2xl p-6 space-y-6">
      {/* Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-400">help_outline</span>
            <span>Add Questions to DPP</span>
          </h3>
          <p className="text-xs text-slate-400">
            Pick existing questions from the bank or use the Universal Question Engine.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveMode("search")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              activeMode === "search"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-sm">search</span>
            <span>Pick Existing ({results.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("create")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
              activeMode === "create"
                ? "bg-amber-500 text-black shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            <span>+ Create New</span>
          </button>
        </div>
      </div>

      {activeMode === "search" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <input
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Search by question ID (e.g. 82000001), keyword, or chapter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {selected.size > 0 && (
              <button
                onClick={attachSelected}
                disabled={attaching}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow disabled:opacity-60 transition"
              >
                {attaching ? "Attaching..." : `Attach ${selected.size} Selected`}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800 space-y-1">
            {loading && <p className="text-xs text-slate-400 py-3">Searching questions...</p>}
            {!loading && results.length === 0 && (
              <p className="text-xs text-slate-400 py-3">No questions found matching search.</p>
            )}
            {results.map((q) => {
              const isLinked = linked.has(q.id);
              return (
                <div
                  key={q.id}
                  className={`flex items-start gap-3 py-3 px-2 rounded-xl transition ${
                    isLinked ? "opacity-60 bg-slate-950/40" : "hover:bg-slate-900/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={isLinked}
                    checked={selected.has(q.id)}
                    onChange={() => toggle(q.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {q.questionCode && (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                          #{q.questionCode}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {q.difficulty}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-slate-200">{q.body}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {q.subject ?? "Unclassified"}
                      {q.chapter ? ` · ${q.chapter}` : ""}
                      {isLinked ? " · Already in this DPP" : ""}
                    </p>
                  </div>
                  {isLinked && (
                    <button
                      type="button"
                      onClick={() => detach(q.id)}
                      className="text-red-400 text-xs font-bold hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <AtomicQuestionEditor
            dppId={dppId}
            initialSubject={dppSubject || "Chemistry"}
            initialChapter={dppChapter || ""}
            onSuccess={() => {
              toast.success("Question created and attached to DPP!");
              setActiveMode("search");
              router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}