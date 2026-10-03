"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ImageUploadField } from "./ImageUploadField";

type Hero = { imageUrl: string; mobileImageUrl: string; altText: string };

/** Team → Website → Homepage Hero Image: the picture in the centre/right of the homepage hero. */
export function HeroImageManager({ initial }: { initial: Hero }) {
  const [hero, setHero] = useState<Hero>(initial);
  const [saving, setSaving] = useState(false);

  async function save(next: Hero) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/homepage/hero", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Could not save.");
      setHero(next);
      toast.success(next.imageUrl ? "Hero image saved. The homepage updates within a minute." : "Hero image removed — the homepage shows the built-in illustration.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <ImageUploadField
        label="Hero image (desktop & tablet)"
        hint="Square or 4:3 PNG/JPG/WebP works best (e.g. 1000×1000). Transparent PNG looks great on the light hero background."
        value={hero.imageUrl}
        onChange={(imageUrl) => setHero((h) => ({ ...h, imageUrl }))}
        aspect="aspect-square"
      />
      <ImageUploadField
        label="Mobile image (optional)"
        hint="Shown on phones. Leave empty to use the desktop image."
        value={hero.mobileImageUrl}
        onChange={(mobileImageUrl) => setHero((h) => ({ ...h, mobileImageUrl }))}
        aspect="aspect-square"
      />
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-700">Image description (for screen readers & Google)</label>
        <input
          value={hero.altText}
          onChange={(e) => setHero((h) => ({ ...h, altText: e.target.value }))}
          placeholder="e.g. Students studying with Atomic Pathshala"
          maxLength={200}
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(hero)}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {initial.imageUrl && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ imageUrl: "", mobileImageUrl: "", altText: "" })}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Remove image (use built-in illustration)
          </button>
        )}
      </div>
    </div>
  );
}
