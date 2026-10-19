"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { api, ApiError } from "./api-client";
import { PyqStyles } from "./PyqStyles";

type Occ = { id: string; year: number | null; session: string | null; shift: string | null; paper: string | null; exam: { name: string } };
type Item = {
  id: string;
  order: number;
  kind: "QUESTION" | "CUSTOM_QUESTION" | "NOTE";
  occurrenceId: string | null;
  content: { statement?: string; options?: Record<string, string>; answer?: string; solution?: string; text?: string } | null;
  presentation: { labelOverride?: string | null; pageBreakBefore?: boolean } | null;
  question: null | { id: string; questionCode: string | null; subject: string; chapter: string | null; translations: { language: string; statement: string }[]; pyqOccurrences: Occ[] };
};
type Section = { id: string; title: string; instructions: string | null; order: number; pageBreakBefore: boolean; items: Item[] };
type Module = {
  id: string;
  title: string;
  subtitle: string | null;
  subject: string | null;
  chapter: string | null;
  displayFormat: string;
  showSourceLabels: boolean;
  pageSize: string;
  coverPage: boolean;
  contentsPage: boolean;
  settings: { fontSizePt?: number; questionGapMm?: number } | null;
  sections: Section[];
};
type Warning = { level: "error" | "warning"; message: string };

const FORMATS: [string, string][] = [
  ["QUESTION_ONLY", "Questions only"],
  ["WITH_OPTIONS", "Questions with options"],
  ["ANSWER_KEY_END", "Answer key at the end"],
  ["SOLUTIONS_SECTION", "Answer key + detailed solutions section"],
  ["SOLUTION_AFTER_EACH", "Solution after each question"],
];

const occLabel = (o: Occ) => [o.exam.name, o.year, o.session, o.shift, o.paper].filter(Boolean).join(" ");

