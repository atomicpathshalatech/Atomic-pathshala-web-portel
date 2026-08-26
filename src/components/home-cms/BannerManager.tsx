"use client";

import { useState } from "react";
import { toast } from "sonner";

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaText: string | null;
  ctaUrl: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  priority: number;
};

export function BannerManager({ initialBanners }: { initialBanners: Banner[] }) {
  const [banners, setBanners] = useState(initialBanners);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle: subtitle || undefined, imageUrl, ctaText: ctaText || undefined, ctaUrl: ctaUrl || undefined, status: "ACTIVE" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not create banner.");
      setBanners((prev) => [json.data.banner, ...prev]);
      toast.success("Banner created");
      setShowForm(false);
      setTitle(""); setSubtitle(""); setImageUrl(""); setCtaText(""); setCtaUrl("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create banner.");
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(id: string, status: Banner["status"]) {
    try {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      setBanners((prev) => prev.map((b) => (b.id === id ? json.data.banner : b)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update banner.");
    }
  }

  async function remove(id: string) {
    try {
      await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
      setBanners((prev) => prev.filter((b) => b.id !== id));
      toast.success("Banner deleted");
    } catch {
      toast.error("Could not delete banner.");
    }
  }

  return (
    <div className="space-y-stack-md">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)} className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-label-md">
          New Banner
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="glass-card rounded-2xl p-6 space-y-3">
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle (optional)" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
          <input required value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (upload via Media Library, then paste the URL)" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
          <div className="grid grid-cols-2 gap-3">
            <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="CTA text (optional)" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
            <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="CTA URL (optional)" className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-body-md" />
          </div>
          <button type="submit" disabled={submitting} className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-label-md disabled:opacity-60">
            {submitting ? "Saving…" : "Create Banner"}
          </button>
        </form>
      )}

      <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
        {banners.length === 0 && <p className="p-8 text-center text-on-surface-variant font-body-md">No banners yet.</p>}
        {banners.map((b) => (
          <div key={b.id} className="p-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imageUrl} alt={b.title} className="w-20 h-12 object-cover rounded-lg shrink-0 bg-surface-container-high" />
            <div className="flex-1 min-w-0">
              <p className="font-label-lg text-label-lg text-on-surface truncate">{b.title}</p>
              <p className="text-label-sm text-on-surface-variant">{b.status}</p>
            </div>
            <select value={b.status} onChange={(e) => setStatus(b.id, e.target.value as Banner["status"])} className="text-label-sm rounded-lg border border-outline-variant/40 bg-surface px-2 py-1">
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <button onClick={() => remove(b.id)} className="text-label-sm text-error hover:underline shrink-0">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
