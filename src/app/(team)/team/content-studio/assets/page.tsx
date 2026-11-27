"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Search,
  Download,
  Trash2,
  Edit3,
  Eye,
  X,
  RefreshCw,
} from "lucide-react";

const ASSET_TYPES = [
  "IMAGE",
  "THUMBNAIL",
  "VIDEO_CLIP",
  "AUDIO",
  "VOICEOVER",
  "MUSIC",
  "SFX",
  "SCRIPT",
  "SLIDE",
  "PDF",
  "CAPTION",
  "EXPORTED_VIDEO",
];

interface AssetRow {
  id: string;
  title: string | null;
  assetType: string;
  publicUrl: string | null;
  tags: string[];
  projectId: string | null;
  project?: { id: string; title: string } | null;
  createdAt: string;
}

interface ProjectOption {
  id: string;
  title: string;
}

export default function ContentStudioAssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState("IMAGE");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadProject, setUploadProject] = useState("");

  // Edit / Preview state
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editProject, setEditProject] = useState("");
  const [preview, setPreview] = useState<AssetRow | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      if (filterType) qs.set("assetType", filterType);
      if (filterProject) qs.set("projectId", filterProject);

      const [aRes, pRes] = await Promise.all([
        fetch(`/api/team/content-studio/assets?${qs.toString()}`),
        fetch("/api/team/content-studio/projects"),
      ]);
      const [aJson, pJson] = await Promise.all([aRes.json(), pRes.json()]);
      if (aJson.success) setAssets(aJson.data.assets || []);
      if (pJson.success) setProjects(pJson.data.projects || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterProject]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setErr(null);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("assetType", uploadType);
      if (uploadTitle) form.append("title", uploadTitle);
      if (uploadTags) form.append("tags", uploadTags);
      if (uploadProject) form.append("projectId", uploadProject);

      const res = await fetch("/api/team/content-studio/assets", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Upload failed");
      setFile(null);
      setUploadTitle("");
      setUploadTags("");
      setMsg("Asset uploaded to R2 and linked.");
      await loadData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/assets/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
          projectId: editProject || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Update failed");
      setEditing(null);
      setMsg("Asset updated.");
      await loadData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this asset from R2 and Asset Library?")) return;
    setErr(null);
    try {
      const res = await fetch(`/api/team/content-studio/assets/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Delete failed");
      setMsg("Asset deleted.");
      await loadData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/team/content-studio" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Content Studio
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">Asset Library</h1>
          <p className="text-sm text-on-surface-variant">
            Centralized media & content assets stored in Cloudflare R2.
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {msg && <div className="rounded-lg bg-tertiary-fixed px-4 py-2 text-sm text-on-tertiary-fixed">{msg}</div>}
      {err && <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-on-error-container">{err}</div>}

      {/* Upload Box */}
      <form onSubmit={handleUpload} className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <Upload className="h-4 w-4 text-primary" /> Upload Asset
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs sm:col-span-2"
          />
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="Title (optional)"
            className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm"
          />
          <select
            value={uploadProject}
            onChange={(e) => setUploadProject(e.target.value)}
            className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm"
          >
            <option value="">Unlinked</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={uploadTags}
            onChange={(e) => setUploadTags(e.target.value)}
            placeholder="Comma-separated tags (e.g., physics, thumbnail, hook)"
            className="w-full sm:w-96 rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={uploading || !file}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload to R2"}
          </button>
        </div>
      </form>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-on-surface-variant" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadData()}
            placeholder="Search by title, prompt, or tag..."
            className="w-full rounded-lg border border-outline-variant bg-surface pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <button onClick={loadData} className="rounded-lg bg-surface-container-high px-3 py-2 text-sm font-medium">
          Search
        </button>
      </div>

      {/* Asset Grid */}
      {loading ? (
        <div className="p-8 text-center text-sm text-on-surface-variant">Loading assets...</div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/60 bg-surface p-8 text-center text-sm text-on-surface-variant">
          No assets match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <div key={a.id} className="rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded bg-primary-fixed px-2 py-0.5 text-[10px] font-semibold text-on-primary-fixed">
                    {a.assetType}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold text-on-surface truncate">{a.title || "Untitled Asset"}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Project: {a.project?.title || "Unlinked"}
                </p>
                {a.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.tags.map((t) => (
                      <span key={t} className="rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-outline-variant/40 pt-3 text-xs">
                <div className="flex items-center gap-3">
                  {a.publicUrl && (
                    <>
                      <button onClick={() => setPreview(a)} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                      <a href={a.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-on-surface hover:underline">
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditing(a);
                      setEditTitle(a.title || "");
                      setEditTags(a.tags.join(", "));
                      setEditProject(a.projectId || "");
                    }}
                    className="text-on-surface-variant hover:text-primary"
                    title="Rename / Tag / Link"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="text-on-surface-variant hover:text-error" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSaveEdit} className="w-full max-w-md rounded-xl bg-surface p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-on-surface">Edit Asset</h3>
              <button type="button" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Linked Project</label>
              <select
                value={editProject}
                onChange={(e) => setEditProject(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="">Unlinked</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Modal */}
      {preview && preview.publicUrl && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-surface p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-on-surface truncate">{preview.title || "Asset Preview"}</h3>
              <button onClick={() => setPreview(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-lg bg-surface-container p-2 text-center">
              {(preview.assetType === "IMAGE" || preview.assetType === "THUMBNAIL") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.publicUrl} alt={preview.title || "Preview"} className="mx-auto max-h-[60vh] object-contain" />
              )}
              {(preview.assetType === "AUDIO" || preview.assetType === "VOICEOVER" || preview.assetType === "MUSIC" || preview.assetType === "SFX") && (
                <audio controls src={preview.publicUrl} className="w-full" />
              )}
              {(preview.assetType === "VIDEO_CLIP" || preview.assetType === "EXPORTED_VIDEO") && (
                <video controls src={preview.publicUrl} className="mx-auto max-h-[60vh]" />
              )}
              {(preview.assetType === "PDF" || preview.assetType === "SLIDE" || preview.assetType === "SCRIPT" || preview.assetType === "CAPTION") && (
                <a href={preview.publicUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline">
                  Open {preview.assetType} in new tab
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
