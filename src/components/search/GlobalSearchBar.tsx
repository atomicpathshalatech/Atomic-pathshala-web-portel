"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight, Loader2 } from "lucide-react";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};
type SearchGroup = { type: string; label: string; results: SearchResult[] };

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
  }, [open]);

  const runSearch = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
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
      if (flatResults[activeIdx]) go(flatResults[activeIdx]);
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
            ? "flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
            : "group flex items-center gap-2 h-9 w-full max-w-md rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-left text-xs text-slate-400 hover:bg-white hover:border-slate-300 transition-colors"
        }
        aria-label="Open search"
        title="Search (Ctrl+K)"
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        {!compact && (
          <>
            <span className="flex-1 truncate">{PLACEHOLDER}</span>
            <kbd className="hidden md:inline text-[10px] font-mono font-semibold text-slate-400 border border-slate-200 bg-white rounded px-1.5 py-0.5 shadow-2xs">
              Ctrl K
            </kbd>
          </>
        )}
      </button>

      {!open ? null : (
        <div
          className="fixed inset-0 z-[999] flex items-start justify-center bg-slate-900/40 backdrop-blur-xs p-4 pt-[10vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Input row */}
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-3.5">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={PLACEHOLDER}
                className="flex-1 py-3 text-xs outline-none placeholder-slate-400 text-slate-900"
              />
              {loading && (
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-[11px] font-semibold px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {q.trim().length === 0 && (
                <div className="p-3 space-y-4">
                  <div>
                    <div className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Quick Command Actions
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { title: "Create Test", href: "/team/tests/new", icon: "quiz", badge: "Assessment" },
                        { title: "Add Question", href: "/team/questions/new", icon: "add_circle", badge: "Questions" },
                        { title: "Create Batch", href: "/team/batches", icon: "group_add", badge: "Academics" },
                        { title: "Schedule Class", href: "/team/my-schedule", icon: "calendar_add_on", badge: "Timetable" },
                        { title: "Onboard Student", href: "/team/students", icon: "person_add", badge: "Students" },
                        { title: "Add CRM Lead", href: "/team/leads", icon: "person_search", badge: "CRM" },
                      ].map((act) => (
                        <button
                          key={act.title}
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            router.push(act.href);
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-blue-50 text-left transition group border border-slate-100"
                        >
                          <span className="material-symbols-outlined text-[18px] text-blue-600 group-hover:scale-110 transition-transform">
                            {act.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-slate-800 truncate group-hover:text-blue-600">
                              {act.title}
                            </span>
                            <span className="block text-[10px] text-slate-400">{act.badge}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Frequently Accessed Modules
                    </div>
                    <div className="space-y-0.5">
                      {[
                        { title: "Question Bank & QC", href: "/team/questions", icon: "database", desc: "NEET & JEE Questions" },
                        { title: "Student Management & ID Cards", href: "/team/id-cards", icon: "badge", desc: "Verify and dispatch ID cards" },
                        { title: "Finance & Invoices", href: "/team/finance", icon: "payments", desc: "Transactions & payment reconciliation" },
                        { title: "Live Classroom (Studio)", href: "/team/live-studio", icon: "videocam", desc: "Start whiteboard live session" },
                      ].map((mod) => (
                        <button
                          key={mod.title}
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            router.push(mod.href);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-[18px] text-slate-400">
                              {mod.icon}
                            </span>
                            <div>
                              <span className="block text-xs font-bold text-slate-800">{mod.title}</span>
                              <span className="block text-[10px] text-slate-400">{mod.desc}</span>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-[14px] text-slate-300">
                            arrow_forward
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {groups.length === 0 && q.trim().length >= 2 && !loading && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">No matches found for &quot;{q}&quot;.</div>
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
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              ↑↓ navigate · Enter open · Esc close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
