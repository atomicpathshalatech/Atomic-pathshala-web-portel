"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AUDIENCES,
  DEFAULT_LAYOUT,
  GROUP_LABELS,
  MATERIAL_TYPE_LABELS,
  PYQ_EXAM_OPTIONS,
  TEMPLATES,
  TEMPLATE_BY_TYPE,
  effectiveType,
  type Audience,
  type Field,
  type OptionSource,
  type Template,
  type TemplateGroup,
} from "@/lib/home-templates";
import { ImageUploadField } from "./ImageUploadField";

export type BuilderSection = {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  order: number;
  visible: boolean;
  visibleDesktop: boolean;
  visibleMobile: boolean;
  config: Record<string, unknown>;
};

export type BuilderOptions = {
  batches: { id: string; name: string }[];
  teachers: { slug: string; name: string }[];
  testSeries: { id: string; name: string }[];
};

type Perms = { canCreate: boolean; canEdit: boolean; canDelete: boolean; canPublish: boolean; canReorder: boolean };

const ICONS = [
  "school", "science", "biotech", "functions", "menu_book", "auto_stories", "history_edu", "description", "quiz", "timer",
  "assignment", "account_tree", "calculate", "star", "smart_display", "live_tv", "psychology", "help", "translate", "devices",
  "lock", "support_agent", "workspace_premium", "trending_up", "edit_note", "verified", "emoji_events", "groups", "call", "redeem",
  "lightbulb", "rocket_launch", "check_circle", "local_library", "download", "event",
];

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "mb-1 block text-xs font-semibold text-slate-700";

async function callApi(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error ?? "Request failed.");
  return json.data;
}

// Show/edit a stored row as its real template (CUSTOM_HTML + config.template → e.g. BANNER_SLIDER).
const normalize = (s: BuilderSection): BuilderSection => {
  const config = (s.config ?? {}) as Record<string, unknown>;
  return { ...s, config, type: effectiveType({ type: s.type, config }) };
};

const audienceOf = (s: BuilderSection) => ((typeof s.config.audience === "string" ? s.config.audience : "ALL") as Audience);
const labelOf = (type: string) => TEMPLATE_BY_TYPE[type]?.label ?? type;

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`material-symbols-outlined leading-none ${className}`}>{name}</span>;
}

/**
 * Team → Website → Website Builder. Pick templates, fill simple forms, order
 * them, choose who sees each one, preview the draft, then Publish.
 */
