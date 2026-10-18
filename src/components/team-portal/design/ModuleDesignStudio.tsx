"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DESIGN_FONTS,
  PAGE_SIZES,
  SECTION_KINDS,
  TEMPLATE_STYLES,
  designSchema,
  pageBox,
  type DesignSection,
  type DesignTheme,
  type ModuleDesign,
  type SectionKind,
  type TemplateStyle,
} from "@/lib/module-studio/design/model";
import { KIND_INFO, STYLE_INFO, THEME_PRESETS, applyTemplateData, cloneSection, designToTemplateData, newSection } from "@/lib/module-studio/design/presets";
import { uploadFileToR2 } from "@/lib/storage/upload-client";
import { GraphicsEditor } from "./GraphicsEditor";

type Tab = "setup" | "theme" | "page" | "header" | "rules" | "output" | "templates";
const TABS: [Tab, string][] = [
  ["setup", "Setup"],
  ["theme", "Theme"],
  ["page", "Page"],
  ["header", "Header & footer"],
  ["rules", "Page breaks"],
  ["output", "Output"],
  ["templates", "Templates"],
];
const input = "w-full rounded-lg border border-outline-variant/50 px-2.5 py-1.5 text-label-sm bg-surface-container-lowest focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const btn = "rounded-lg border border-outline-variant/50 px-3 py-1.5 text-label-sm font-semibold hover:bg-surface-container-high disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const primaryBtn = "rounded-lg bg-primary text-on-primary px-4 py-2 text-label-sm font-bold hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-on-surface-variant mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-on-surface-variant mt-0.5">{hint}</span>}
    </label>
  );
}

type Issue = { category: string; severity: "error" | "warning" | "info"; message: string };
type Report = { warnings: string[]; issues?: Issue[]; sections: { id: string; title: string; firstPage: number; lastPage: number }[]; contents: { label: string; page: number | null }[] };

