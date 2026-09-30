"use client";

import { useEffect, useState } from "react";
import type { CompletedClassAssets } from "@/components/schedule/CompletedClassModal";

/**
 * Class notes PDF (annotated board / original slides) for the recorded-class
 * page. Reads the same authoritative /api/schedule/[id]/assets endpoint the
 * old completed-class modal used; `fallbackPdfUrl` covers plain lectures
 * that only carry a slidesUrl.
 */
export function ClassNotesPanel({ classId, fallbackPdfUrl }: { classId: string; fallbackPdfUrl?: string | null }) {
  const [notes, setNotes] = useState<CompletedClassAssets["notes"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesType, setNotesType] = useState<"annotated" | "original">("annotated");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/schedule/${classId}/assets`);
        const json = await res.json();
        if (active && res.ok && json.success) setNotes(json.data.notes);
      } catch {
        // Falls through to fallbackPdfUrl / "unavailable".
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [classId]);

  const ready = notes?.status === "READY" ? notes : null;
  const previewUrl =
    (ready &&
      (notesType === "original"
        ? ready.originalPreviewUrl || ready.originalDownloadUrl
        : ready.previewUrl || ready.downloadUrl)) ||
    fallbackPdfUrl ||
    null;
  const downloadUrl =
    (ready &&
      (notesType === "original"
        ? ready.originalDownloadUrl || ready.originalPreviewUrl
        : ready.downloadUrl || ready.previewUrl)) ||
    fallbackPdfUrl ||
    null;
  const filename =
    notesType === "original" ? notes?.originalFilename || "original_slides.pdf" : notes?.filename || "class_notes.pdf";

  if (loading) {
    return <p className="text-xs text-slate-400 py-8 text-center">Loading notes…</p>;
  }

  if (!previewUrl) {
    const processing = notes?.status === "PROCESSING";
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
          {processing ? "hourglass_top" : "description"}
        </span>
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
          {processing ? "Notes PDF is being generated…" : "Notes are not available for this class"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {ready?.hasOriginalSlides && ready.originalDownloadUrl ? (
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
            {(["annotated", "original"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNotesType(t)}
                className={`py-1 px-2.5 rounded-md transition ${
                  notesType === t ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {t === "annotated" ? "Annotated Board" : "Original Slides"}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
          >
            <span className="material-symbols-outlined text-sm">fullscreen</span>
            Open Full
          </button>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={filename}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Download
            </a>
          )}
        </div>
      </div>

      <iframe
        src={`${previewUrl}#toolbar=0&navpanes=0`}
        title="Class Notes PDF"
        className="w-full h-[60vh] min-h-[340px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900"
      />

      {fullscreen && (
        <div className="fixed inset-0 z-[120] bg-slate-950 flex flex-col">
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-white">
            <span className="text-sm font-bold truncate">Class Notes</span>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              aria-label="Close notes"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <iframe src={`${previewUrl}#toolbar=1&navpanes=0`} title="Class Notes PDF (full)" className="flex-1 w-full border-0 bg-slate-800" />
        </div>
      )}
    </div>
  );
}