export function HomeTemplateBuilder({
  initialSections,
  live,
  options,
  perms,
}: {
  initialSections: BuilderSection[];
  live: { versionNumber: number; publishedAt: string; unpublished: boolean } | null;
  options: BuilderOptions;
  perms: Perms;
}) {
  const [sections, setSections] = useState(() => initialSections.map(normalize).sort((a, b) => a.order - b.order));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const [liveState, setLiveState] = useState(live);

  const changed = () => setDirty(true);

  async function addSection(type: string, open = true) {
    const t = TEMPLATE_BY_TYPE[type];
    const data = await callApi("/api/admin/homepage/sections", "POST", { type, config: {} });
    const s = normalize(data.section as BuilderSection);
    setSections((list) => [...list, s]);
    changed();
    if (open) {
      setEditingId(s.id);
      setShowLibrary(false);
      toast.success(`“${t?.label ?? type}” add ho gaya — neeche form bhariye.`);
    }
    return s;
  }

  async function addDefaultLayout() {
    if (sections.length && !window.confirm("Default homepage ke saare sections neeche jod diye jayenge. Jaari rakhein?")) return;
    setBusy(true);
    try {
      for (const s of DEFAULT_LAYOUT) await addSection(s.type, false);
      toast.success("Default homepage builder mein aa gaya. Ab badlav karke Publish karein.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add sections.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSection(id: string, patch: Partial<BuilderSection>) {
    const data = await callApi(`/api/admin/homepage/sections/${id}`, "PATCH", patch);
    const s = normalize(data.section as BuilderSection);
    setSections((list) => list.map((x) => (x.id === id ? { ...x, ...s } : x)));
    changed();
  }

  async function removeSection(s: BuilderSection) {
    if (!window.confirm(`“${s.title || labelOf(s.type)}” hata dein?`)) return;
    try {
      await callApi(`/api/admin/homepage/sections/${s.id}`, "DELETE");
      setSections((list) => list.filter((x) => x.id !== s.id));
      if (editingId === s.id) setEditingId(null);
      changed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  async function duplicate(s: BuilderSection) {
    try {
      const data = await callApi("/api/admin/homepage/sections", "POST", {
        type: s.type,
        title: s.title ?? undefined,
        subtitle: s.subtitle ?? undefined,
        visibleDesktop: s.visibleDesktop,
        visibleMobile: s.visibleMobile,
        config: s.config,
      });
      const copy = normalize(data.section as BuilderSection);
      // Place the copy right after the original.
      const list = [...sections];
      list.splice(list.findIndex((x) => x.id === s.id) + 1, 0, copy);
      await persistOrder(list);
      toast.success("Copy ban gayi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate.");
    }
  }

  async function persistOrder(list: BuilderSection[]) {
    const ordered = list.map((s, i) => ({ ...s, order: i }));
    setSections(ordered);
    changed();
    await callApi("/api/admin/homepage/sections/reorder", "PATCH", { order: ordered.map((s) => ({ id: s.id, order: s.order })) });
  }

  async function move(index: number, to: number) {
    if (to < 0 || to >= sections.length) return;
    const list = [...sections];
    const [item] = list.splice(index, 1);
    list.splice(to, 0, item!);
    try {
      await persistOrder(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reorder.");
    }
  }

  async function toggleVisible(s: BuilderSection) {
    try {
      await saveSection(s.id, { visible: !s.visible });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update.");
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const data = await callApi("/api/admin/homepage/publish", "POST", note ? { note } : {});
      setLiveState({ versionNumber: data.version.versionNumber, publishedAt: data.version.publishedAt, unpublished: false });
      setDirty(false);
      setNote("");
      toast.success("Publish ho gaya! Homepage par badlav dikh jayega.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!window.confirm("Unpublish karne par homepage default layout par wapas chala jayega. Jaari rakhein?")) return;
    setBusy(true);
    try {
      await callApi("/api/admin/homepage/unpublish", "POST");
      setLiveState((l) => (l ? { ...l, unpublished: true } : l));
      toast.success("Unpublish ho gaya — homepage ab default layout dikha raha hai.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unpublish.");
    } finally {
      setBusy(false);
    }
  }

  const isLive = !!liveState && !liveState.unpublished;

  return (
    <div className="space-y-5">
      {/* Status + publish */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${isLive ? "bg-green-500" : "bg-slate-300"}`} />
          <p className="text-sm font-semibold text-slate-900">
            {isLive
              ? `Live: version ${liveState!.versionNumber} (${new Date(liveState!.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })})`
              : "Abhi homepage default layout dikha raha hai (builder se kuch publish nahi hai)."}
          </p>
          {dirty && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Draft mein badlav hain — Publish karein</span>}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note (optional) — kya badla" className={`${input} flex-1`} />
          <a href="/homepage-preview" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <MIcon name="visibility" className="text-[18px]" /> Preview
          </a>
          {perms.canPublish && (
            <>
              <button type="button" disabled={busy || sections.length === 0} onClick={publish} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                Publish
              </button>
              {isLive && (
                <button type="button" disabled={busy} onClick={unpublish} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                  Unpublish
                </button>
              )}
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">Badlav pehle draft mein save hote hain. Preview mein dekhiye, phir Publish dabaiye — tab hi website par aayenge.</p>
      </div>

      {/* Empty state */}
      {sections.length === 0 && perms.canCreate && (
        <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 text-center">
          <p className="text-base font-bold text-slate-900">Shuru kahan se karein?</p>
          <p className="mt-1 text-sm text-slate-600">Abhi ka poora homepage (Banner, PYQ, Study Material, Tests, Courses, Teachers, Blog, FAQ…) yahan laayein, phir jo chahein badlein.</p>
          <button type="button" disabled={busy} onClick={addDefaultLayout} className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Add ho raha hai…" : "Abhi ka homepage builder mein laayein"}
          </button>
        </div>
      )}

      {/* Section list */}
      {sections.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-bold text-slate-900">Homepage sections (upar se neeche)</p>
            {perms.canCreate && (
              <button type="button" disabled={busy} onClick={addDefaultLayout} className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50">
                + Default sections jodein
              </button>
            )}
          </div>
          <ol className="divide-y divide-slate-100">
            {sections.map((s, i) => {
              const t = TEMPLATE_BY_TYPE[s.type];
              const aud = audienceOf(s);
              return (
                <li key={s.id} className={s.visible ? "" : "bg-slate-50"}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    {perms.canReorder && (
                      <div className="flex flex-col">
                        <button type="button" aria-label="Upar" disabled={i === 0} onClick={() => move(i, i - 1)} className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-25">
                          <MIcon name="keyboard_arrow_up" className="text-[20px]" />
                        </button>
                        <button type="button" aria-label="Neeche" disabled={i === sections.length - 1} onClick={() => move(i, i + 1)} className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-25">
                          <MIcon name="keyboard_arrow_down" className="text-[20px]" />
                        </button>
                      </div>
                    )}
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.visible ? "bg-blue-50 text-blue-700" : "bg-slate-200 text-slate-500"}`}>
                      <MIcon name={t?.icon ?? "widgets"} className="text-[22px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${s.visible ? "text-slate-900" : "text-slate-400 line-through"}`}>{labelOf(s.type)}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {s.title && <span className="truncate">“{s.title}”</span>}
                        {!s.visible && <span className="rounded bg-slate-200 px-1.5 font-semibold text-slate-600">Hidden</span>}
                        {s.visible && !s.visibleMobile && <span className="rounded bg-slate-100 px-1.5">Sirf desktop</span>}
                        {s.visible && !s.visibleDesktop && <span className="rounded bg-slate-100 px-1.5">Sirf mobile</span>}
                        {aud !== "ALL" && <span className="rounded bg-violet-100 px-1.5 font-semibold text-violet-700">{AUDIENCES.find((a) => a.value === aud)?.label}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {perms.canEdit && (
                        <button type="button" onClick={() => setEditingId(editingId === s.id ? null : s.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                          {editingId === s.id ? "Close" : "Edit"}
                        </button>
                      )}
                      {perms.canEdit && (
                        <button type="button" onClick={() => toggleVisible(s)} title={s.visible ? "Hide" : "Show"} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                          <MIcon name={s.visible ? "visibility" : "visibility_off"} className="text-[18px]" />
                        </button>
                      )}
                      {perms.canCreate && (
                        <button type="button" onClick={() => duplicate(s)} title="Copy" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                          <MIcon name="content_copy" className="text-[18px]" />
                        </button>
                      )}
                      {perms.canDelete && (
                        <button type="button" onClick={() => removeSection(s)} title="Delete" className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
                          <MIcon name="delete" className="text-[18px]" />
                        </button>
                      )}
                    </div>
                  </div>
                  {editingId === s.id && (
                    <SectionForm
                      key={s.id}
                      section={s}
                      template={t}
                      options={options}
                      onCancel={() => setEditingId(null)}
                      onSave={async (patch) => {
                        try {
                          await saveSection(s.id, patch);
                          toast.success("Draft mein save ho gaya. Publish karna na bhoolein.");
                          setEditingId(null);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not save.");
                        }
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Template library */}
      {perms.canCreate && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <button type="button" onClick={() => setShowLibrary((v) => !v)} className="flex w-full items-center justify-between text-left">
            <span>
              <span className="block text-sm font-bold text-slate-900">+ Naya section jodein (template chuniye)</span>
              <span className="block text-xs text-slate-500">Teachers, PYQ, Study Material/Modules, Tests, Courses, Video, Blog, Image… — naya section list ke aakhir mein judega, phir upar/neeche kar sakte hain.</span>
            </span>
            <MIcon name={showLibrary ? "expand_less" : "expand_more"} className="text-[24px] text-slate-500" />
          </button>
          {showLibrary && <TemplateLibrary onPick={(type) => addSection(type).catch((err) => toast.error(err instanceof Error ? err.message : "Could not add. (Migration chalayi hai?)"))} />}
        </div>
      )}
    </div>
  );
}

function TemplateLibrary({ onPick }: { onPick: (type: string) => void }) {
  const groups = useMemo(() => {
    const g: Record<TemplateGroup, Template[]> = { top: [], learning: [], people: [], info: [] };
    for (const t of TEMPLATES) g[t.group].push(t);
    return g;
  }, []);
  return (
    <div className="mt-4 space-y-5">
      {(Object.keys(groups) as TemplateGroup[]).map((g) => (
        <div key={g}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{GROUP_LABELS[g]}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {groups[g].map((t) => (
              <button key={t.type} type="button" onClick={() => onPick(t.type)} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <MIcon name={t.icon} className="text-[22px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{t.label}</span>
                  <span className="block text-xs leading-snug text-slate-500">{t.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionForm({
  section,
  template,
  options,
  onSave,
  onCancel,
}: {
  section: BuilderSection;
  template: Template | undefined;
  options: BuilderOptions;
  onSave: (patch: Partial<BuilderSection>) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(section.title ?? "");
  const [subtitle, setSubtitle] = useState(section.subtitle ?? "");
  const [config, setConfig] = useState<Record<string, unknown>>(section.config ?? {});
  const [desktop, setDesktop] = useState(section.visibleDesktop);
  const [mobile, setMobile] = useState(section.visibleMobile);
  const [json, setJson] = useState(() => JSON.stringify(section.config ?? {}, null, 2));
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: unknown) => setConfig((c) => ({ ...c, [k]: v }));

  async function submit() {
    let finalConfig = config;
    if (!template) {
      try {
        finalConfig = JSON.parse(json || "{}");
      } catch {
        toast.error("JSON sahi nahi hai.");
        return;
      }
    }
    if (!desktop && !mobile) {
      toast.error("Kam se kam Desktop ya Mobile mein se ek chuniye (ya section Hide kar dein).");
      return;
    }
    setSaving(true);
    await onSave({ title: title.trim() || null, subtitle: subtitle.trim() || null, visibleDesktop: desktop, visibleMobile: mobile, config: finalConfig });
    setSaving(false);
  }

  return (
    <div className="space-y-4 border-t border-slate-100 bg-slate-50/70 px-5 py-5">
      {template?.note && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">{template.note}</p>}

      {(template?.header ?? true) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Chhota upar ka text</label>
            <input value={typeof config.eyebrow === "string" ? config.eyebrow : ""} onChange={(e) => set("eyebrow", e.target.value)} placeholder="Default" className={input} />
          </div>
          <div>
            <label className={labelCls}>Heading</label>
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Default heading" className={input} />
          </div>
          <div>
            <label className={labelCls}>Neeche ka text</label>
            <input value={subtitle} maxLength={300} onChange={(e) => setSubtitle(e.target.value)} placeholder="Default" className={input} />
          </div>
          <p className="text-[11px] text-slate-500 sm:col-span-3">Khali chhodenge to default text dikhega.</p>
        </div>
      )}

      {template ? (
        template.fields.map((f) => <FieldInput key={f.key} field={f} value={config[f.key]} onChange={(v) => set(f.key, v)} options={options} />)
      ) : (
        <div>
          <label className={labelCls}>Settings (purana section — JSON)</label>
          <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={8} className={`${input} font-mono text-xs`} />
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <p className={labelCls}>Kahan dikhe</p>
          <label className="mr-4 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={desktop} onChange={(e) => setDesktop(e.target.checked)} /> Desktop / laptop
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mobile} onChange={(e) => setMobile(e.target.checked)} /> Mobile
          </label>
        </div>
        <div>
          <label className={labelCls}>Kaun dekhe</label>
          <select value={(config.audience as string) || "ALL"} onChange={(e) => set("audience", e.target.value === "ALL" ? undefined : e.target.value)} className={input}>
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={submit} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving…" : "Save (draft)"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </div>
  );
}

function optionsFor(source: OptionSource, o: BuilderOptions): { value: string; label: string }[] {
  switch (source) {
    case "batches":
      return o.batches.map((b) => ({ value: b.id, label: b.name }));
    case "teachers":
      return o.teachers.map((t) => ({ value: t.slug, label: t.name }));
    case "testSeries":
      return o.testSeries.map((t) => ({ value: t.id, label: t.name }));
    case "materialTypes":
      return Object.entries(MATERIAL_TYPE_LABELS).map(([value, label]) => ({ value, label }));
    case "pyqExams":
      return PYQ_EXAM_OPTIONS.map((x) => ({ value: x, label: x }));
  }
}

function FieldInput({ field, value, onChange, options }: { field: Field; value: unknown; onChange: (v: unknown) => void; options: BuilderOptions }) {
  const hint = "hint" in field && field.hint ? <p className="mt-1 text-[11px] text-slate-500">{field.hint}</p> : null;
  switch (field.type) {
    case "text":
    case "url":
      return (
        <div>
          <label className={labelCls}>{field.label}</label>
          <input value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={input} />
          {hint}
        </div>
      );
    case "textarea":
      return (
        <div>
          <label className={labelCls}>{field.label}</label>
          <textarea value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} rows={field.key === "html" ? 8 : 3} placeholder={field.placeholder} className={`${input} ${field.key === "html" ? "font-mono text-xs" : ""}`} />
          {hint}
        </div>
      );
    case "image":
      return (
        <div>
          <ImageUploadField label={field.label} hint={field.hint} value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v)} />
        </div>
      );
    case "number":
      return (
        <div className="max-w-[220px]">
          <label className={labelCls}>{field.label}</label>
          <input
            type="number"
            min={field.min}
            max={field.max}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Math.max(field.min ?? 1, Math.min(field.max ?? 999, Number(e.target.value))))}
            placeholder="Default"
            className={input}
          />
          {hint}
        </div>
      );
    case "toggle": {
      const on = typeof value === "boolean" ? value : !!field.defaultOn;
      return (
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} /> {field.label}
        </label>
      );
    }
    case "select":
      return (
        <div className="max-w-[260px]">
          <label className={labelCls}>{field.label}</label>
          <select value={typeof value === "string" ? value : field.options[0]?.value} onChange={(e) => onChange(e.target.value)} className={input}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "checks": {
      const picked = Array.isArray(value) ? (value as string[]) : [];
      const opts = optionsFor(field.source, options);
      return (
        <div>
          <label className={labelCls}>{field.label}</label>
          {opts.length === 0 ? (
            <p className="text-xs text-slate-500">Abhi koi option nahi hai.</p>
          ) : (
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:grid-cols-2">
              {opts.map((o) => (
                <label key={o.value} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={picked.includes(o.value)}
                    onChange={(e) => onChange(e.target.checked ? [...picked, o.value] : picked.filter((x) => x !== o.value))}
                  />
                  <span className="truncate">{o.label}</span>
                </label>
              ))}
            </div>
          )}
          {hint}
        </div>
      );
    }
    case "textList": {
      const items = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          <label className={labelCls}>{field.label}</label>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className={input} />
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-lg px-2 text-rose-500 hover:bg-rose-50" aria-label="Remove">
                  <MIcon name="close" className="text-[18px]" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => onChange([...items, ""])} className="text-xs font-semibold text-blue-700 hover:underline">
              + {field.itemLabel} jodein
            </button>
          </div>
          {hint}
        </div>
      );
    }
    case "list": {
      const items = Array.isArray(value) ? (value as Record<string, string>[]) : [];
      const update = (i: number, k: string, v: string) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
      const moveItem = (i: number, to: number) => {
        if (to < 0 || to >= items.length) return;
        const next = [...items];
        const [it] = next.splice(i, 1);
        next.splice(to, 0, it!);
        onChange(next);
      };
      return (
        <div>
          <label className={labelCls}>{field.label}</label>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    {field.itemLabel} {i + 1}
                  </span>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => moveItem(i, i - 1)} disabled={i === 0} className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-25" aria-label="Upar">
                      <MIcon name="keyboard_arrow_up" className="text-[18px]" />
                    </button>
                    <button type="button" onClick={() => moveItem(i, i + 1)} disabled={i === items.length - 1} className="rounded p-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-25" aria-label="Neeche">
                      <MIcon name="keyboard_arrow_down" className="text-[18px]" />
                    </button>
                    <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded p-0.5 text-rose-500 hover:bg-rose-50" aria-label="Remove">
                      <MIcon name="close" className="text-[18px]" />
                    </button>
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {field.fields.map((sf) =>
                    sf.type === "icon" ? (
                      <div key={sf.key}>
                        <label className="mb-0.5 block text-[11px] font-semibold text-slate-600">{sf.label}</label>
                        <div className="flex items-center gap-2">
                          <MIcon name={it[sf.key] || "star"} className="text-[22px] text-blue-700" />
                          <select value={it[sf.key] || ""} onChange={(e) => update(i, sf.key, e.target.value)} className={input}>
                            <option value="">Default</option>
                            {ICONS.map((ic) => (
                              <option key={ic} value={ic}>
                                {ic.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div key={sf.key} className={sf.type === "textarea" ? "sm:col-span-2" : ""}>
                        <label className="mb-0.5 block text-[11px] font-semibold text-slate-600">{sf.label}</label>
                        {sf.type === "textarea" ? (
                          <textarea value={it[sf.key] || ""} onChange={(e) => update(i, sf.key, e.target.value)} rows={2} className={input} />
                        ) : (
                          <input value={it[sf.key] || ""} onChange={(e) => update(i, sf.key, e.target.value)} placeholder={sf.placeholder} className={input} />
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => onChange([...items, {}])} className="text-xs font-semibold text-blue-700 hover:underline">
              + {field.itemLabel} jodein
            </button>
          </div>
          {hint}
        </div>
      );
    }
  }
}
