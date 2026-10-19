"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { api, answerText, optionEntries, SUBJECTS, type LibraryItem } from "./api-client";
import { AddToTargetDialog } from "./AddToTargetDialog";
import { PyqStyles } from "./PyqStyles";

type ExamNode = { id: string; name: string; canonicalType: string; total: number; years: { year: number | null; count: number }[] };
type Facets = { sessions: string[]; shifts: string[]; papers: string[]; chapters: { subject: string; chapter: string }[]; imports: { id: string; sourceName: string }[] };
type Page = { total: number; page: number; pageSize: number; items: LibraryItem[] };

/** The URL query is the single source of truth for filters (shareable, back-button safe). */
const FILTER_KEYS = ["exam", "years", "yearFrom", "yearTo", "subject", "chapter", "topic", "session", "shift", "paper", "verification", "job", "q", "sort"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const GROUPS: { type: string; label: string }[] = [
  { type: "NEET_UG", label: "NEET UG" },
  { type: "JEE_MAIN", label: "JEE Main" },
  { type: "JEE_ADVANCED", label: "JEE Advanced" },
  { type: "OTHER", label: "Other Exams" },
];

export function PyqLibraryWorkspace({ canImport, canBuildModules }: { canImport: boolean; canBuildModules: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [tree, setTree] = useState<ExamNode[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null | "MODULE" | "TEST" | "DPP">(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [openExams, setOpenExams] = useState<Set<string>>(new Set());

  const get = (k: FilterKey) => sp.get(k) ?? "";
  const page = Math.max(1, Number(sp.get("page") || 1));
  const filterQuery = useMemo(() => {
    const q = new URLSearchParams();
    for (const k of FILTER_KEYS) if (sp.get(k)) q.set(k, sp.get(k)!);
    return q.toString();
  }, [sp]);

  const setParams = useCallback(
    (patch: Partial<Record<FilterKey | "page", string | null>>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!("page" in patch)) next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [sp, router, pathname]
  );

  useEffect(() => {
    api<{ exams: ExamNode[] }>(`/api/team/pyq/exams?verification=${get("verification") || "VERIFIED"}`)
      .then((d) => setTree(d.exams))
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.get("verification")]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<Page>(`/api/team/pyq/library?${filterQuery}&page=${page}&pageSize=20`),
      api<Facets>(`/api/team/pyq/library?${filterQuery}&mode=facets`),
    ])
      .then(([d, f]) => {
        if (cancelled) return;
        setData(d);
        setFacets(f);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filterQuery, page]);

  // A different filter is a different result set — drop a stale selection.
  useEffect(() => setSelected(new Set()), [filterQuery]);

  const examName = (id: string) => tree.find((e) => e.id === id)?.name ?? id;
  const examIds = get("exam").split(",").filter(Boolean);
  const years = get("years").split(",").filter(Boolean);

  const chips: { label: string; clear: () => void }[] = [];
  if (examIds.length) chips.push({ label: `Exam: ${examIds.map(examName).join(", ")}`, clear: () => setParams({ exam: null }) });
  if (years.length) chips.push({ label: `Year: ${years.join(", ")}`, clear: () => setParams({ years: null }) });
  if (get("yearFrom") || get("yearTo")) chips.push({ label: `Years ${get("yearFrom") || "…"}–${get("yearTo") || "…"}`, clear: () => setParams({ yearFrom: null, yearTo: null }) });
  for (const [k, label] of [["subject", "Subject"], ["chapter", "Chapter"], ["topic", "Topic"], ["session", "Session"], ["shift", "Shift"], ["paper", "Paper"], ["q", "Search"]] as const) {
    if (get(k)) chips.push({ label: `${label}: ${get(k)}`, clear: () => setParams({ [k]: null, ...(k === "subject" ? { chapter: null } : {}) }) });
  }
  if (get("job")) chips.push({ label: `Import: ${facets?.imports.find((i) => i.id === get("job"))?.sourceName ?? "selected"}`, clear: () => setParams({ job: null }) });
  if (get("verification") && get("verification") !== "VERIFIED") chips.push({ label: get("verification") === "ALL" ? "Verified + unverified" : "Unverified only", clear: () => setParams({ verification: null }) });

  const chapterOptions = (facets?.chapters ?? []).filter((c) => !get("subject") || c.subject.toLowerCase() === get("subject").toLowerCase());
  const pageIds = data?.items.map((i) => i.id) ?? [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  async function selectAllMatching() {
    setSelectingAll(true);
    try {
      const res = await api<{ ids: string[]; total: number; capped: boolean }>(`/api/team/pyq/library?${filterQuery}&mode=ids`);
      setSelected(new Set(res.ids));
      if (res.capped) toast.warning(`Selected the first ${res.ids.length} of ${res.total} — narrow the filter to select all.`);
      else toast.success(`Selected all ${res.ids.length} matching questions.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSelectingAll(false);
    }
  }

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Exam -> Year tree */}
      <aside className="lg:w-64 shrink-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 h-fit lg:sticky lg:top-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">PYQ Library</h2>
          {canImport && (
            <Link href="/team/pyq-library/import" className="text-[11px] font-bold text-blue-600 hover:underline">
              + Import PDF
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => setParams({ exam: null, years: null, yearFrom: null, yearTo: null })}
          className={`w-full text-left text-xs px-2 py-1.5 rounded-lg font-semibold ${!examIds.length ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
        >
          All exams ({tree.reduce((n, e) => n + e.total, 0)})
        </button>
        {GROUPS.map((g) => {
          const exams = tree.filter((e) => (g.type === "OTHER" ? !["NEET_UG", "JEE_MAIN", "JEE_ADVANCED"].includes(e.canonicalType) : e.canonicalType === g.type));
          if (!exams.length) return null;
          return (
            <div key={g.type} className="mt-2">
              {g.type === "OTHER" && <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-2 mb-1">{g.label}</p>}
              {exams.map((e) => {
                const isOpen = openExams.has(e.id) || examIds.includes(e.id);
                const active = examIds.length === 1 && examIds[0] === e.id;
                return (
                  <div key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenExams((s) => toggle(s, e.id));
                        setParams({ exam: e.id, years: null });
                      }}
                      className={`w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg font-bold ${active && !years.length ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                    >
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">{isOpen ? "expand_more" : "chevron_right"}</span>
                        {e.name}
                      </span>
                      <span className="text-slate-400 font-mono">{e.total}</span>
                    </button>
                    {isOpen && (
                      <div className="ml-5 border-l border-slate-200 dark:border-slate-700">
                        {e.years.length === 0 && <p className="text-[11px] text-slate-400 px-2 py-1">No verified questions yet</p>}
                        {e.years.map((y) => {
                          const yActive = active && years.length === 1 && years[0] === String(y.year);
                          return (
                            <button
                              key={String(y.year)}
                              type="button"
                              disabled={y.year === null}
                              onClick={() => y.year !== null && setParams({ exam: e.id, years: String(y.year) })}
                              className={`w-full flex justify-between text-[11px] px-2 py-1 ${yActive ? "text-blue-700 font-bold dark:text-blue-300" : "text-slate-600 dark:text-slate-300 hover:text-blue-600"} disabled:opacity-60`}
                              title={y.year === null ? "Year not recorded — open the question to set it" : undefined}
                            >
                              <span>{y.year ?? "Year unknown"}</span>
                              <span className="font-mono text-slate-400">{y.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </aside>

      <section className="flex-1 min-w-0 space-y-3">
        {/* Filters */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 text-xs">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="font-bold text-slate-500">Search text / code</span>
            <input defaultValue={get("q")} key={`q-${get("q")}`} onKeyDown={(e) => e.key === "Enter" && setParams({ q: (e.target as HTMLInputElement).value.trim() || null })} placeholder="Type and press Enter" className="pyq-input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Years (comma)</span>
            <input defaultValue={get("years")} key={`y-${get("years")}`} onBlur={(e) => setParams({ years: e.target.value.replace(/[^\d,]/g, "") || null })} placeholder="2023,2024" className="pyq-input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Year from – to</span>
            <span className="flex gap-1">
              <input type="number" defaultValue={get("yearFrom")} key={`f-${get("yearFrom")}`} onBlur={(e) => setParams({ yearFrom: e.target.value || null })} placeholder="2020" className="pyq-input w-full" />
              <input type="number" defaultValue={get("yearTo")} key={`t-${get("yearTo")}`} onBlur={(e) => setParams({ yearTo: e.target.value || null })} placeholder="2025" className="pyq-input w-full" />
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Subject</span>
            <select value={get("subject")} onChange={(e) => setParams({ subject: e.target.value || null, chapter: null })} className="pyq-input">
              <option value="">All</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Chapter</span>
            <select value={get("chapter")} onChange={(e) => setParams({ chapter: e.target.value || null })} className="pyq-input">
              <option value="">All</option>
              {chapterOptions.map((c) => (
                <option key={`${c.subject}:${c.chapter}`} value={c.chapter}>
                  {get("subject") ? c.chapter : `${c.subject} — ${c.chapter}`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Topic</span>
            <input defaultValue={get("topic")} key={`tp-${get("topic")}`} onBlur={(e) => setParams({ topic: e.target.value.trim() || null })} className="pyq-input" />
          </label>
          {(["session", "shift", "paper"] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="font-bold text-slate-500 capitalize">{k}</span>
              <select value={get(k)} onChange={(e) => setParams({ [k]: e.target.value || null })} className="pyq-input">
                <option value="">All</option>
                {(k === "session" ? facets?.sessions : k === "shift" ? facets?.shifts : facets?.papers)?.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Verification</span>
            <select value={get("verification") || "VERIFIED"} onChange={(e) => setParams({ verification: e.target.value === "VERIFIED" ? null : e.target.value })} className="pyq-input">
              <option value="VERIFIED">Verified</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="ALL">Both</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Import batch</span>
            <select value={get("job")} onChange={(e) => setParams({ job: e.target.value || null })} className="pyq-input">
              <option value="">All</option>
              {facets?.imports.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sourceName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-slate-500">Sort</span>
            <select value={get("sort") || "year_desc"} onChange={(e) => setParams({ sort: e.target.value === "year_desc" ? null : e.target.value })} className="pyq-input">
              <option value="year_desc">Newest year</option>
              <option value="year_asc">Oldest year</option>
              <option value="chapter">Subject / chapter</option>
              <option value="recent">Recently added</option>
            </select>
          </label>
        </div>

        {/* Active filter chips + count */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-sm font-black text-slate-900 dark:text-white">{loading ? "Loading…" : `${data?.total ?? 0} question${data?.total === 1 ? "" : "s"}`}</span>
          {chips.map((c) => (
            <button key={c.label} type="button" onClick={c.clear} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              {c.label}
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          ))}
          {chips.length > 0 && (
            <button type="button" onClick={() => router.replace(pathname)} className="text-[11px] font-bold text-slate-500 hover:text-red-600">
              Clear all filters
            </button>
          )}
        </div>

        {/* Selection bar */}
        <div className="sticky top-0 z-10 flex items-center flex-wrap gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-2 text-xs">
          <label className="flex items-center gap-1.5 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={() =>
                setSelected((s) => {
                  const next = new Set(s);
                  if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
                  else pageIds.forEach((id) => next.add(id));
                  return next;
                })
              }
            />
            This page
          </label>
          <button type="button" disabled={selectingAll || !data?.total} onClick={selectAllMatching} className="font-bold text-blue-600 disabled:opacity-50">
            {selectingAll ? "Selecting…" : `Select all ${data?.total ?? 0} matching`}
          </button>
          <span className="font-bold text-slate-700 dark:text-slate-200">{selected.size} selected</span>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-slate-500 hover:text-red-600">
              Clear
            </button>
          )}
          <span className="flex-1" />
          {canBuildModules && (
            <button type="button" disabled={!selected.size} onClick={() => setDialog("MODULE")} className="pyq-btn-primary">
              Add to Module
            </button>
          )}
          <button type="button" disabled={!selected.size} onClick={() => setDialog("TEST")} className="pyq-btn">
            Add to Test
          </button>
          <button type="button" disabled={!selected.size} onClick={() => setDialog("DPP")} className="pyq-btn">
            Add to DPP
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && data && data.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
            No questions match these filters.{" "}
            {get("verification") !== "ALL" && (
              <button type="button" className="font-bold text-blue-600" onClick={() => setParams({ verification: "ALL" })}>
                Include unverified
              </button>
            )}
          </div>
        )}

        <ul className="space-y-2">
          {data?.items.map((q) => {
            const en = q.translations.find((t) => t.language === "ENGLISH") ?? q.translations[0];
            const isOpen = expanded.has(q.id);
            return (
              <li key={q.id} className={`rounded-2xl border bg-white dark:bg-slate-900 p-3 ${selected.has(q.id) ? "border-blue-400 ring-1 ring-blue-300" : "border-slate-200 dark:border-slate-800"}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1" checked={selected.has(q.id)} onChange={() => setSelected((s) => toggle(s, q.id))} aria-label="Select question" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] mb-1">
                      <span className="font-mono font-bold text-slate-500">{q.questionCode ?? q.id.slice(-6)}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {q.subject}
                        {q.chapter ? ` · ${q.chapter}` : " · (no chapter)"}
                        {q.topic ? ` · ${q.topic}` : ""}
                      </span>
                      {q.occurrences.map((o) => (
                        <span key={o.id} className={`px-2 py-0.5 rounded-full font-bold ${o.verificationStatus === "VERIFIED" ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" : "bg-slate-100 text-slate-500 border border-dashed border-slate-300"}`}>
                          {o.label}
                          {o.questionNumber ? ` · Q${o.questionNumber}` : ""}
                          {o.verificationStatus !== "VERIFIED" ? " (unverified)" : ""}
                        </span>
                      ))}
                      {!q.isPublished && q.status !== "PUBLISHED" && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">Draft — not usable in tests yet</span>}
                      <Link href={`/team/questions/${q.id}`} className="ml-auto text-blue-600 font-bold hover:underline">
                        Open
                      </Link>
                    </div>
                    <div className={`text-sm text-slate-900 dark:text-white [overflow-wrap:anywhere] ${isOpen ? "" : "line-clamp-3"}`}>
                      <FormulaText text={en?.statement ?? ""} className="block" />
                    </div>
                    {q.imageUrl && isOpen && (
                      // eslint-disable-next-line @next/next/no-img-element -- question diagram from object storage
                      <img src={q.imageUrl} alt="Question figure" className="max-h-48 my-2 rounded-lg border border-slate-200" />
                    )}
                    {isOpen && (
                      <div className="mt-2 grid sm:grid-cols-2 gap-1 text-xs">
                        {optionEntries(en?.options).map(([k, v]) => (
                          <div key={k} className="flex gap-1.5 [overflow-wrap:anywhere]">
                            <b>{k}.</b>
                            <FormulaText text={v} className="block" />
                          </div>
                        ))}
                        <p className="sm:col-span-2 font-bold text-emerald-700">Answer: {answerText(en?.correctOptionIds)}</p>
                        {(en?.solution || q.solution) && (
                          <div className="sm:col-span-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                            <FormulaText text={en?.solution || q.solution || ""} className="block" />
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={() => setExpanded((s) => toggle(s, q.id))} className="mt-1 text-[11px] font-bold text-slate-500 hover:text-blue-600">
                      {isOpen ? "Show less" : "Options, answer & solution"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-center gap-3 text-xs">
            <button type="button" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })} className="pyq-btn">
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(data.total / data.pageSize)}
            </span>
            <button type="button" disabled={page >= Math.ceil(data.total / data.pageSize)} onClick={() => setParams({ page: String(page + 1) })} className="pyq-btn">
              Next
            </button>
          </div>
        )}
      </section>

      {dialog && (
        <AddToTargetDialog
          target={dialog}
          questionIds={Array.from(selected)}
          prefer={{ examIds, years: years.map(Number) }}
          onClose={() => setDialog(null)}
          onDone={() => setSelected(new Set())}
        />
      )}

      <PyqStyles />
    </div>
  );
}
