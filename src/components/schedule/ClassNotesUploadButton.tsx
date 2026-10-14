"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadFileToR2 } from "@/lib/storage/upload-client";

const MAX_BYTES = 50 * 1024 * 1024;

/** Teacher: pick a PDF → it uploads and becomes this class's notes. */
export function ClassNotesUploadButton({ scheduleId, className = "" }: { scheduleId: string; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  type HistoryRow = { at: string; by: string | null; fileName: string; url: string | null; replaced: { fileName?: string | null; url?: string | null } | null };
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function openHistory() {
    setHistoryOpen(true);
    try {
      const res = await fetch(`/api/team/live-class/${encodeURIComponent(scheduleId)}/notes`);
      const body = await res.json().catch(() => ({}));
      setHistory(res.ok && body.success ? body.data.history : []);
    } catch {
      setHistory([]);
    }
  }

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
      toast.success(`Notes added — students now get only this PDF with the class (and in Materials → ${body.data.folder}). The earlier PDF is kept in History.`);
      if (historyOpen) void openHistory();
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
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (historyOpen) setHistoryOpen(false);
            else void openHistory();
          }}
          className="inline-flex items-center py-1 px-1.5 rounded-lg text-[11px] font-semibold border transition bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
          title="Notes history: every PDF attached to this class and what it replaced"
        >
          <span className="material-symbols-outlined text-[13px]">history</span>
        </button>
        {historyOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1 z-50 w-72 max-w-[85vw] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2 text-[11px] text-slate-700 dark:text-slate-200"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold">Notes history</span>
              <button type="button" onClick={() => setHistoryOpen(false)} className="material-symbols-outlined text-[14px] text-slate-400">close</button>
            </div>
            {history === null ? (
              <p className="text-slate-400 py-2">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-slate-400 py-2">No notes PDF has been attached here yet. Students get the board PDF.</p>
            ) : (
              <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                {history.map((h, i) => (
                  <li key={h.at + i} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-1.5">
                    <div className="flex items-center gap-1">
                      {i === 0 && <span className="px-1 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold">SHOWN</span>}
                      {h.url ? (
                        <a href={h.url} target="_blank" rel="noopener noreferrer" className="font-semibold truncate hover:underline">{h.fileName}</a>
                      ) : (
                        <span className="font-semibold truncate">{h.fileName}</span>
                      )}
                    </div>
                    <div className="text-slate-500">
                      {new Date(h.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      {h.by ? ` · ${h.by}` : ""}
                    </div>
                    {h.replaced?.fileName && (
                      <div className="text-slate-500">
                        replaced{" "}
                        {h.replaced.url ? (
                          <a href={h.replaced.url} target="_blank" rel="noopener noreferrer" className="underline">{h.replaced.fileName}</a>
                        ) : (
                          h.replaced.fileName
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </span>
    </>
  );
}
