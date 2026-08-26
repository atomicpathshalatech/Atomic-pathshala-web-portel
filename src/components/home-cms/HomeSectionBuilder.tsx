"use client";

import { useState } from "react";
import { toast } from "sonner";

export type SectionRow = {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  order: number;
  visible: boolean;
  visibleDesktop: boolean;
  visibleMobile: boolean;
  config: Record<string, unknown>;
  background: string | null;
  padding: string | null;
};

const SECTION_TYPES = [
  "HERO",
  "IMAGE_BANNER",
  "TEXT_IMAGE",
  "FEATURES",
  "COURSE_GRID",
  "BATCH_GRID",
  "TEACHER_GRID",
  "CATEGORY_GRID",
  "STATISTICS",
  "TESTIMONIALS",
  "ANNOUNCEMENT",
  "VIDEO",
  "APP_DOWNLOAD",
  "FAQ",
  "LOGO_PARTNERS",
  "CTA",
  "CONTACT",
  "SOCIAL_LINKS",
  "CUSTOM_HTML",
];

// Prefilled per-type config templates — an admin never has to guess field
// names; they see a working example JSON and edit it. Rich, bespoke editor
// forms per section type are a natural follow-up but this JSON editor
// already gives full access to every field the renderer reads.
const CONFIG_TEMPLATES: Record<string, Record<string, unknown>> = {
  HERO: { heading: "Ace NEET with Atomic Pathshala", subheading: "Structured batches, real mentors.", ctaText: "Start Learning", ctaUrl: "/register" },
  IMAGE_BANNER: { imageUrl: "", alt: "", ctaUrl: "/courses" },
  TEXT_IMAGE: { body: "", imageUrl: "", imagePosition: "right", ctaText: "", ctaUrl: "" },
  FEATURES: { items: [{ icon: "school", title: "Expert Faculty", description: "Learn from verified educators." }] },
  COURSE_GRID: { mode: "LATEST", limit: 6 },
  BATCH_GRID: { limit: 6, targetExam: "" },
  TEACHER_GRID: { limit: 8 },
  CATEGORY_GRID: { items: [{ label: "NEET", icon: "biotech", href: "/courses" }] },
  STATISTICS: { items: [{ value: "10,000+", label: "Students" }] },
  TESTIMONIALS: { limit: 6 },
  ANNOUNCEMENT: { message: "New batch starting soon!", ctaText: "Learn more", ctaUrl: "/courses" },
  VIDEO: { embedUrl: "" },
  APP_DOWNLOAD: { androidUrl: "", iosUrl: "" },
  FAQ: { categoryId: "" },
  LOGO_PARTNERS: { logos: [{ imageUrl: "", name: "" }] },
  CTA: { heading: "Ready to start?", body: "", ctaText: "Register Now", ctaUrl: "/register" },
  CONTACT: { phone: "", email: "", address: "" },
  SOCIAL_LINKS: { links: [{ platform: "Instagram", url: "", icon: "photo_camera" }] },
  CUSTOM_HTML: { html: "<p>Custom block</p>" },
};

async function callApi(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed.");
  return json.data;
}

