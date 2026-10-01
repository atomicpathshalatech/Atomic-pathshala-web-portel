"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadFileToR2 } from "@/lib/storage/upload-client";

const MAX_BYTES = 50 * 1024 * 1024;

/** Teacher: pick a PDF → it uploads and becomes this class's notes. */
export function ClassNotesUploadButton({ scheduleId, className = "" }: { scheduleId: string; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast.error("Notes must be a PDF file.");
    if (file.size > MAX_BYTES) return toast.error("PDF is too large — keep it under 50 MB.");
    setProgress(0);
    try {
      const up = await uploadFileToR2(file, {
        prefix: "notes",
        fileType: "NOTES",
        subPath: "class-notes",
        entityId: scheduleId,
        visibility: "PROTECTED",
        onProgress: setProgress,
      });
      const res = await fetch(`/api/team/live-class/${encodeURIComponent(scheduleId)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileAssetId: up.fileAssetId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) throw new Error(body.error || "Could not attach the notes.");
      toast.success(`Notes added — students see them with this class and in Materials → ${body.data.folder}.`);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed — try again.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPick} />
      <button
        type="button"
        disabled={progress !== null}
        onClick={(e) => {
          e.stopPropagation();
          input.current?.click();
        }}
        className={`inline-flex items-center gap-1 py-1 px-2.5 rounded-lg text-[11px] font-semibold border transition active:scale-95 disabled:opacity-70 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 ${className}`}
        title="Upload the notes PDF for this class"
      >
        <span className={`material-symbols-outlined text-[13px] ${progress !== null ? "animate-spin" : ""}`}>
          {progress !== null ? "progress_activity" : "upload_file"}
        </span>
        <span>{progress !== null ? `Uploading ${progress}%` : "Notes"}</span>
      </button>
    </>
  );
}