export function QuestionModuleEditor({ moduleId, canEdit }: { moduleId: string; canEdit: boolean }) {
  const [m, setM] = useState<Module | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [previewKey, setPreviewKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [adding, setAdding] = useState<null | { sectionId: string; afterItemId: string | null; kind: "CUSTOM_QUESTION" | "NOTE" }>(null);

  const load = useCallback(async () => {
    const d = await api<{ module: Module; warnings: Warning[] }>(`/api/team/pyq/modules/${moduleId}`);
    setM(d.module);
    setWarnings(d.warnings);
  }, [moduleId]);

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);

  const refresh = async () => {
    await load();
    setPreviewKey((k) => k + 1);
  };

  async function patchModule(data: Record<string, unknown>) {
    try {
      await api(`/api/team/pyq/modules/${moduleId}`, { method: "PATCH", json: data });
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function saveOrder(sections: Section[]) {
    setM((x) => (x ? { ...x, sections } : x));
    try {
      await api(`/api/team/pyq/modules/${moduleId}/items`, { method: "PUT", json: { layout: sections.map((s) => ({ sectionId: s.id, itemIds: s.items.map((i) => i.id) })) } });
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
      await load();
    }
  }

  function moveItem(si: number, ii: number, delta: number) {
    if (!m) return;
    const sections = m.sections.map((s) => ({ ...s, items: [...s.items] }));
    const items = sections[si]!.items;
    const j = ii + delta;
    if (j < 0 || j >= items.length) return;
    [items[ii], items[j]] = [items[j]!, items[ii]!];
    saveOrder(sections);
  }

  function moveToSection(si: number, ii: number, targetSectionId: string) {
    if (!m) return;
    const sections = m.sections.map((s) => ({ ...s, items: [...s.items] }));
    const [it] = sections[si]!.items.splice(ii, 1);
    sections.find((s) => s.id === targetSectionId)!.items.push(it!);
    saveOrder(sections);
  }

  function moveSection(si: number, delta: number) {
    if (!m) return;
    const sections = [...m.sections];
    const j = si + delta;
    if (j < 0 || j >= sections.length) return;
    [sections[si], sections[j]] = [sections[j]!, sections[si]!];
    saveOrder(sections);
  }

  async function call(url: string, method: string, json?: unknown) {
    try {
      await api(url, { method, json });
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function exportPdf(ignoreWarnings = false) {
    setExporting(true);
    try {
      const d = await api<{ url: string; pageCount: number | null }>(`/api/team/pyq/modules/${moduleId}/export`, { method: "POST", json: { ignoreWarnings } });
      toast.success(`PDF ready${d.pageCount ? ` — ${d.pageCount} pages` : ""}.`);
      window.open(d.url, "_blank", "noopener");
    } catch (e) {
      if (e instanceof ApiError && e.code === "PREFLIGHT_WARNINGS") {
        setWarnings((e.details?.warnings as Warning[]) ?? warnings);
        if (window.confirm(`${(e.details?.warnings as Warning[])?.length ?? 0} warning(s) — export anyway?`)) return exportPdf(true);
      } else if (e instanceof ApiError && e.code === "PREFLIGHT_FAILED") {
        setWarnings((e.details?.warnings as Warning[]) ?? warnings);
        toast.error(e.message);
      } else toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  if (!m) return <p className="p-4 text-sm text-slate-500">Loading module…</p>;
  let qNo = 0;

  return (
    <div className="grid xl:grid-cols-2 gap-4 text-sm">
      <PyqStyles />
      <div className="space-y-4 min-w-0">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <Link href="/team/pyq-modules" className="text-xs font-bold text-blue-600">
            ← Modules
          </Link>
          <input defaultValue={m.title} key={`t-${m.title}`} disabled={!canEdit} onBlur={(e) => e.target.value.trim() !== m.title && patchModule({ title: e.target.value.trim() })} className="pyq-input w-full text-base font-black" />
          <input defaultValue={m.subtitle ?? ""} key={`s-${m.subtitle}`} disabled={!canEdit} onBlur={(e) => patchModule({ subtitle: e.target.value.trim() || null })} placeholder="Subtitle (e.g. NEET UG 2015–2025)" className="pyq-input w-full" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
              <span className="font-bold text-slate-500">Display format</span>
              <select value={m.displayFormat} disabled={!canEdit} onChange={(e) => patchModule({ displayFormat: e.target.value })} className="pyq-input">
                {FORMATS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold text-slate-500">Page size</span>
              <select value={m.pageSize} disabled={!canEdit} onChange={(e) => patchModule({ pageSize: e.target.value })} className="pyq-input">
                <option>A4</option>
                <option>A5</option>
                <option>LETTER</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold text-slate-500">Font size (pt)</span>
              <input type="number" min={8} max={14} defaultValue={m.settings?.fontSizePt ?? 11} disabled={!canEdit} onBlur={(e) => patchModule({ settings: { ...(m.settings ?? {}), fontSizePt: Number(e.target.value) } })} className="pyq-input" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-bold text-slate-500">Gap after question (mm)</span>
              <input type="number" min={1} max={20} defaultValue={m.settings?.questionGapMm ?? 5} disabled={!canEdit} onBlur={(e) => patchModule({ settings: { ...(m.settings ?? {}), questionGapMm: Number(e.target.value) } })} className="pyq-input" />
            </label>
            {(
              [
                ["showSourceLabels", "Source labels (verified only)"],
                ["coverPage", "Cover page"],
                ["contentsPage", "Contents"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5 font-bold">
                <input type="checkbox" checked={m[k]} disabled={!canEdit} onChange={(e) => patchModule({ [k]: e.target.checked })} />
                {l}
              </label>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" disabled={exporting} onClick={() => exportPdf()} className="pyq-btn-primary">
              {exporting ? "Rendering PDF…" : "Export PDF"}
            </button>
            <Link href="/team/pyq-library" className="pyq-btn">
              Add questions from PYQ Library
            </Link>
            {canEdit && (
              <button type="button" onClick={() => call(`/api/team/pyq/modules/${moduleId}/sections`, "POST", { title: `Exercise ${m.sections.length + 1}` })} className="pyq-btn">
                + Exercise
              </button>
            )}
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i} className={w.level === "error" ? "text-red-700" : "text-amber-700"}>
                  {w.level === "error" ? "✖" : "⚠"} {w.message}
                </li>
              ))}
            </ul>
          )}
        </section>

        {m.sections.map((s, si) => (
          <section key={s.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400">Exercise {si + 1}</span>
              <input defaultValue={s.title} key={`st-${s.id}-${s.title}`} disabled={!canEdit} onBlur={(e) => e.target.value.trim() && e.target.value !== s.title && call(`/api/team/pyq/modules/${moduleId}/sections/${s.id}`, "PATCH", { title: e.target.value.trim() })} className="pyq-input flex-1 font-bold" />
              {canEdit && (
                <>
                  <button type="button" onClick={() => moveSection(si, -1)} className="pyq-btn" aria-label="Move exercise up">
                    ↑
                  </button>
                  <button type="button" onClick={() => moveSection(si, 1)} className="pyq-btn" aria-label="Move exercise down">
                    ↓
                  </button>
                  <button type="button" onClick={() => window.confirm(`Delete "${s.title}"? Its questions stay in the library.`) && call(`/api/team/pyq/modules/${moduleId}/sections/${s.id}`, "DELETE")} className="pyq-btn-danger">
                    Delete
                  </button>
                </>
              )}
            </div>
            <textarea defaultValue={s.instructions ?? ""} key={`si-${s.id}-${s.instructions}`} disabled={!canEdit} onBlur={(e) => e.target.value !== (s.instructions ?? "") && call(`/api/team/pyq/modules/${moduleId}/sections/${s.id}`, "PATCH", { instructions: e.target.value || null })} rows={2} placeholder="Instructions for this exercise (optional)" className="pyq-input w-full text-xs" />
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={s.pageBreakBefore} disabled={!canEdit} onChange={(e) => call(`/api/team/pyq/modules/${moduleId}/sections/${s.id}`, "PATCH", { pageBreakBefore: e.target.checked })} />
              Start on a new page
            </label>

            {s.items.length === 0 && <p className="text-xs text-slate-500">No questions yet — add them from the PYQ Library.</p>}
            <ol className="space-y-1.5">
              {s.items.map((it, ii) => {
                const isQ = it.kind !== "NOTE";
                if (isQ) qNo++;
                const statement = it.kind === "QUESTION" ? it.question?.translations.find((t) => t.language === "ENGLISH")?.statement ?? it.question?.translations[0]?.statement ?? "" : it.content?.statement ?? it.content?.text ?? "";
                return (
                  <li key={it.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-bold w-8 shrink-0">{isQ ? `${qNo}.` : "note"}</span>
                      <div className="flex-1 min-w-0 [overflow-wrap:anywhere]">
                        {it.kind === "QUESTION" && !it.question ? (
                          <span className="text-red-600 font-bold">This question was deleted from the Question Bank — remove it.</span>
                        ) : (
                          <div className="line-clamp-3">
                            <FormulaText text={statement} className="block" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] text-slate-500">
                          {it.kind === "CUSTOM_QUESTION" && <span className="font-bold text-violet-700">Custom question</span>}
                          {it.question && <span>{it.question.questionCode} · {it.question.chapter ?? it.question.subject}</span>}
                          {it.question && it.question.pyqOccurrences.length > 0 && canEdit && (
                            <select value={it.occurrenceId ?? ""} onChange={(e) => call(`/api/team/pyq/modules/${moduleId}/items/${it.id}`, "PATCH", { occurrenceId: e.target.value || null })} className="pyq-input py-0.5">
                              <option value="">No source label</option>
                              {it.question.pyqOccurrences.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {occLabel(o)}
                                </option>
                              ))}
                            </select>
                          )}
                          {canEdit && (
                            <label className="flex items-center gap-1">
                              <input type="checkbox" checked={Boolean(it.presentation?.pageBreakBefore)} onChange={(e) => call(`/api/team/pyq/modules/${moduleId}/items/${it.id}`, "PATCH", { presentation: { pageBreakBefore: e.target.checked } })} />
                              new page
                            </label>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => moveItem(si, ii, -1)} className="pyq-btn px-2" aria-label="Move up">
                              ↑
                            </button>
                            <button type="button" onClick={() => moveItem(si, ii, 1)} className="pyq-btn px-2" aria-label="Move down">
                              ↓
                            </button>
                            <button type="button" onClick={() => call(`/api/team/pyq/modules/${moduleId}/items/${it.id}`, "DELETE")} className="pyq-btn-danger px-2" aria-label="Remove from module" title="Remove from module (stays in the library)">
                              ✕
                            </button>
                          </div>
                          {m.sections.length > 1 && (
                            <select value="" onChange={(e) => e.target.value && moveToSection(si, ii, e.target.value)} className="pyq-input py-0.5">
                              <option value="">Move to…</option>
                              {m.sections.filter((x) => x.id !== s.id).map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.title}
                                </option>
                              ))}
                            </select>
                          )}
                          <button type="button" onClick={() => setAdding({ sectionId: s.id, afterItemId: it.id, kind: "CUSTOM_QUESTION" })} className="text-[10px] font-bold text-blue-600">
                            + question after
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {canEdit && (
              <div className="flex gap-2">
                <button type="button" onClick={() => setAdding({ sectionId: s.id, afterItemId: null, kind: "CUSTOM_QUESTION" })} className="pyq-btn">
                  + Custom question
                </button>
                <button type="button" onClick={() => setAdding({ sectionId: s.id, afterItemId: null, kind: "NOTE" })} className="pyq-btn">
                  + Heading / note
                </button>
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 xl:sticky xl:top-4 h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-2 py-1 text-xs">
          <span className="font-black">Print preview</span>
          <button type="button" onClick={() => setPreviewKey((k) => k + 1)} className="pyq-btn">
            Refresh
          </button>
        </div>
        <iframe key={previewKey} src={`/api/team/pyq/modules/${moduleId}/preview`} title="Module print preview" className="flex-1 w-full rounded-xl border border-slate-200 bg-white" />
      </section>

      {adding && (
        <CustomItemDialog
          kind={adding.kind}
          onClose={() => setAdding(null)}
          onSave={async (content) => {
            await call(`/api/team/pyq/modules/${moduleId}/items`, "POST", { kind: adding.kind, sectionId: adding.sectionId, afterItemId: adding.afterItemId, content });
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}

function CustomItemDialog({ kind, onSave, onClose }: { kind: "CUSTOM_QUESTION" | "NOTE"; onSave: (c: Record<string, unknown>) => void; onClose: () => void }) {
  const [f, setF] = useState({ statement: "", A: "", B: "", C: "", D: "", answer: "", solution: "", text: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-5 space-y-2 text-xs">
        <h3 className="font-black text-sm">{kind === "NOTE" ? "Heading / note" : "Custom question (only in this module)"}</h3>
        {kind === "NOTE" ? (
          <textarea value={f.text} onChange={set("text")} rows={3} className="pyq-input w-full" placeholder="e.g. Questions 1–10 are from Organic Chemistry" />
        ) : (
          <>
            <textarea value={f.statement} onChange={set("statement")} rows={3} className="pyq-input w-full" placeholder="Question (LaTeX in $…$ supported)" />
            {(["A", "B", "C", "D"] as const).map((k) => (
              <input key={k} value={f[k]} onChange={set(k)} placeholder={`Option ${k}`} className="pyq-input w-full" />
            ))}
            <input value={f.answer} onChange={set("answer")} placeholder="Answer (A / A,C)" className="pyq-input w-full" />
            <textarea value={f.solution} onChange={set("solution")} rows={2} className="pyq-input w-full" placeholder="Solution (optional)" />
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="pyq-btn">
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              kind === "NOTE"
                ? f.text.trim() && onSave({ text: f.text.trim() })
                : f.statement.trim() && onSave({ statement: f.statement.trim(), options: { A: f.A, B: f.B, C: f.C, D: f.D }, answer: f.answer.trim().toUpperCase() || undefined, solution: f.solution.trim() || undefined })
            }
            className="pyq-btn-primary"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
