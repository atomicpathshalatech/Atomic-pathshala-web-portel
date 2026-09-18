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

type BatchOption = { id: string; name: string; targetExam: string | null };
type TestSeriesOption = { id: string; name: string; targetExam: string | null };
type TestOption = { id: string; name: string; type?: string };

type DestinationCategory =
  | "BATCHES"
  | "TESTS"
  | "PRACTICE"
  | "STUDY_MATERIAL"
  | "PLATFORM"
  | "CUSTOM";

export function BannerManager({
  initialBanners,
  batches = [],
  testSeries = [],
  tests = [],
}: {
  initialBanners: Banner[];
  batches?: BatchOption[];
  testSeries?: TestSeriesOption[];
  tests?: TestOption[];
}) {
  const [banners, setBanners] = useState(initialBanners);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [destCategory, setDestCategory] = useState<DestinationCategory>("BATCHES");
  const [selectedSubItem, setSelectedSubItem] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleCategoryChange(cat: DestinationCategory) {
    setDestCategory(cat);
    setSelectedSubItem("");

    if (cat === "BATCHES") {
      const defaultUrl = batches.length > 0 ? `/courses/${batches[0]?.id}` : "/courses";
      setCtaUrl(defaultUrl);
      if (!ctaText) setCtaText("Explore Batch");
    } else if (cat === "TESTS") {
      const defaultUrl = tests.length > 0 ? `/tests/${tests[0]?.id}/attempt` : "/tests";
      setCtaUrl(defaultUrl);
      if (!ctaText) setCtaText("Start Test");
    } else if (cat === "PRACTICE") {
      setCtaUrl("/ncert-practice");
      if (!ctaText) setCtaText("Practice Now");
    } else if (cat === "STUDY_MATERIAL") {
      setCtaUrl("/study-material");
      if (!ctaText) setCtaText("View Material");
    } else if (cat === "PLATFORM") {
      setCtaUrl("/guru");
      if (!ctaText) setCtaText("Ask Doubt");
    } else if (cat === "CUSTOM") {
      // Keep existing URL or leave empty
    }
  }

  function handleSubItemChange(val: string) {
    setSelectedSubItem(val);
    if (!val) return;

    if (destCategory === "BATCHES") {
      if (val === "ALL_ENROLLED") {
        setCtaUrl("/courses");
        if (!ctaText) setCtaText("My Batches");
      } else if (val === "ALL_STORE") {
        setCtaUrl("/store");
        if (!ctaText) setCtaText("Batch Store");
      } else {
        setCtaUrl(`/courses/${val}`);
        const found = batches.find((b) => b.id === val);
        if (!ctaText) setCtaText("Enroll Now");
        if (!title && found) setTitle(found.name);
      }
    } else if (destCategory === "TESTS") {
      if (val === "ALL_TESTS") {
        setCtaUrl("/tests");
        if (!ctaText) setCtaText("Test Series Hub");
      } else if (val.startsWith("SERIES_")) {
        const seriesId = val.replace("SERIES_", "");
        setCtaUrl(`/tests`);
        if (!ctaText) setCtaText("Attempt Series");
      } else if (val.startsWith("TEST_")) {
        const testId = val.replace("TEST_", "");
        setCtaUrl(`/tests/${testId}/attempt`);
        if (!ctaText) setCtaText("Start Mock Test");
      }
    } else if (destCategory === "PRACTICE") {
      setCtaUrl(val);
      if (val.includes("ncert")) {
        if (!ctaText) setCtaText("NCERT Practice");
      } else if (val.includes("boards")) {
        if (!ctaText) setCtaText("Board PYQs");
      } else if (val.includes("dpp")) {
        if (!ctaText) setCtaText("Daily DPP");
      } else {
        if (!ctaText) setCtaText("Start Practice");
      }
    } else if (destCategory === "STUDY_MATERIAL") {
      setCtaUrl(val);
      if (!ctaText) setCtaText("Read Materials");
    } else if (destCategory === "PLATFORM") {
      setCtaUrl(val);
      if (!ctaText) {
        if (val === "/guru") setCtaText("AI Doubt Solver");
        else if (val === "/schedule") setCtaText("Live Classes");
        else if (val === "/book-session") setCtaText("Book 1-on-1");
        else if (val === "/predictor") setCtaText("Check Rank");
        else if (val === "/store") setCtaText("Explore Store");
      }
    }
  }

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
      setSelectedSubItem("");
      setDestCategory("BATCHES");
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
          onClick={() => {
            setShowForm((v) => !v);
            if (!showForm && !ctaUrl && batches.length > 0) {
              setCtaUrl(`/courses/${batches[0]?.id}`);
            }
          }}
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

            {/* Smart Redirect Target / Category Selector (Before Destination URL) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  Select Banner Target / Category
                </label>
                <span className="text-[11px] text-slate-500">
                  Auto-populates link &amp; button
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Category Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    1. Target Category
                  </label>
                  <select
                    value={destCategory}
                    onChange={(e) => handleCategoryChange(e.target.value as DestinationCategory)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="BATCHES">🎓 Batches &amp; Courses</option>
                    <option value="TESTS">📝 Test Series &amp; Mock Tests</option>
                    <option value="PRACTICE">🎯 Question Practice &amp; PYQs</option>
                    <option value="STUDY_MATERIAL">📚 Modules &amp; Study Material</option>
                    <option value="PLATFORM">⚡ Platform Features (AI Guru, Live, Mentor)</option>
                    <option value="CUSTOM">🔗 Custom URL / External Link</option>
                  </select>
                </div>

                {/* 2. Sub-Item Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    2. Select Item / Destination
                  </label>

                  {destCategory === "BATCHES" && (
                    <select
                      value={selectedSubItem}
                      onChange={(e) => handleSubItemChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="ALL_ENROLLED">📌 Enrolled Batches Catalog (/courses)</option>
                      <option value="ALL_STORE">🛒 Course Store Catalog (/store)</option>
                      {batches.length > 0 && (
                        <optgroup label="All Live &amp; Published Batches">
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.targetExam || "Batch"})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}

                  {destCategory === "TESTS" && (
                    <select
                      value={selectedSubItem}
                      onChange={(e) => handleSubItemChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="ALL_TESTS">📊 Tests &amp; Test Series Main Hub (/tests)</option>
                      {testSeries.length > 0 && (
                        <optgroup label="Test Series Packages">
                          {testSeries.map((ts) => (
                            <option key={ts.id} value={`SERIES_${ts.id}`}>
                              {ts.name} ({ts.targetExam || "Series"})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {tests.length > 0 && (
                        <optgroup label="Individual Mock Tests">
                          {tests.map((t) => (
                            <option key={t.id} value={`TEST_${t.id}`}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}

                  {destCategory === "PRACTICE" && (
                    <select
                      value={selectedSubItem}
                      onChange={(e) => handleSubItemChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="/ncert-practice">📖 NCERT Chapter-wise Practice (/ncert-practice)</option>
                      <option value="/practice">🧠 Topic-wise Question Bank &amp; Practice (/practice)</option>
                      <option value="/practice/boards">🏆 Board Exam Hub &amp; PYQs (/practice/boards)</option>
                      <option value="/dpp">📝 Daily Practice Problems - DPP (/dpp)</option>
                    </select>
                  )}

                  {destCategory === "STUDY_MATERIAL" && (
                    <select
                      value={selectedSubItem}
                      onChange={(e) => handleSubItemChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="/study-material">📚 Study Material Hub (/study-material)</option>
                      <option value="/ncert">📑 NCERT Textbooks &amp; PDF Reader (/ncert)</option>
                    </select>
                  )}

                  {destCategory === "PLATFORM" && (
                    <select
                      value={selectedSubItem}
                      onChange={(e) => handleSubItemChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="/guru">🤖 AI Doubt Solver — Allie Guru (/guru)</option>
                      <option value="/schedule">📡 Live Classes &amp; Studio Schedule (/schedule)</option>
                      <option value="/book-session">🤝 1-on-1 Mentor Booking (/book-session)</option>
                      <option value="/predictor">📈 NEET / JEE Rank Predictor (/predictor)</option>
                      <option value="/store">🛒 Batch Store (/store)</option>
                      <option value="/courses">🎓 My Enrolled Batches (/courses)</option>
                    </select>
                  )}

                  {destCategory === "CUSTOM" && (
                    <div className="py-2 text-xs text-slate-500">
                      Enter your custom route or external link in Destination URL below.
                    </div>
                  )}
                </div>
              </div>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destination URL / Redirect Link (Auto-Filled)</label>
                <input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="e.g. /courses, /courses/batch-id, /tests, https://..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-[11px]"
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
