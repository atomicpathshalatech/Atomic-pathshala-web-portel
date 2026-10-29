"use client";

import { useEffect, useRef, useState } from "react";
import { RecordedVideoUploader, type UploadProgress } from "@/lib/recorded-lectures/uploader";

export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

const ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov";

/**
 * Pick a video and upload it to the lecture, with progress, pause/resume,
 * retry and cancel. `file` can be passed in (the create form) or picked here.
 * A half-finished upload resumes when the same file is chosen again.
 */
export function VideoUploadPanel({
  lectureId,
  initialFile,
  autoStart = false,
  resumeHint = false,
  onDone,
}: {
  lectureId: string;
  initialFile?: File | null;
  autoStart?: boolean;
  /** The server has an unfinished upload: ask for the same file to resume it. */
  resumeHint?: boolean;
  onDone?: () => void;
}) {
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const uploaderRef = useRef<RecordedVideoUploader | null>(null);
  const started = useRef(false);

  const busy = progress?.phase === "preparing" || progress?.phase === "uploading" || progress?.phase === "finishing";

  // Warn before leaving mid-upload (finished parts are kept; the rest is lost until resumed).
  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  const start = async (f: File) => {
    const u = new RecordedVideoUploader(lectureId, f, setProgress);
    uploaderRef.current = u;
    if (await u.start()) onDone?.();
  };

  useEffect(() => {
    if (autoStart && initialFile && !started.current) {
      started.current = true;
      void start(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialFile]);

  const pct = progress && progress.totalBytes ? Math.round((progress.uploadedBytes / progress.totalBytes) * 100) : 0;

  return (
    <div className="space-y-3">
      {!busy && progress?.phase !== "done" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex-1 min-w-0">
            <span className="sr-only">Video file</span>
            <input
              id={`rl-video-${lectureId}`}
              type="file"
              accept={ACCEPT}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setProgress(null);
                uploaderRef.current = null;
              }}
              className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white file:text-xs file:font-bold"
            />
          </label>
          {file && (
            <button
              type="button"
              onClick={() => void start(file)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2"
            >
              <span className="material-symbols-outlined text-base">upload</span>
              {progress?.phase === "failed" || progress?.phase === "paused" ? "Start again" : "Start upload"}
            </button>
          )}
        </div>
      )}

      {resumeHint && !progress && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          An earlier upload did not finish. Choose the <b>same video file</b> and press Start — only the missing parts are sent.
        </p>
      )}

      {file && !progress && <p className="text-xs text-slate-500">{file.name} · {formatBytes(file.size)}</p>}

      {progress && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 space-y-2" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {progress.phase === "done" ? "Uploaded" : progress.phase === "failed" ? "Upload stopped" : progress.phase === "paused" ? "Paused" : progress.phase === "cancelled" ? "Cancelled" : progress.phase === "finishing" ? "Verifying…" : progress.phase === "preparing" ? "Preparing…" : "Uploading…"}
            </span>
            <span className="font-mono tabular-nums text-slate-500">
              {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)} · {pct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`h-full transition-all ${progress.phase === "failed" ? "bg-rose-500" : progress.phase === "done" ? "bg-emerald-500" : "bg-blue-600"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {progress.message && (
            <p className={`text-xs ${progress.phase === "failed" ? "text-rose-600 dark:text-rose-400" : "text-slate-500"}`}>{progress.message}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {(progress.phase === "uploading" || progress.phase === "preparing") && (
              <button type="button" onClick={() => uploaderRef.current?.pause()} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-bold">
                Pause
              </button>
            )}
            {(progress.phase === "paused" || progress.phase === "failed") && uploaderRef.current && (
              <button
                type="button"
                onClick={async () => {
                  if (await uploaderRef.current?.resume()) onDone?.();
                }}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs font-bold"
              >
                {progress.phase === "failed" ? "Retry" : "Resume"}
              </button>
            )}
            {progress.phase !== "done" && progress.phase !== "cancelled" && progress.phase !== "finishing" && uploaderRef.current && (
              <button type="button" onClick={() => void uploaderRef.current?.cancel()} className="rounded-lg border border-rose-300 text-rose-700 dark:text-rose-300 px-3 py-1 text-xs font-bold">
                Cancel upload
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