export function ModuleDesignStudio({ moduleId }: { moduleId: string }) {
  const [design, setDesignRaw] = useState<ModuleDesign | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("setup");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; pages: number; ms: number; report: Report | null } | null>(null);
  const [rendering, setRendering] = useState<null | "preview" | "check" | "export">(null);
  const [exported, setExported] = useState<{ fileUrl: string; pageCount: number; warnings: string[] } | null>(null);
  // Result of the last check (or of an export that found problems): shown until the design changes.
  const [checked, setChecked] = useState<{ issues: Issue[]; pageCount: number; forDesign: ModuleDesign | null; blocking: boolean } | null>(null);
  const [newKind, setNewKind] = useState<SectionKind>("THEORY");
  const revisionRef = useRef(0);
  const savedRef = useRef<ModuleDesign | null>(null);
  const designRef = useRef<ModuleDesign | null>(null);
  designRef.current = design;
  const history = useRef<{ stack: ModuleDesign[]; i: number }>({ stack: [], i: -1 });
  const [, bump] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/team/modules/${moduleId}/design`, { cache: "no-store" }).then((x) => x.json());
        if (!r.success) throw new Error(r.error || "Could not load the design.");
        revisionRef.current = r.data.revision;
        savedRef.current = r.data.isNew ? null : r.data.design;
        setSavedAt(r.data.savedAt);
        setDesignRaw(r.data.design);
        history.current = { stack: [r.data.design], i: 0 };
        setSelectedId(r.data.design.sections[0]?.id ?? null);
        if (r.data.repaired) toast.warning("The saved design was in an older format and was reset to a fresh design.");
      } catch (e: any) {
        setLoadError(e?.message || "Could not load the design.");
      }
    })();
  }, [moduleId]);

  // every change: one undo step once it settles
  const setDesign = useCallback((fn: (d: ModuleDesign) => ModuleDesign) => {
    setDesignRaw((d) => (d ? fn(d) : d));
  }, []);
  useEffect(() => {
    if (!design) return;
    const t = setTimeout(() => {
      const h = history.current;
      if (h.stack[h.i] === design) return;
      h.stack = [...h.stack.slice(0, h.i + 1), design].slice(-80);
      h.i = h.stack.length - 1;
      bump((n) => n + 1);
    }, 500);
    return () => clearTimeout(t);
  }, [design]);
  const step = (dir: -1 | 1) => {
    const h = history.current;
    if (designRef.current && h.stack[h.i] !== designRef.current) {
      h.stack = [...h.stack.slice(0, h.i + 1), designRef.current];
      h.i = h.stack.length - 1;
    }
    const i = h.i + dir;
    if (i < 0 || i >= h.stack.length) return;
    h.i = i;
    setDesignRaw(h.stack[i]!);
    bump((n) => n + 1);
  };

  // autosave (revision-checked)
  const saving = useRef<Promise<boolean>>(Promise.resolve(true));
  const save = useCallback(() => {
    const run = async () => {
      const d = designRef.current;
      if (!d || d === savedRef.current) return true;
      const check = designSchema.safeParse(d);
      if (!check.success) {
        setSaveState("error");
        return false;
      }
      setSaveState("saving");
      const res = await fetch(`/api/team/modules/${moduleId}/design`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseRevision: revisionRef.current, design: d }) }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (res?.status === 409) {
        setSaveState("conflict");
        return false;
      }
      if (!res?.ok || !body?.success) {
        setSaveState("error");
        return false;
      }
      revisionRef.current = body.data.revision;
      savedRef.current = d;
      setSavedAt(body.data.savedAt);
      setSaveState("saved");
      return true;
    };
    saving.current = saving.current.then(run, run);
    return saving.current;
  }, [moduleId]);
  useEffect(() => {
    if (!design || design === savedRef.current || saveState === "conflict") return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
  }, [design, save, saveState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        step(-1);
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        step(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  const sel = design?.sections.find((s) => s.id === selectedId) ?? null;
  const setSection = (id: string, patch: Partial<DesignSection>) => setDesign((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const box = design ? pageBox(design) : { w: 210, h: 297 };

  const render = async (mode: "preview" | "check" | "export", acknowledgeIssues = false) => {
    if (!design) return;
    const check = designSchema.safeParse(design);
    if (!check.success) return toast.error(`The design has an invalid value: ${check.error.issues[0]?.path.join(".")} — ${check.error.issues[0]?.message}`);
    setRendering(mode);
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/team/modules/${moduleId}/design/render`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, design, acknowledgeIssues }) });
      if (mode === "preview") {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
        const blob = await res.blob();
        let report: Report | null = null;
        try {
          report = JSON.parse(decodeURIComponent(res.headers.get("X-Design-Report") || ""));
        } catch {}
        setPreview({ url: URL.createObjectURL(blob), pages: Number(res.headers.get("X-Page-Count") || 0), ms: Math.round(performance.now() - t0), report });
      } else if (mode === "check") {
        const body = await res.json();
        if (!res.ok || !body.success) throw new Error(body?.error || `HTTP ${res.status}`);
        setChecked({ issues: body.data.issues, pageCount: body.data.pageCount, forDesign: design, blocking: false });
        toast[body.data.errors ? "warning" : "success"](body.data.errors ? `${body.data.errors} problem(s) to fix before export.` : "No problems found — ready to export.");
      } else {
        const body = await res.json();
        if (res.status === 409 && body?.code === "EXPORT_HAS_ISSUES") {
          setChecked({ issues: body.details.issues, pageCount: 0, forDesign: design, blocking: true });
          return;
        }
        if (!res.ok || !body.success) throw new Error(body?.error || `HTTP ${res.status}`);
        setChecked(null);
        setExported({ fileUrl: body.data.fileUrl, pageCount: body.data.pageCount, warnings: body.data.warnings });
        toast.success(`PDF exported (${body.data.pageCount} pages).`);
      }
    } catch (e: any) {
      toast.error(`${mode === "preview" ? "Preview" : mode === "check" ? "Check" : "Export"} failed: ${e?.message || e}`);
    } finally {
      setRendering(null);
    }
  };

  if (loadError) return <div className="p-6 text-red-600" role="alert">{loadError}</div>;
  if (!design) return <div className="p-6 text-on-surface-variant">Loading the design…</div>;

  const h = history.current;
  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-headline-md text-headline-md text-on-surface">Module design</h1>
          <span className="text-label-sm text-on-surface-variant truncate max-w-[30ch]">{design.setup.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-on-surface-variant" role="status" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved — check the values" : saveState === "conflict" ? "Changed elsewhere — not saved" : design !== savedRef.current ? "Unsaved changes" : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : ""}
          </span>
          <button type="button" className={btn} onClick={() => step(-1)} disabled={h.i <= 0} aria-label="Undo" title="Undo (Ctrl+Z)">
            <span className="material-symbols-outlined text-base">undo</span>
          </button>
          <button type="button" className={btn} onClick={() => step(1)} disabled={h.i >= h.stack.length - 1} aria-label="Redo" title="Redo (Ctrl+Y)">
            <span className="material-symbols-outlined text-base">redo</span>
          </button>
          <button type="button" className={btn} onClick={() => render("preview")} disabled={!!rendering}>
            {rendering === "preview" ? "Making preview…" : "Preview PDF"}
          </button>
          <button type="button" className={btn} onClick={() => render("check")} disabled={!!rendering} title="Finds cut-off or too-tall content, missing pictures and fonts, empty pages, wrong page sizes and unfinished imports">
            {rendering === "check" ? "Checking…" : "Check before export"}
          </button>
          <button type="button" className={primaryBtn} onClick={() => render("export")} disabled={!!rendering}>
            {rendering === "export" ? "Exporting…" : `Export ${design.output.mode === "PRINT" ? "print" : "digital"} PDF`}
          </button>
        </div>
      </header>
      {saveState === "conflict" && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 text-red-800 text-label-sm px-3 py-2 flex flex-wrap gap-3 items-center">
          This design was saved from another tab or by someone else after you opened it, so your latest changes are not saved.
          <button type="button" className={btn} onClick={() => window.location.reload()}>
            Load theirs
          </button>
          <button
            type="button"
            className={btn}
            onClick={async () => {
              const r = await fetch(`/api/team/modules/${moduleId}/design`, { cache: "no-store" }).then((x) => x.json());
              revisionRef.current = r.data.revision;
              savedRef.current = null;
              setSaveState("idle");
              await save();
            }}
          >
            Keep mine
          </button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        {/* Sections */}
        <aside className="space-y-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3" aria-label="Sections">
          <h2 className="text-label-md font-bold text-on-surface">Sections</h2>
          <ol className="space-y-1">
            {design.sections.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 border ${selectedId === s.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-surface-container-high"}`}>
                <input type="checkbox" checked={s.enabled} onChange={(e) => setSection(s.id, { enabled: e.target.checked })} aria-label={`Include ${s.title}`} />
                <button type="button" className="flex-1 text-left text-label-sm truncate" onClick={() => setSelectedId(s.id)}>
                  <span className={s.enabled ? "text-on-surface" : "text-on-surface-variant line-through"}>{s.title}</span>
                  <span className="block text-[10px] text-on-surface-variant">
                    {KIND_INFO[s.kind].label} · {STYLE_INFO[s.style].label}
                  </span>
                </button>
                <button type="button" className="p-0.5 disabled:opacity-20" disabled={i === 0 || s.kind === "COVER" || design.sections[i - 1]?.kind === "COVER"} onClick={() => setDesign((d) => { const a = d.sections.slice(); [a[i - 1], a[i]] = [a[i]!, a[i - 1]!]; return { ...d, sections: a }; })} aria-label={`Move ${s.title} up`}>
                  <span className="material-symbols-outlined text-sm">arrow_upward</span>
                </button>
                <button type="button" className="p-0.5 disabled:opacity-20" disabled={i === design.sections.length - 1 || s.kind === "COVER"} onClick={() => setDesign((d) => { const a = d.sections.slice(); [a[i + 1], a[i]] = [a[i]!, a[i + 1]!]; return { ...d, sections: a }; })} aria-label={`Move ${s.title} down`}>
                  <span className="material-symbols-outlined text-sm">arrow_downward</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex gap-1.5">
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as SectionKind)} className={input} aria-label="New section type">
              {SECTION_KINDS.filter((k) => k !== "COVER" || !design.sections.some((s) => s.kind === "COVER")).map((k) => (
                <option key={k} value={k}>
                  {KIND_INFO[k].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={btn}
              onClick={() => {
                const s = newSection(newKind);
                setDesign((d) => ({ ...d, sections: newKind === "COVER" ? [s, ...d.sections] : [...d.sections, s] }));
                setSelectedId(s.id);
              }}
            >
              Add
            </button>
          </div>

          {sel && (
            <div className="space-y-2.5 pt-3 border-t border-outline-variant/40">
              <div className="flex items-center justify-between">
                <h3 className="text-label-sm font-bold text-on-surface">{KIND_INFO[sel.kind].label}</h3>
                <div className="flex gap-1">
                  {sel.kind !== "COVER" && (
                    <button
                      type="button"
                      className={btn}
                      onClick={() => {
                        const c = cloneSection(sel);
                        setDesign((d) => {
                          const i = d.sections.findIndex((s) => s.id === sel.id);
                          const a = d.sections.slice();
                          a.splice(i + 1, 0, c);
                          return { ...d, sections: a };
                        });
                        setSelectedId(c.id);
                      }}
                      title="Duplicate this section (e.g. a second question set for another page range)"
                    >
                      Duplicate
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${btn} text-red-600`}
                    disabled={design.sections.length <= 1}
                    onClick={() => {
                      setDesign((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== sel.id) }));
                      setSelectedId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-on-surface-variant">{KIND_INFO[sel.kind].description}</p>
              <Field label="Title">
                <input className={input} value={sel.title} onChange={(e) => setSection(sel.id, { title: e.target.value })} />
              </Field>
              <Field label="Template style">
                <div className="grid grid-cols-2 gap-1.5">
                  {TEMPLATE_STYLES.map((st) => (
                    <button key={st} type="button" onClick={() => setSection(sel.id, { style: st })} className={`rounded-lg border px-2 py-1.5 text-left ${sel.style === st ? "border-primary bg-primary/10" : "border-outline-variant/40"}`} aria-pressed={sel.style === st}>
                      <span className="block text-[11px] font-bold">{STYLE_INFO[st].label}</span>
                      <span className="block text-[10px] text-on-surface-variant leading-snug">{STYLE_INFO[st].description}</span>
                    </button>
                  ))}
                </div>
              </Field>
              {sel.kind !== "COVER" && sel.kind !== "CONTENTS" && (
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Columns">
                    <select className={input} value={sel.columns} onChange={(e) => setSection(sel.id, { columns: Number(e.target.value) as 1 | 2 })}>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </Field>
                  <Field label="From page">
                    <input className={input} type="number" min={1} value={sel.fromPage ?? ""} placeholder="all" onChange={(e) => setSection(sel.id, { fromPage: e.target.value ? Math.max(1, Number(e.target.value)) : null })} />
                  </Field>
                  <Field label="To page">
                    <input className={input} type="number" min={1} value={sel.toPage ?? ""} placeholder="all" onChange={(e) => setSection(sel.id, { toPage: e.target.value ? Math.max(1, Number(e.target.value)) : null })} />
                  </Field>
                </div>
              )}
              {["CHAPTER_INTRO", "SUMMARY", "FORMULA_SHEET", "REVISION"].includes(sel.kind) && (
                <Field label="Your text for this section" hint="Supports $maths$ and **bold**. Blank lines start a new paragraph.">
                  <textarea className={input} rows={4} value={sel.note ?? ""} onChange={(e) => setSection(sel.id, { note: e.target.value })} />
                </Field>
              )}
              <ThemeOverride section={sel} base={design.theme} onChange={(o) => setSection(sel.id, { themeOverride: o })} />
              <div className="pt-2 border-t border-outline-variant/30">
                <h4 className="text-[11px] font-bold mb-1.5">{sel.kind === "COVER" ? "Cover graphics" : "Master page graphics (on every page of this section)"}</h4>
                <GraphicsEditor key={sel.id} graphics={sel.graphics} onChange={(g) => setSection(sel.id, { graphics: g })} page={box} logoUrl={design.setup.logoUrl} moduleId={moduleId} label={sel.title} />
              </div>
            </div>
          )}
        </aside>

        {/* Preview */}
        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 space-y-2 min-h-[70vh]" aria-label="Preview">
          {checked && (
            <div role={checked.blocking ? "alert" : "status"} className={`rounded-lg border text-[11px] px-3 py-2 space-y-1.5 ${checked.issues.some((i) => i.severity === "error") ? "border-red-300 bg-red-50 text-red-900" : "border-green-300 bg-green-50 text-green-900"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-label-sm">
                  {checked.blocking ? "Export paused — please look at these first" : "Check before export"}
                  {checked.forDesign !== design ? " (the design changed since — check again)" : ""}
                </span>
                {checked.blocking && (
                  <span className="flex gap-1.5">
                    <button type="button" className={btn} onClick={() => setChecked(null)}>Fix first</button>
                    <button type="button" className={primaryBtn} onClick={() => render("export", true)} disabled={!!rendering}>Export anyway</button>
                  </span>
                )}
              </div>
              {checked.issues.length === 0 ? (
                <p>No problems found{checked.pageCount ? ` — ${checked.pageCount} pages` : ""}.</p>
              ) : (
                <ul className="space-y-1">
                  {[...checked.issues].sort((a, b) => ["error", "warning", "info"].indexOf(a.severity) - ["error", "warning", "info"].indexOf(b.severity)).map((i, k) => (
                    <li key={k} className="flex gap-2">
                      <span className={`shrink-0 rounded px-1.5 font-bold uppercase text-[9px] leading-5 ${i.severity === "error" ? "bg-red-600 text-white" : i.severity === "warning" ? "bg-amber-500 text-white" : "bg-slate-300 text-slate-800"}`}>{i.severity}</span>
                      <span>{i.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {exported && (
            <div className="rounded-lg bg-green-50 border border-green-200 text-green-900 text-label-sm px-3 py-2">
              Exported {exported.pageCount} pages —{" "}
              <a className="underline font-semibold" href={exported.fileUrl} target="_blank" rel="noreferrer">
                open the PDF
              </a>
            </div>
          )}
          {preview ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-on-surface-variant">
                <span className="font-semibold text-on-surface">{preview.pages} pages</span>
                <span>made in {(preview.ms / 1000).toFixed(1)} s</span>
                {preview.report?.sections && <span>{preview.report.sections.map((s) => `${s.title} p.${s.firstPage}${s.lastPage > s.firstPage ? `–${s.lastPage}` : ""}`).join(" · ")}</span>}
              </div>
              {!!preview.report?.warnings?.length && (
                <details open className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-[11px] px-3 py-2">
                  <summary className="font-semibold cursor-pointer">{preview.report.warnings.length} thing(s) to check</summary>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {preview.report.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
              <iframe src={preview.url} title="PDF preview" className="w-full h-[75vh] rounded-lg border border-outline-variant/40 bg-white" />
            </>
          ) : (
            <div className="h-full min-h-[60vh] flex flex-col items-center justify-center text-center text-on-surface-variant gap-2">
              <span className="material-symbols-outlined text-4xl opacity-50">picture_as_pdf</span>
              <p className="text-label-sm max-w-sm">Press “Preview PDF” to see the real PDF this design makes from the module&apos;s blocks (it takes a few seconds).</p>
            </div>
          )}
        </section>

        {/* Settings */}
        <aside className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 space-y-3" aria-label="Design settings">
          <div className="flex flex-wrap gap-1" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tab === id ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="space-y-2.5">
            {tab === "setup" && <SetupPanel design={design} setDesign={setDesign} moduleId={moduleId} />}
            {tab === "theme" && <ThemePanel design={design} setDesign={setDesign} />}
            {tab === "page" && <PagePanel design={design} setDesign={setDesign} />}
            {tab === "header" && <HeaderPanel design={design} setDesign={setDesign} moduleId={moduleId} />}
            {tab === "rules" && <RulesPanel design={design} setDesign={setDesign} moduleId={moduleId} />}
            {tab === "output" && <OutputPanel design={design} setDesign={setDesign} />}
            {tab === "templates" && <TemplatesPanel design={design} setDesign={setDesign} moduleId={moduleId} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

type PanelProps = { design: ModuleDesign; setDesign: (fn: (d: ModuleDesign) => ModuleDesign) => void; moduleId?: string };

function SetupPanel({ design, setDesign, moduleId }: PanelProps) {
  const s = design.setup;
  const set = (patch: Partial<ModuleDesign["setup"]>) => setDesign((d) => ({ ...d, setup: { ...d.setup, ...patch } }));
  const [opts, setOpts] = useState<{ classes: { id: string; name: string; subjects: { id: string; name: string; nameHindi: string | null }[] }[]; batches: { id: string; name: string }[] } | null>(null);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapters, setChapters] = useState<{ id: string; chapterNumber: number; title: string; titleHindi: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    fetch("/api/team/modules/design-options").then((r) => r.json()).then((r) => {
      if (!r.success) return;
      setOpts(r.data);
      const c = r.data.classes.find((x: any) => x.name === s.className);
      if (c) {
        setClassId(c.id);
        const sub = c.subjects.find((x: any) => x.name === s.subject);
        if (sub) setSubjectId(sub.id);
      }
    });
  }, []);
  useEffect(() => {
    if (!subjectId) return setChapters([]);
    fetch(`/api/team/modules/design-options?subjectId=${subjectId}`).then((r) => r.json()).then((r) => r.success && setChapters(r.data.chapters));
  }, [subjectId]);
  const cls = opts?.classes.find((c) => c.id === classId);
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Class">
          <select className={input} value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(""); set({ className: opts?.classes.find((c) => c.id === e.target.value)?.name ?? "" }); }}>
            <option value="">{opts ? (opts.classes.length ? "Choose…" : "No classes in the database") : "Loading…"}</option>
            {opts?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Subject">
          <select className={input} value={subjectId} disabled={!cls} onChange={(e) => { setSubjectId(e.target.value); set({ subject: cls?.subjects.find((x) => x.id === e.target.value)?.name ?? "", chapterRef: null }); }}>
            <option value="">{cls ? "Choose…" : "Pick a class"}</option>
            {cls?.subjects.map((x) => <option key={x.id} value={x.id}>{x.name}{x.nameHindi ? ` (${x.nameHindi})` : ""}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Chapter" hint={subjectId && !chapters.length ? "This subject has no chapters in the database — type the name below." : undefined}>
        <select
          className={input}
          value={s.chapterRef ?? ""}
          disabled={!chapters.length}
          onChange={(e) => {
            const ch = chapters.find((c) => c.id === e.target.value);
            set({ chapterRef: ch?.id ?? null, chapterName: ch ? (s.language === "HINDI" && ch.titleHindi ? ch.titleHindi : ch.title) : s.chapterName });
          }}
        >
          <option value="">{chapters.length ? "Choose…" : "—"}</option>
          {chapters.map((c) => <option key={c.id} value={c.id}>{c.chapterNumber}. {c.title}{c.titleHindi ? ` / ${c.titleHindi}` : ""}</option>)}
        </select>
      </Field>
      <Field label="Chapter name (custom)" hint="Shown on the cover and in the header ({chapter}).">
        <input className={input} value={s.chapterName} onChange={(e) => set({ chapterName: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Subject (as printed)">
          <input className={input} value={s.subject} onChange={(e) => set({ subject: e.target.value })} />
        </Field>
        <Field label="Batch">
          <input className={input} list="design-batches" value={s.batch} onChange={(e) => set({ batch: e.target.value })} />
          <datalist id="design-batches">{opts?.batches.map((b) => <option key={b.id} value={b.name} />)}</datalist>
        </Field>
        <Field label="Module number">
          <input className={input} value={s.moduleNumber} onChange={(e) => set({ moduleNumber: e.target.value })} />
        </Field>
        <Field label="Academic session">
          <input className={input} value={s.session} placeholder="2026-27" onChange={(e) => set({ session: e.target.value })} />
        </Field>
      </div>
      <Field label="Module title">
        <input className={input} value={s.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="Teacher / author">
        <input className={input} value={s.author} onChange={(e) => set({ author: e.target.value })} />
      </Field>
      <Field label="Language">
        <select className={input} value={s.language} onChange={(e) => set({ language: e.target.value as any })}>
          <option value="ENGLISH">English</option>
          <option value="HINDI">Hindi</option>
          <option value="BILINGUAL">Bilingual</option>
        </select>
      </Field>
      <Field label="Logo">
        <div className="flex items-center gap-2">
          {s.logoUrl && <img src={s.logoUrl} alt="Logo" className="h-10 w-10 object-contain border rounded" />}
          <label className={`${btn} cursor-pointer`}>
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { const r = await uploadFileToR2(f, { prefix: "modules", fileType: "IMAGE", visibility: "PUBLIC", entityId: moduleId }); if (r.url) set({ logoUrl: r.url }); } catch (err: any) { toast.error(`Upload failed: ${err?.message ?? err}`); } finally { setUploading(false); } }} />
            {uploading ? "Uploading…" : s.logoUrl ? "Replace" : "Upload"}
          </label>
          {s.logoUrl && <button type="button" className={btn} onClick={() => set({ logoUrl: null })}>Remove</button>}
        </div>
      </Field>
    </div>
  );
}

function ThemeFields({ theme, onChange }: { theme: Partial<DesignTheme>; onChange: (p: Partial<DesignTheme>) => void }) {
  const color = (k: keyof DesignTheme, label: string) => (
    <Field label={label}>
      <input type="color" className="h-8 w-full rounded" value={(theme[k] as string) ?? "#000000"} onChange={(e) => onChange({ [k]: e.target.value })} />
    </Field>
  );
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {color("primary", "Main")}
        {color("deep", "Dark")}
        {color("accent", "Accent")}
        {color("soft", "Light tint")}
        {color("ink", "Text")}
        {color("paper", "Paper")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Heading font">
          <select className={input} value={theme.headingFont} onChange={(e) => onChange({ headingFont: e.target.value as any })}>
            {DESIGN_FONTS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Body font">
          <select className={input} value={theme.bodyFont} onChange={(e) => onChange({ bodyFont: e.target.value as any })}>
            {DESIGN_FONTS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
        <Field label={`Text size ${theme.baseSizePt}pt`}>
          <input type="range" min={8} max={14} step={0.5} value={theme.baseSizePt} onChange={(e) => onChange({ baseSizePt: Number(e.target.value) })} className="w-full" />
        </Field>
        <Field label={`Line spacing ${theme.lineHeight}`}>
          <input type="range" min={1.1} max={2.2} step={0.05} value={theme.lineHeight} onChange={(e) => onChange({ lineHeight: Number(e.target.value) })} className="w-full" />
        </Field>
        <Field label={`Corner radius ${theme.radiusMm} mm`}>
          <input type="range" min={0} max={8} step={0.5} value={theme.radiusMm} onChange={(e) => onChange({ radiusMm: Number(e.target.value) })} className="w-full" />
        </Field>
        <Field label={`Border ${theme.borderWidthPt} pt`}>
          <input type="range" min={0} max={4} step={0.2} value={theme.borderWidthPt} onChange={(e) => onChange({ borderWidthPt: Number(e.target.value) })} className="w-full" />
        </Field>
        <Field label="Border style">
          <select className={input} value={theme.borderStyle} onChange={(e) => onChange({ borderStyle: e.target.value as any })}>
            {["solid", "dashed", "dotted", "double", "none"].map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Page background">
          <select className={input} value={theme.background} onChange={(e) => onChange({ background: e.target.value as any })}>
            {[["PLAIN", "Plain"], ["TINT", "Light tint"], ["GRID", "Grid"], ["LINES", "Ruled lines"], ["DOTS", "Dots"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
    </div>
  );
}

function ThemePanel({ design, setDesign }: PanelProps) {
  return (
    <div className="space-y-3">
      <Field label="Subject theme (applies to the whole module)">
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(THEME_PRESETS).map(([id, t]) => (
            <button
              key={id}
              type="button"
              aria-pressed={design.themeId === id}
              onClick={() => setDesign((d) => ({ ...d, themeId: id, theme: { ...t }, sections: d.sections.map((s) => ({ ...s, themeOverride: undefined })) }))}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] ${design.themeId === id ? "border-primary bg-primary/10" : "border-outline-variant/40"}`}
            >
              <span className="w-4 h-4 rounded-full shrink-0" style={{ background: t.primary }} />
              <span className="w-4 h-4 rounded-full shrink-0 -ml-3 border-2 border-white" style={{ background: t.accent }} />
              {t.name}
            </button>
          ))}
        </div>
        <span className="block text-[10px] text-on-surface-variant mt-1">Choosing a theme here also clears the per-section colour overrides.</span>
      </Field>
      <ThemeFields theme={design.theme} onChange={(p) => setDesign((d) => ({ ...d, themeId: "CUSTOM", theme: { ...d.theme, ...p } }))} />
    </div>
  );
}

function ThemeOverride({ section, base, onChange }: { section: DesignSection; base: DesignTheme; onChange: (o: Partial<DesignTheme> | undefined) => void }) {
  const on = !!section.themeOverride;
  return (
    <div className="pt-2 border-t border-outline-variant/30 space-y-2">
      <label className="flex items-center gap-2 text-[11px] font-semibold">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? { primary: base.primary, accent: base.accent } : undefined)} />
        Different look for this section
      </label>
      {on && <ThemeFields theme={{ ...base, ...section.themeOverride }} onChange={(p) => onChange({ ...section.themeOverride, ...p })} />}
    </div>
  );
}

function PagePanel({ design, setDesign }: PanelProps) {
  const p = design.page;
  const set = (patch: Partial<ModuleDesign["page"]>) => setDesign((d) => ({ ...d, page: { ...d.page, ...patch } }));
  const m = (k: keyof ModuleDesign["page"], label: string) => (
    <Field label={`${label} (mm)`}>
      <input className={input} type="number" min={5} max={50} value={p[k] as number} onChange={(e) => set({ [k]: Math.min(50, Math.max(5, Number(e.target.value) || 5)) })} />
    </Field>
  );
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Page size">
          <select
            className={input}
            value={p.size}
            onChange={(e) => {
              const size = e.target.value as ModuleDesign["page"]["size"];
              const dims = size === "CUSTOM" ? [p.widthMm, p.heightMm] : PAGE_SIZES[size];
              set({ size, widthMm: dims[0]!, heightMm: dims[1]! });
            }}
          >
            {["A4", "A5", "B5", "LETTER", "LEGAL", "CUSTOM"].map((s) => <option key={s} value={s}>{s === "LETTER" ? "Letter" : s === "LEGAL" ? "Legal" : s === "CUSTOM" ? "Custom" : s}</option>)}
          </select>
        </Field>
        <Field label="Orientation">
          <select className={input} value={p.orientation} onChange={(e) => set({ orientation: e.target.value as any })}>
            <option value="PORTRAIT">Portrait</option>
            <option value="LANDSCAPE">Landscape</option>
          </select>
        </Field>
        {p.size === "CUSTOM" && (
          <>
            <Field label="Width (mm)"><input className={input} type="number" min={90} max={500} value={p.widthMm} onChange={(e) => set({ widthMm: Number(e.target.value) })} /></Field>
            <Field label="Height (mm)"><input className={input} type="number" min={90} max={700} value={p.heightMm} onChange={(e) => set({ heightMm: Number(e.target.value) })} /></Field>
          </>
        )}
        {m("marginTopMm", "Top margin")}
        {m("marginBottomMm", "Bottom margin")}
        {m("marginLeftMm", "Left margin")}
        {m("marginRightMm", "Right margin")}
      </div>
      <p className="text-[10px] text-on-surface-variant">The header and footer sit in the top and bottom margins — keep them at least 12 mm.</p>
    </div>
  );
}

function HeaderPanel({ design, setDesign, moduleId }: PanelProps) {
  const hf = design.headerFooter;
  const set = (patch: Partial<ModuleDesign["headerFooter"]>) => setDesign((d) => ({ ...d, headerFooter: { ...d.headerFooter, ...patch } }));
  const wm = design.watermark;
  const setWm = (patch: Partial<ModuleDesign["watermark"]>) => setDesign((d) => ({ ...d, watermark: { ...d.watermark, ...patch } }));
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] text-on-surface-variant">Labels fill in automatically: {"{title} {chapter} {subject} {class} {batch} {module} {author} {session} {page} {pages}"}. Shown on every page after the cover; Hindi works here.</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Header left"><input className={input} value={hf.headerLeft} onChange={(e) => set({ headerLeft: e.target.value })} /></Field>
        <Field label="Header right"><input className={input} value={hf.headerRight} onChange={(e) => set({ headerRight: e.target.value })} /></Field>
        <Field label="Footer left"><input className={input} value={hf.footerLeft} onChange={(e) => set({ footerLeft: e.target.value })} /></Field>
        <Field label="Footer right"><input className={input} value={hf.footerRight} onChange={(e) => set({ footerRight: e.target.value })} /></Field>
      </div>
      <label className="flex items-center gap-2 text-label-sm">
        <input type="checkbox" checked={hf.numbering === "ARABIC"} onChange={(e) => set({ numbering: e.target.checked ? "ARABIC" : "NONE" })} />
        Page numbers (counting from the first page after the cover)
      </label>
      <div className="pt-2 border-t border-outline-variant/30 space-y-2">
        <label className="flex items-center gap-2 text-label-sm font-semibold">
          <input type="checkbox" checked={wm.enabled} onChange={(e) => setWm({ enabled: e.target.checked })} />
          Watermark on every page after the cover
        </label>
        {wm.enabled && (
          <>
            <Field label="Text" hint="English letters only (drawn on every page with the built-in PDF font); for Hindi use a picture.">
              <input className={input} value={wm.text} onChange={(e) => setWm({ text: e.target.value })} />
            </Field>
            <Field label="Or a picture (PNG/JPEG)">
              <div className="flex items-center gap-2">
                {wm.imageUrl && <img src={wm.imageUrl} alt="" className="h-8 border rounded" />}
                <label className={`${btn} cursor-pointer`}>
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = await uploadFileToR2(f, { prefix: "modules", fileType: "IMAGE", visibility: "PUBLIC", entityId: moduleId }); if (r.url) setWm({ imageUrl: r.url }); }} />
                  Upload
                </label>
                {wm.imageUrl && <button type="button" className={btn} onClick={() => setWm({ imageUrl: null })}>Remove</button>}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={`Strength ${Math.round(wm.opacity * 100)}%`}><input type="range" min={0.02} max={0.4} step={0.01} value={wm.opacity} onChange={(e) => setWm({ opacity: Number(e.target.value) })} className="w-full" /></Field>
              <Field label={`Angle ${wm.angle}°`}><input type="range" min={-90} max={90} step={5} value={wm.angle} onChange={(e) => setWm({ angle: Number(e.target.value) })} className="w-full" /></Field>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RulesPanel({ design, setDesign, moduleId }: PanelProps) {
  const r = design.rules;
  const set = (patch: Partial<ModuleDesign["rules"]>) => setDesign((d) => ({ ...d, rules: { ...d.rules, ...patch } }));
  const row = (k: keyof ModuleDesign["rules"], label: string) => (
    <label className="flex items-start gap-2 text-label-sm">
      <input type="checkbox" className="mt-0.5" checked={r[k]} onChange={(e) => set({ [k]: e.target.checked })} />
      {label}
    </label>
  );
  return (
    <div className="space-y-2">
      {row("keepQuestionTogether", "Keep each question (text and options) on one page")}
      {row("keepOptionsTogether", "Keep the options together when a question must split")}
      {row("keepSolutionHeading", "Keep “Solution” with its solution")}
      {row("headingWithNext", "Keep headings with the text that follows")}
      {row("avoidSplittingTables", "Avoid splitting tables")}
      {row("avoidSplittingFigures", "Avoid splitting pictures")}
      <p className="text-[11px] text-on-surface-variant">A block that is taller than a whole page continues on the next page and is listed in the preview report — nothing is cut off.</p>
      <p className="text-[11px] text-on-surface-variant">
        Manual page breaks, “keep / allow split” for one block, and text wrapping around a picture are set per block in the{" "}
        <Link href={`/team/modules/${moduleId}/blocks`} className="text-primary underline">block editor</Link> (Layout in the designed PDF).
      </p>
    </div>
  );
}

function OutputPanel({ design, setDesign }: PanelProps) {
  const o = design.output;
  const set = (patch: Partial<ModuleDesign["output"]>) => setDesign((d) => ({ ...d, output: { ...d.output, ...patch } }));
  return (
    <div className="space-y-2.5">
      <Field label="PDF for">
        <div className="grid grid-cols-2 gap-1.5">
          {([["DIGITAL", "Screen / sharing", "Exact page size, no print marks."], ["PRINT", "Printing press", "Optional bleed and crop marks, trim box set."]] as const).map(([v, l, dsc]) => (
            <button key={v} type="button" aria-pressed={o.mode === v} onClick={() => set({ mode: v, ...(v === "PRINT" && !o.bleedMm ? { bleedMm: 3, cropMarks: true } : {}) })} className={`rounded-lg border px-2 py-1.5 text-left ${o.mode === v ? "border-primary bg-primary/10" : "border-outline-variant/40"}`}>
              <span className="block text-[11px] font-bold">{l}</span>
              <span className="block text-[10px] text-on-surface-variant">{dsc}</span>
            </button>
          ))}
        </div>
      </Field>
      {o.mode === "PRINT" && (
        <div className="grid grid-cols-2 gap-2 items-end">
          <Field label="Bleed (mm)"><input className={input} type="number" min={0} max={10} step={0.5} value={o.bleedMm} onChange={(e) => set({ bleedMm: Math.min(10, Math.max(0, Number(e.target.value))) })} /></Field>
          <label className="flex items-center gap-2 text-label-sm pb-2"><input type="checkbox" checked={o.cropMarks} onChange={(e) => set({ cropMarks: e.target.checked })} />Crop marks</label>
        </div>
      )}
      <ul className="text-[11px] text-on-surface-variant list-disc pl-4 space-y-0.5">
        <li>Fonts are embedded (all are open-licence Google fonts, which allow embedding).</li>
        <li>Pictures go in at the resolution they were uploaded at.</li>
        <li>Colours are RGB. The PDF is not converted to CMYK and is not checked against PDF/X — ask your printer whether RGB is accepted.</li>
      </ul>
    </div>
  );
}

function TemplatesPanel({ design, setDesign, moduleId }: PanelProps) {
  const [list, setList] = useState<{ id: string; name: string; description: string | null; themeName: string | null; sections: number }[] | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [others, setOthers] = useState<{ moduleId: string; title: string; code: string }[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/team/module-design-templates", { cache: "no-store" });
    const b = await r.json().catch(() => null);
    if (r.status === 503) return setUnavailable(b?.error ?? "Saved templates are not available yet.");
    if (b?.success) setList(b.data.templates);
  }, []);
  useEffect(() => {
    void load();
    fetch(`/api/team/modules/${moduleId}/design?others=1`).then((r) => r.json()).then((r) => r.success && setOthers(r.data.designs));
  }, [load, moduleId]);
  const applyStyle = (style: TemplateStyle) => setDesign((d) => ({ ...d, sections: d.sections.map((s) => ({ ...s, style })) }));
  return (
    <div className="space-y-3">
      <Field label="Template library — style for every section">
        <div className="grid grid-cols-2 gap-1.5">
          {TEMPLATE_STYLES.map((st) => (
            <button key={st} type="button" className={btn} onClick={() => applyStyle(st)}>{STYLE_INFO[st].label}</button>
          ))}
        </div>
        <span className="block text-[10px] text-on-surface-variant mt-1">Page templates: {SECTION_KINDS.map((k) => KIND_INFO[k].label).join(", ")} — add them under Sections.</span>
      </Field>

      <div className="pt-2 border-t border-outline-variant/30 space-y-2">
        <h4 className="text-[11px] font-bold">Saved templates</h4>
        {unavailable ? (
          <p className="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1.5">{unavailable}</p>
        ) : (
          <>
            <div className="flex gap-1.5">
              <input className={input} placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
              <button
                type="button"
                className={btn}
                disabled={name.trim().length < 2 || savingTpl}
                onClick={async () => {
                  setSavingTpl(true);
                  try {
                    const r = await fetch("/api/team/module-design-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), design }) });
                    const b = await r.json().catch(() => null);
                    if (!r.ok) return toast.error(b?.error ?? "Could not save the template.");
                    toast.success(b?.data?.template?.updated ? "Template updated (same name)." : "Template saved.");
                    setName("");
                    await load();
                  } finally {
                    setSavingTpl(false);
                  }
                }}
              >
                {savingTpl ? "Saving…" : "Save current"}
              </button>
            </div>
            {list && !list.length && <p className="text-[11px] text-on-surface-variant">No saved templates yet.</p>}
            <ul className="space-y-1">
              {list?.map((t) => (
                <li key={t.id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="flex-1 truncate">
                    <b>{t.name}</b> <span className="text-on-surface-variant">· {t.themeName} · {t.sections} sections</span>
                  </span>
                  <button
                    type="button"
                    className={btn}
                    onClick={async () => {
                      const b = await fetch(`/api/team/module-design-templates?id=${t.id}`).then((r) => r.json());
                      if (!b.success) return toast.error(b.error);
                      try {
                        setDesign((d) => applyTemplateData(d, b.data.template.data));
                        toast.success(`Applied “${t.name}”. Undo with Ctrl+Z.`);
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    Apply
                  </button>
                  <button type="button" className={`${btn} text-red-600`} onClick={async () => { await fetch(`/api/team/module-design-templates?id=${t.id}`, { method: "DELETE" }); void load(); }} aria-label={`Delete template ${t.name}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="pt-2 border-t border-outline-variant/30 space-y-1.5">
        <h4 className="text-[11px] font-bold">Duplicate a design from another module</h4>
        {others && !others.length && <p className="text-[11px] text-on-surface-variant">No other module has a design yet.</p>}
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {others?.map((o) => (
            <li key={o.moduleId} className="flex items-center gap-1.5 text-[11px]">
              <span className="flex-1 truncate">{o.title} <span className="text-on-surface-variant">({o.code})</span></span>
              <button
                type="button"
                className={btn}
                onClick={async () => {
                  const b = await fetch(`/api/team/modules/${moduleId}/design?copyFrom=${o.moduleId}`).then((r) => r.json());
                  if (!b.success) return toast.error(b.error);
                  setDesign((d) => applyTemplateData(d, designToTemplateData(b.data.design)));
                  toast.success("Design copied (this module keeps its own title and chapter). Undo with Ctrl+Z.");
                }}
              >
                Use this design
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
