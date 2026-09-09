"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};
type SearchGroup = { type: string; label: string; results: SearchResult[] };

type AiState = {
  loading: boolean;
  answer: string | null;
  sources: SearchResult[];
  error: string | null;
};

const PLACEHOLDER = "Search anything in Atomic Pathshala...";
const DEBOUNCE_MS = 220;

const TYPE_ICON: Record<string, string> = {
  teacher: "person",
  student: "school",
  team_member: "badge",
  batch: "groups",
  course: "menu_book",
  subject: "category",
  chapter: "article",
  lecture: "play_circle",
  module: "auto_stories",
  study_material: "picture_as_pdf",
  test_series: "assignment",
  test: "quiz",
  question: "help",
  class: "sensors",
  recording: "smart_display",
};

export function GlobalSearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [ai, setAi] = useState<AiState>({ loading: false, answer: null, sources: [], error: null });

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqSeq = useRef(0);

  const flatResults = groups.flatMap((g) => g.results);

  // ⌘K / Ctrl+K to open, Esc handled in the panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    // reset on close
    setQ("");
    setGroups([]);
    setActiveIdx(0);
    setAi({ loading: false, answer: null, sources: [], error: null });
  }, [open]);

  const runSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    setAi({ loading: false, answer: null, sources: [], error: null });
    if (trimmed.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const seq = ++reqSeq.current;
      try {
        const res = await fetch(`/api/search?mode=suggest&q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (seq !== reqSeq.current) return; // a newer request already landed
        setGroups(json?.data?.groups ?? []);
        setActiveIdx(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setGroups([]);
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  function onChange(value: string) {
    setQ(value);
    runSearch(value);
  }

  function go(result: SearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  async function askAi() {
    const query = q.trim();
    if (query.length < 3) return;
    setAi({ loading: true, answer: null, sources: [], error: null });
    try {
      const res = await fetch("/api/search/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setAi({ loading: false, answer: null, sources: [], error: json?.error ?? "AI search failed." });
        return;
      }
      setAi({
        loading: false,
        answer: json.data.answer,
        sources: json.data.sources ?? [],
        error: null,
      });
    } catch {
      setAi({ loading: false, answer: null, sources: [], error: "AI search failed." });
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, flatResults.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey || flatResults.length === 0) {
        askAi();
      } else if (flatResults[activeIdx]) {
        go(flatResults[activeIdx]);
      }
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
            : "group flex items-center gap-2 h-10 w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 hover:bg-white hover:border-slate-300 transition-colors"
        }
        aria-label="Open search"
        title="Search (Ctrl+K)"
      >
        <span className="material-symbols-outlined text-[20px]">search</span>
        {!compact && (
          <>
            <span className="flex-1 truncate">{PLACEHOLDER}</span>
            <kbd className="hidden md:inline text-[10px] font-sans font-semibold text-slate-400 border border-slate-200 rounded px-1 py-0.5">
              Ctrl K
            </kbd>
          </>
        )}
      </button>

      {!open ? null : (
        <div
          className="fixed inset-0 z-[999] flex items-start justify-center bg-slate-900/40 backdrop-blur-sm p-4 pt-[10vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
            {/* Input row */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              <span className="material-symbols-outlined text-slate-400 text-[22px]">search</span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={PLACEHOLDER}
                className="flex-1 py-3.5 text-sm outline-none placeholder-slate-400 text-slate-900"
              />
              {loading && (
                <span className="material-symbols-outlined text-slate-300 text-[20px] animate-spin">
                  progress_activity
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-1.5"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {/* AI answer block */}
              {(ai.loading || ai.answer || ai.error) && (
                <div className="m-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-600">
                    <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                    AI Answer
                  </div>
                  {ai.loading && <p className="mt-1 text-sm text-slate-500">Searching records…</p>}
                  {ai.error && <p className="mt-1 text-sm text-red-600">{ai.error}</p>}
                  {ai.answer && <p className="mt-1 text-sm text-slate-800 leading-relaxed">{ai.answer}</p>}
                  {ai.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ai.sources.map((s) => (
                        <button
                          key={`${s.type}-${s.id}`}
                          onClick={() => go(s)}
                          className="text-[11px] rounded-full bg-white border border-blue-200 px-2 py-0.5 text-blue-700 hover:bg-blue-100"
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Grouped results */}
              {groups.length === 0 && q.trim().length >= 2 && !loading && !ai.answer && !ai.loading && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  No matches. Press <b>Shift+Enter</b> to ask AI.
                </div>
              )}

              {groups.map((group) => (
                <div key={group.label} className="px-2 py-1.5">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {group.label}
                  </div>
                  {group.results.map((r) => {
                    const idx = flatResults.findIndex((x) => x.type === r.type && x.id === r.id);
                    return (
                      <button
                        key={`${r.type}-${r.id}`}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => go(r)}
                        className={`w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                          idx === activeIdx ? "bg-slate-100" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px] text-slate-400 shrink-0">
                          {TYPE_ICON[r.type] ?? "circle"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {r.title}
                          </span>
                          {r.subtitle && (
                            <span className="block truncate text-xs text-slate-400">{r.subtitle}</span>
                          )}
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-slate-300">
                          north_east
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              <span>↑↓ navigate · Enter open</span>
              <button
                type="button"
                onClick={askAi}
                disabled={q.trim().length < 3 || ai.loading}
                className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-300"
              >
                <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                Ask AI (Shift+Enter)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