function SectionEditor({
  section,
  onSave,
  onCancel,
}: {
  section: Partial<SectionRow> & { type: string };
  onSave: (data: { title?: string; subtitle?: string; config: Record<string, unknown>; background?: string; padding?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(section.title ?? "");
  const [subtitle, setSubtitle] = useState(section.subtitle ?? "");
  const [configText, setConfigText] = useState(
    JSON.stringify(section.config ?? CONFIG_TEMPLATES[section.type] ?? {}, null, 2)
  );
  const [background, setBackground] = useState(section.background ?? "");
  const [padding, setPadding] = useState(section.padding ?? "");
  const [jsonError, setJsonError] = useState<string | null>(null);

  function submit() {
    try {
      const config = JSON.parse(configText);
      setJsonError(null);
      onSave({ title: title || undefined, subtitle: subtitle || undefined, config, background: background || undefined, padding: padding || undefined });
    } catch {
      setJsonError("Config must be valid JSON.");
    }
  }

  return (
    <div className="space-y-3 bg-surface-container-lowest rounded-xl p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-label-sm text-on-surface-variant">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        </div>
        <div className="space-y-1">
          <label className="text-label-sm text-on-surface-variant">Subtitle</label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-label-sm text-on-surface-variant">Background (CSS value, optional)</label>
          <input value={background} onChange={(e) => setBackground(e.target.value)} placeholder="e.g. #F5F5F5" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        </div>
        <div className="space-y-1">
          <label className="text-label-sm text-on-surface-variant">Padding (CSS value, optional)</label>
          <input value={padding} onChange={(e) => setPadding(e.target.value)} placeholder="e.g. 2rem" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-label-sm text-on-surface-variant">
          Config (JSON — fields read by the {section.type} renderer)
        </label>
        <textarea
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 font-mono text-xs"
        />
        {jsonError && <p className="text-label-sm text-error">{jsonError}</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md">
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-label-md text-on-surface-variant hover:bg-surface-container-high">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function HomeSectionBuilder({
  initialSections,
  canCreate,
  canEdit,
  canDelete,
  canPublish,
  canReorder,
}: {
  initialSections: SectionRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canReorder: boolean;
}) {
  const [sections, setSections] = useState(initialSections);
  const [addingType, setAddingType] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState("");

  async function addSection(type: string, data: { title?: string; subtitle?: string; config: Record<string, unknown> }) {
    try {
      const result = await callApi("/api/admin/homepage/sections", "POST", { type, ...data });
      setSections((prev) => [...prev, result.section]);
      setAddingType(null);
      toast.success("Section added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add section.");
    }
  }

  async function updateSection(id: string, data: Record<string, unknown>) {
    try {
      const result = await callApi(`/api/admin/homepage/sections/${id}`, "PATCH", data);
      setSections((prev) => prev.map((s) => (s.id === id ? result.section : s)));
      setEditingId(null);
      toast.success("Section updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update section.");
    }
  }

  async function toggleVisible(section: SectionRow) {
    await updateSection(section.id, { visible: !section.visible });
  }

  async function deleteSection(id: string) {
    try {
      await callApi(`/api/admin/homepage/sections/${id}`, "DELETE");
      setSections((prev) => prev.filter((s) => s.id !== id));
      toast.success("Section deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete section.");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    // Both indices are bounds-checked above (0 <= index, target < length).
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    const withOrders = reordered.map((s, i) => ({ ...s, order: i }));
    setSections(withOrders);
    try {
      await callApi("/api/admin/homepage/sections/reorder", "PATCH", {
        order: withOrders.map((s) => ({ id: s.id, order: s.order })),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the new order.");
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      const result = await callApi("/api/admin/homepage/publish", "POST", publishNote ? { note: publishNote } : {});
      toast.success(`Published version ${result.version.versionNumber}`);
      setPublishNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish() {
    setPublishing(true);
    try {
      await callApi("/api/admin/homepage/unpublish", "POST");
      toast.success("Homepage unpublished — visitors now see the fallback.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not unpublish.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-stack-md">
      {canPublish && (
        <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center gap-3">
          <input
            value={publishNote}
            onChange={(e) => setPublishNote(e.target.value)}
            placeholder="Optional note for this publish (e.g. what changed)"
            className="flex-1 min-w-[240px] rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md"
          />
          <button
            onClick={publish}
            disabled={publishing || sections.length === 0}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-label-md disabled:opacity-60"
          >
            {publishing ? "Working…" : "Publish"}
          </button>
          <button
            onClick={unpublish}
            disabled={publishing}
            className="px-5 py-2.5 rounded-xl text-label-md text-error border border-error/30 hover:bg-error/10 disabled:opacity-60"
          >
            Unpublish
          </button>
        </div>
      )}

      <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
        {sections.length === 0 && (
          <p className="p-8 text-center text-on-surface-variant font-body-md">
            No sections yet. Add one below to start building the homepage.
          </p>
        )}
        {sections.map((section, i) => (
          <div key={section.id} className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              {canReorder && (
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-on-surface-variant disabled:opacity-30">
                    <span className="material-symbols-outlined text-lg">arrow_drop_up</span>
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="text-on-surface-variant disabled:opacity-30">
                    <span className="material-symbols-outlined text-lg">arrow_drop_down</span>
                  </button>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                    {section.type}
                  </span>
                  {!section.visible && (
                    <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded-full font-bold uppercase tracking-wide text-on-surface-variant">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="font-label-lg text-label-lg text-on-surface truncate">{section.title || "(untitled)"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canEdit && (
                  <button onClick={() => toggleVisible(section)} className="text-label-sm text-on-surface-variant hover:underline">
                    {section.visible ? "Hide" : "Show"}
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => setEditingId(editingId === section.id ? null : section.id)} className="text-label-sm text-primary hover:underline">
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => deleteSection(section.id)} className="text-label-sm text-error hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </div>
            {editingId === section.id && (
              <SectionEditor
                section={section}
                onCancel={() => setEditingId(null)}
                onSave={(data) => updateSection(section.id, data)}
              />
            )}
          </div>
        ))}
      </div>

      {canCreate && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <p className="font-label-lg text-label-lg text-on-surface">Add a section</p>
          {addingType ? (
            <SectionEditor
              section={{ type: addingType, config: CONFIG_TEMPLATES[addingType] }}
              onCancel={() => setAddingType(null)}
              onSave={(data) => addSection(addingType, data)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {SECTION_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setAddingType(type)}
                  className="text-label-sm px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface hover:bg-primary/10 hover:text-primary"
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
