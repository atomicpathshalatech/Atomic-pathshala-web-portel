"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadFileToR2 } from "@/lib/storage/upload-client";

/**
 * Staff view of a batch's material tree ("Syllabus & Schedule" and whatever
 * is nested under it).
 *
 * Files go browser → R2 directly through the presigned-URL flow and only
 * their FileAsset id is posted here, so a large syllabus PDF never passes
 * through the Next.js server.
 *
 * Publishing is per folder and per file, and hiding a folder hides
 * everything under it — that is enforced server-side too, so a student
 * cannot reach a file by guessing its id.
 */
type FileNode = {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  isPublished: boolean;
  createdAt: string;
};

type FolderNode = {
  id: string;
  name: string;
  isPublished: boolean;
  files: FileNode[];
  children: FolderNode[];
};

function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function BatchFolderManager({ batchId }: { batchId: string }) {
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/folders`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Could not load folders.");
        return;
      }
      setTree(json.data.tree);
      setCanManage(Boolean(json.data.canManage));
      // First load: open the roots so the tree is not a wall of collapsed rows.
      setExpanded((prev) =>
        prev.size === 0 ? new Set(json.data.tree.map((f: FolderNode) => f.id)) : prev
      );
    } catch {
      setError("Network error while loading folders.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createFolder(parentId: string | null) {
    const name = window.prompt(parentId ? "New sub-folder name" : "New folder name");
    if (!name?.trim()) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not create the folder.");
        return;
      }
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function renameFolder(folder: FolderNode) {
    const name = window.prompt("Rename folder", folder.name);
    if (!name?.trim() || name.trim() === folder.name) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!json.success) toast.error(json.error || "Rename failed.");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  async function setFolderPublished(folder: FolderNode, isPublished: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished }),
      });
      const json = await res.json();
      if (!json.success) toast.error(json.error || "Could not update visibility.");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(folder: FolderNode) {
    const childCount = folder.children.length;
    const fileCount = folder.files.length;
    const warning =
      childCount > 0 || fileCount > 0
        ? `\n\nThis also removes ${childCount} sub-folder(s) and ${fileCount} file listing(s).`
        : "";
    if (!window.confirm(`Delete "${folder.name}"?${warning}`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/team/batches/${batchId}/folders/${folder.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) toast.error(json.error || "Delete failed.");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(file: FileNode) {
    if (!window.confirm(`Remove "${file.title}" from this folder?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/batch-materials/${file.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) toast.error(json.error || "Could not remove the file.");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(file: File, folderId: string) {
    setBusy(true);
    try {
      const uploaded = await uploadFileToR2(file, {
        prefix: "documents",
        fileType: file.type === "application/pdf" ? "PDF" : "DOCUMENT",
        visibility: "PROTECTED",
        entityId: batchId,
      });

      const res = await fetch(`/api/team/batches/${batchId}/folders/${folderId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileAssetId: uploaded.fileAssetId,
          // Default the display title to the filename without its extension —
          // staff can rename later; making them type a title before every
          // upload turns a 10-file batch into 10 prompts.
          title: file.name.replace(/\.[^.]+$/, ""),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Upload saved but could not be filed.");
        return;
      }
      toast.success(`${file.name} uploaded.`);
      setExpanded((prev) => new Set(prev).add(folderId));
      await load();
    } catch (err) {
      console.error("[batch-folders] upload failed:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      setUploadTarget(null);
    }
  }

  function renderFolder(folder: FolderNode, depth: number) {
    const isOpen = expanded.has(folder.id);
    return (
      <div key={folder.id} className="space-y-1.5">
        <div
          className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20"
          style={{ marginLeft: depth * 16 }}
        >
          <button
            type="button"
            onClick={() => toggle(folder.id)}
            className="w-8 h-8 shrink-0 flex items-center justify-center text-on-surface-variant hover:text-primary transition"
            aria-label={isOpen ? "Collapse folder" : "Expand folder"}
          >
            <span className="material-symbols-outlined text-lg">
              {isOpen ? "folder_open" : "folder"}
            </span>
          </button>

          <span className="font-bold text-xs text-on-surface truncate flex-1 min-w-0">
            {folder.name}
          </span>

          <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
            {folder.files.length} file{folder.files.length === 1 ? "" : "s"}
          </span>

          {!folder.isPublished && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
              HIDDEN
            </span>
          )}

          {canManage && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setUploadTarget(folder.id);
                  fileInputRef.current?.click();
                }}
                title="Upload a file here"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">upload_file</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => createFolder(folder.id)}
                title="New sub-folder"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">create_new_folder</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => renameFolder(folder)}
                title="Rename"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setFolderPublished(folder, !folder.isPublished)}
                title={folder.isPublished ? "Hide from students" : "Show to students"}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">
                  {folder.isPublished ? "visibility" : "visibility_off"}
                </span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => deleteFolder(folder)}
                title="Delete folder"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          )}
        </div>

        {isOpen && (
          <>
            {folder.files.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl border border-outline-variant/15 text-xs"
                style={{ marginLeft: (depth + 1) * 16 }}
              >
                <span className="material-symbols-outlined text-base text-error/70 shrink-0">
                  picture_as_pdf
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-on-surface truncate">{f.title}</p>
                  <p className="text-[10px] text-on-surface-variant truncate">
                    {f.fileName} &middot; {formatSize(f.sizeBytes)}
                  </p>
                </div>
                <a
                  href={`/api/batch-materials/${f.id}`}
                  className="px-2.5 min-h-9 rounded-lg bg-primary/10 text-primary font-bold text-[11px] inline-flex items-center gap-1 hover:bg-primary/20 transition shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download
                </a>
                {canManage && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => deleteFile(f)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition disabled:opacity-40 shrink-0"
                    title="Remove"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>
            ))}

            {folder.children.map((child) => renderFolder(child, depth + 1))}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
            Syllabus &amp; Schedule
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Upload PDFs for this batch. Enrolled students can open and download anything published
            here; hiding a folder hides everything inside it.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            disabled={busy}
            onClick={() => createFolder(null)}
            className="px-4 min-h-11 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-sm hover:opacity-90 disabled:opacity-40 transition inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">create_new_folder</span>
            New Folder
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && uploadTarget) void handleUpload(file, uploadTarget);
        }}
      />

      {loading ? (
        <p className="text-xs text-on-surface-variant">Loading folders…</p>
      ) : error ? (
        <div className="glass-card rounded-3xl p-6 border border-error/30 text-xs text-error font-semibold">
          {error}
        </div>
      ) : tree.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 sm:p-12 text-center text-on-surface-variant space-y-2 border border-dashed border-outline-variant/30">
          <span className="material-symbols-outlined text-4xl text-primary opacity-60">folder</span>
          <h4 className="font-bold text-sm text-on-surface">No folders yet</h4>
          <p className="text-xs max-w-md mx-auto">
            Create a folder to start adding this batch&apos;s syllabus and schedule PDFs.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-3xl p-3 sm:p-4 border border-outline-variant/30 space-y-1.5">
          {tree.map((folder) => renderFolder(folder, 0))}
        </div>
      )}
    </div>
  );
}
