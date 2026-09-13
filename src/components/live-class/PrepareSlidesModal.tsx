"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * Lightweight "prepare slides in advance" modal - deliberately NOT the full
 * PreFlightSetupWizard (which also asks for camera/mic device selection,
 * appropriate right before entering the live room, not days ahead of a
 * scheduled class). Uploads via the same upload-presentation route the
 * wizard uses, then persists via the same /preflight route - now gated by
 * canTeacherPrepareClass instead of the room-entry T-15 window, so this can
 * be used any time before the class starts.
 */
export function PrepareSlidesModal({
  scheduleId,
  classTitle,
  onClose,
  onSaved,
}: {
  scheduleId: string;
  classTitle: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"PDF" | "PPTX">("PDF");
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/team/live-class/${scheduleId}/upload-presentation`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upload failed.");
      }
      setFileName(data.data.filename);
      setFileUrl(data.data.url);
      setFileType(data.data.fileType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!fileUrl) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/live-class/${scheduleId}/preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationUrl: fileUrl,
          presentationName: fileName,
          presentationType: fileType,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not save slides for this class.");
      }
      toast.success("Slides prepared — they'll auto-load when you start this class.");
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save slides for this class.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Prepare Slides — {classTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Upload a PDF or PPTX now — it'll load automatically as this class's first slide the moment you start it.
        </p>

        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 cursor-pointer hover:border-blue-400 transition">
          <span className="material-symbols-outlined text-3xl text-slate-400">upload_file</span>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {uploading ? "Uploading…" : fileName || "Click to choose a PDF or PPTX"}
          </span>
          <input
            type="file"
            accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="hidden"
            disabled={uploading || saving}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </label>

        {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!fileUrl || saving || uploading}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Slides"}
          </button>
        </div>
      </div>
    </div>
  );
}
