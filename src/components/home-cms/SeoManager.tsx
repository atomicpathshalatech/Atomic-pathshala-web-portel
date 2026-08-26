"use client";

import { useState } from "react";
import { toast } from "sonner";

type SeoFields = {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
};

export function SeoManager({ pageKey, initial }: { pageKey: string; initial: SeoFields }) {
  const [fields, setFields] = useState(initial);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof SeoFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim() !== ""));
      const res = await fetch(`/api/admin/seo/${pageKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not save SEO settings.");
      toast.success("SEO settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save SEO settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="glass-card rounded-2xl p-6 space-y-4">
      <div className="space-y-1">
        <label className="text-label-sm text-on-surface-variant">Meta Title (≤70 chars)</label>
        <input value={fields.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} maxLength={70} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
      </div>
      <div className="space-y-1">
        <label className="text-label-sm text-on-surface-variant">Meta Description (≤200 chars)</label>
        <textarea value={fields.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} maxLength={200} rows={2} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
      </div>
      <div className="space-y-1">
        <label className="text-label-sm text-on-surface-variant">Keywords (comma-separated)</label>
        <input value={fields.keywords} onChange={(e) => set("keywords", e.target.value)} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-label-sm text-on-surface-variant">OG Title</label>
          <input value={fields.ogTitle} onChange={(e) => set("ogTitle", e.target.value)} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        </div>
        <div className="space-y-1">
          <label className="text-label-sm text-on-surface-variant">OG Image URL</label>
          <input value={fields.ogImageUrl} onChange={(e) => set("ogImageUrl", e.target.value)} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-label-sm text-on-surface-variant">OG Description</label>
        <textarea value={fields.ogDescription} onChange={(e) => set("ogDescription", e.target.value)} rows={2} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
      </div>
      <div className="space-y-1">
        <label className="text-label-sm text-on-surface-variant">Canonical URL</label>
        <input value={fields.canonicalUrl} onChange={(e) => set("canonicalUrl", e.target.value)} className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
      </div>
      <button type="submit" disabled={saving} className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-label-md disabled:opacity-60">
        {saving ? "Saving…" : "Save SEO Settings"}
      </button>
    </form>
  );
}
