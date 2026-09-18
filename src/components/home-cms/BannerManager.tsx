"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { uploadFileToR2 } from "@/lib/storage/upload-client";
import { Upload, Trash2, ExternalLink, Image as ImageIcon, Sparkles } from "lucide-react";

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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFileToR2(file, {
        fileType: "IMAGE",
        prefix: "course-thumbnails",
        visibility: "PUBLIC",
      });
      if (res.url) {
        setImageUrl(res.url);
        toast.success("16:9 Image uploaded successfully!");
      } else {
        toast.error("Upload succeeded but no public URL returned.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl) {
      toast.error("Please upload or enter a banner image URL.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle: subtitle || undefined,
          imageUrl,
          ctaText: ctaText || undefined,
          ctaUrl: ctaUrl || undefined,
          status: "ACTIVE",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Could not create banner.");
      setBanners((prev) => [json.data.banner, ...prev]);
      toast.success("Banner created successfully!");
      setShowForm(false);
      setTitle("");
      setSubtitle("");
      setImageUrl("");
      setCtaText("");
      setCtaUrl("");
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
      toast.success(`Banner set to ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update banner.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    try {
      await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
      setBanners((prev) => prev.filter((b) => b.id !== id));
      toast.success("Banner deleted");
    } catch {
      toast.error("Could not delete banner.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Homepage 16:9 Banners</h2>
          <p className="text-xs text-slate-500">
            Upload banners that show on the student home page carousel with clickable redirects.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition"
        >
          {showForm ? "Cancel" : "+ New 16:9 Banner"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Create New Banner (16:9 Recommended)</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Banner Title *</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. NEET 2026 Rankers Batch Starting Soon"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subtitle / Badge (Optional)</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. New Batch Announcement • Limited Seats"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Direct Image Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Banner Image (16:9 Aspect Ratio) *</label>
              <div className="flex gap-2">
                <input
                  required
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste Image URL or upload file below"
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Uploading…" : "Upload 16:9"}
                </button>
              </div>

              {imageUrl && (
                <div className="mt-2.5 relative aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <img src={imageUrl} alt="Banner preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Button Text (Optional)</label>
                <input
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="e.g. Enroll Now, Explore Batch"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination URL / Redirect Link (Optional)</label>
                <input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="e.g. /courses, /courses/batch-id, /tests, https://..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
            >
              {submitting ? "Saving…" : "Publish Banner"}
            </button>
          </div>
        </form>
      )}

      {/* Banner List */}
      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm overflow-hidden">
        {banners.length === 0 && (
          <p className="p-8 text-center text-xs text-slate-500">
            No active banners found. Default platform banners will show on the student home page.
          </p>
        )}
        {banners.map((b) => (
          <div key={b.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition">
            <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs text-slate-900 truncate">{b.title}</h4>
                {b.subtitle && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 shrink-0">
                    {b.subtitle}
                  </span>
                )}
              </div>
              {b.ctaUrl && (
                <p className="mt-0.5 text-[11px] text-blue-600 truncate flex items-center gap-1">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  {b.ctaUrl}
                </p>
              )}
            </div>

            <select
              value={b.status}
              onChange={(e) => setStatus(b.id, e.target.value as Banner["status"])}
              className="text-xs font-semibold rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ACTIVE">Active (Live)</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <button
              type="button"
              onClick={() => remove(b.id)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
              title="Delete banner"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
