"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UnifiedQuestionEditor } from "@/components/questions/UnifiedQuestionEditor";
import { FormulaText } from "@/components/test-portal/FormulaText";
import type { DppImportValidationItem, DppQuickImportSummary } from "@/lib/questions/dpp-quick-import";

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
  const [activeMode, setActiveMode] = useState<"search" | "quick-import" | "create">("search");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"chapter" | "all">(dppChapter ? "chapter" : "all");
  const chapterName = (dppChapter || "").replace(/\s*\(.*\)\s*$/, "").trim();
  const [results, setResults] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);
  const linked = new Set(linkedQuestionIds);

  // Quick Import State
  const [rawQuickImportText, setRawQuickImportText] = useState("");
  const [validatingQuickImport, setValidatingQuickImport] = useState(false);
  const [importingQuickImport, setImportingQuickImport] = useState(false);
  const [quickImportSummary, setQuickImportSummary] = useState<DppQuickImportSummary | null>(null);

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
    if (activeMode === "search") {
      runSearch();
    }
  }, [runSearch, activeMode]);

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
        toast.error(body.error ?? "Failed to add questions to DPP");
        return;
      }
      toast.success(`Added ${body.data.added} question(s)`);
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAttaching(false);
    }
  }

  async function handleValidateQuickImport() {
    if (!rawQuickImportText.trim()) {
      toast.error("Please paste at least one Question ID");
      return;
    }
    setValidatingQuickImport(true);
    try {
      const res = await fetch(`/api/team/dpp/${dppId}/quick-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: rawQuickImportText,
          action: "validate",
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setQuickImportSummary(json.data);
        if (json.data.eligibleCount > 0) {
          toast.success(`Validated: ${json.data.eligibleCount} eligible question(s) ready to import.`);
        } else {
          toast.warning("Validation completed: No eligible questions found.");
        }
      } else {
        toast.error(json.error || "Validation failed");
      }
    } catch {
      toast.error("Network error during validation");
    } finally {
      setValidatingQuickImport(false);
    }
  }

  async function handleExecuteQuickImport() {
    if (!rawQuickImportText.trim()) return;
    setImportingQuickImport(true);
    try {
      const res = await fetch(`/api/team/dpp/${dppId}/quick-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: rawQuickImportText,
          action: "import",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Questions imported into DPP successfully!");
        setRawQuickImportText("");
        setQuickImportSummary(null);
        router.refresh();
      } else {
        toast.error(json.error || "Import failed");
      }
    } catch {
      toast.error("Network error during import");
    } finally {
      setImportingQuickImport(false);
    }
  }

  async function handleCreated(createdId: string) {
    try {
      const res = await fetch(`/api/team/dpp/${dppId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [createdId] }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Created question, but failed to attach it to the DPP");
        return;
      }
      toast.success("Question created and added to DPP");
      setActiveMode("search");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-base font-black text-slate-900 dark:text-white">Add questions</h3>
        <div className="grid grid-cols-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-xs font-bold">
          {([
            ["search", "Pick from bank", "search"],
            ["quick-import", "DPP Quick Import", "bolt"],
            ["create", "Create new", "add"],
          ] as const).map(([m, label, icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMode(m)}
              className={`px-3 py-2 flex items-center justify-center gap-1 transition ${
                activeMode === m ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{icon}</span>
              <span className="truncate">{label}</span>
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
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-60 cursor-pointer"
              >
                {attaching ? "Adding…" : "Add to DPP"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No matching questions found in the bank.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto pr-1">
              {results.map((q) => {
                const isLinked = linked.has(q.id);
                const isSelected = selected.has(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      if (!isLinked) toggle(q.id);
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl transition ${
                      isLinked
                        ? "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-950/30"
                        : isSelected
                        ? "bg-blue-50/70 dark:bg-blue-950/30 cursor-pointer"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={isLinked}
                      checked={isLinked || isSelected}
                      onChange={() => {}}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {q.questionCode && (
                          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                            {q.questionCode}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {q.difficulty}
                        </span>
                        {q.chapter && <span className="text-[11px] text-slate-400 truncate">{q.chapter}</span>}
                        {isLinked && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                            Already in DPP
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2">
                        <FormulaText text={q.body} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeMode === "quick-import" ? (
        /* ========================================================================= */
        /* DPP QUICK IMPORT: Paste Canonical Question IDs with Pre-validation */
        /* ========================================================================= */
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-blue-600 dark:text-blue-400">bolt</span>
              Canonical Question ID Quick Import
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">
              Paste comma, space, or newline separated 10-character Question IDs (e.g., <code className="font-mono text-blue-700 dark:text-blue-300 font-bold">P260000001, P260000002, C250000003</code>). All questions will be validated against the Question Bank before linking.
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              rows={4}
              value={rawQuickImportText}
              onChange={(e) => setRawQuickImportText(e.target.value)}
              placeholder="Paste Question IDs here (e.g. P260000001, P260000002, C250000001)..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs sm:text-sm font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500 font-mono">
                {rawQuickImportText.trim() ? `${rawQuickImportText.split(/[\s,;\n\r\t]+/).filter(Boolean).length} IDs parsed` : "No IDs entered"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleValidateQuickImport}
                  disabled={validatingQuickImport || !rawQuickImportText.trim()}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">fact_check</span>
                  <span>{validatingQuickImport ? "Validating..." : "Validate IDs"}</span>
                </button>

                {quickImportSummary && quickImportSummary.eligibleCount > 0 && (
                  <button
                    type="button"
                    onClick={handleExecuteQuickImport}
                    disabled={importingQuickImport}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm shadow-blue-600/30"
                  >
                    <span className="material-symbols-outlined text-sm">cloud_download</span>
                    <span>{importingQuickImport ? "Importing..." : `Import ${quickImportSummary.eligibleCount} Question(s)`}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Validation Summary Box */}
          {quickImportSummary && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Total Parsed</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white font-mono">{quickImportSummary.totalInput}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-emerald-700 dark:text-emerald-300 block text-[10px]">Eligible to Import</span>
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">{quickImportSummary.eligibleCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <span className="text-amber-700 dark:text-amber-300 block text-[10px]">Already in DPP</span>
                  <span className="font-bold text-sm text-amber-600 dark:text-amber-400 font-mono">{quickImportSummary.duplicateInDppCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60">
                  <span className="text-rose-700 dark:text-rose-300 block text-[10px]">Invalid / Rejected</span>
                  <span className="font-bold text-sm text-rose-600 dark:text-rose-400 font-mono">
                    {quickImportSummary.notFoundCount + quickImportSummary.notApprovedCount}
                  </span>
                </div>
              </div>

              {/* Validation Items List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {quickImportSummary.items.map((item, idx) => (
                  <div key={idx} className="p-2.5 text-xs flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {item.normalizedId}
                        </span>
                        {item.subject && (
                          <span className="text-[10px] text-slate-500 font-semibold">{item.subject}</span>
                        )}
                        {item.difficulty && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {item.difficulty}
                          </span>
                        )}
                      </div>
                      {item.statementSnippet && (
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] truncate">
                          {item.statementSnippet}
                        </p>
                      )}
                      {item.error && (
                        <p className="text-rose-600 dark:text-rose-400 text-[10px] font-bold mt-0.5">
                          {item.error}
                        </p>
                      )}
                    </div>
                    <div>
                      {item.isEligible ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                          <span className="material-symbols-outlined text-xs">cancel</span>
                          Blocked
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Inline create mode */
        <div className="pt-2">
          <UnifiedQuestionEditor
            mode="dpp"
            dppId={dppId}
            onSaveSuccess={(created: any) => handleCreated(created?.id)}
          />
        </div>
      )}
    </div>
  );
}
