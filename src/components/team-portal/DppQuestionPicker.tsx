"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UnifiedQuestionEditor } from "@/components/questions/UnifiedQuestionEditor";
import { FormulaText } from "@/components/test-portal/FormulaText";

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
  const [scope, setScope] = useState<"chapter" | "all">(dppChapter ? "chapter" : "all");
  // "Isomerism (समावयवता)" → "Isomerism": bank questions carry the plain name.
  const chapterName = (dppChapter || "").replace(/\s*\(.*\)\s*$/, "").trim();
  const [results, setResults] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);
  const linked = new Set(linkedQuestionIds);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("usable", "1"); // only questions that can actually be attached
      if (scope === "chapter") {
        if (dppSubject) params.set("subject", dppSubject);
        const q = search.trim() || chapterName;
        if (q) params.set("query", q);
      } else if (search.trim()) params.set("query", search.trim());
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
  }, [search, scope, dppSubject, chapterName]);

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
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-base font-black text-slate-900 dark:text-white">Add questions</h3>
        <div className="grid grid-cols-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-xs font-bold">
          {([
            ["search", "Pick from bank", "search"],
            ["create", "Create new", "add"],
          ] as const).map(([m, label, icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMode(m)}
              className={`px-3 py-2 flex items-center justify-center gap-1 ${
                activeMode === m ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeMode === "search" ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search by question ID or words…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {dppChapter && (
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0">
                {([
                  ["chapter", chapterName || "This chapter"],
                  ["all", "All questions"],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setScope(v)}
                    className={`px-3 py-2 ${scope === v ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 px-3 py-2">
              <span className="text-xs font-bold text-blue-800 dark:text-blue-200">{selected.size} selected</span>
              <button
                onClick={attachSelected}
                disabled={attaching}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-60"
              >
                {attaching ? "Adding…" : "Add to DPP"}
              </button>
            </div>
          )}

          <div className="max-h-[480px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {loading && <p className="text-sm text-slate-500 p-4">Loading questions…</p>}
            {!loading && results.length === 0 && (
              <div className="p-4 text-sm text-slate-500">
                No questions found.
                {scope === "chapter" && (
                  <button type="button" onClick={() => setScope("all")} className="ml-1 font-bold text-blue-600">
                    Search all questions
                  </button>
                )}
              </div>
            )}
            {!loading &&
              results.map((q) => {
                const isLinked = linked.has(q.id);
                return (
                  <label
                    key={q.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer ${isLinked ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 accent-blue-600"
                      disabled={isLinked}
                      checked={isLinked || selected.has(q.id)}
                      onChange={() => toggle(q.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-900 dark:text-slate-100 line-clamp-3 [&_img]:max-h-24 [&_img]:inline-block">
                        <FormulaText text={q.body} />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {q.questionCode ? `#${q.questionCode} · ` : ""}
                        {q.difficulty.toLowerCase()}
                        {q.chapter ? ` · ${q.chapter}` : ""}
                      </p>
                    </div>
                    {isLinked && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          detach(q.id);
                        }}
                        className="shrink-0 text-xs font-bold text-rose-600"
                      >
                        Remove
                      </button>
                    )}
                  </label>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <UnifiedQuestionEditor
            mode="dpp"
            dppId={dppId}
            initialQuestion={{
              subject: dppSubject || "Chemistry",
              chapter: dppChapter || "",
            }}
            onSaveSuccess={() => {
              toast.success("Question created and added to the DPP");
              setActiveMode("search");
              router.refresh();
            }}
            onCancelHref="#"
          />
        </div>
      )}
    </div>
  );
}
