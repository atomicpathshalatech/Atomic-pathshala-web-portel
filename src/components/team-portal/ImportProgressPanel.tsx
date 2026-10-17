"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OcrProgress } from "@/lib/module-studio/ocr-client";

/**
 * Live state of a module's PDF import, straight from the server
 * (GET /api/team/modules/[id]/process). Nothing here is estimated on the
 * client: the bar shows the server's progress, which only reaches 100% once
 * the server has finished the job.
 */

type PageStatus = {
  pageNumber: number;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "NEEDS_OCR" | "OCR_DONE";
  attempts: number;
  error?: string | null;
  elementsCount: number;
  durationMs?: number;
  source?: "TEXT" | "OCR" | "NONE";
  columns?: 1 | 2;
  images?: number;
  ocrConfidence?: number | null;
  warnings?: string[];
};

export type ImportJob = {
  jobId: string;
  status: "queued" | "processing" | "completed" | "completed_with_errors" | "failed" | "cancelled";
  progress: number;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  ocrPendingPages: number;
  ocrDonePages: number;
  textPages: number;
  currentPage: number | null;
  pageStatuses: Record<number, PageStatus>;
  errorMessage: string | null;
  errorCode: string | null;
  finishedAt: string | null;
};

const STATUS_LABEL: Record<ImportJob["status"], { text: string; cls: string }> = {
  queued: { text: "Queued", cls: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  processing: { text: "Processing", cls: "bg-primary/15 text-primary" },
  completed: { text: "Completed", cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
  completed_with_errors: { text: "Completed — needs attention", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  failed: { text: "Failed", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  cancelled: { text: "Cancelled", cls: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
};

const CHIP: Record<PageStatus["status"], string> = {
  COMPLETED: "bg-green-500 text-white",
  OCR_DONE: "bg-teal-600 text-white",
  NEEDS_OCR: "bg-amber-500 text-white",
  FAILED: "bg-red-500 text-white",
  PROCESSING: "bg-primary text-white animate-pulse",
  QUEUED: "bg-surface-container-high text-on-surface-variant",
};

export function ImportProgressPanel({
  moduleId,
  pdfUrl,
  processing,
  onContinue,
  onChanged,
}: {
  moduleId: string;
  pdfUrl: string;
  /** The editor is driving the import (requesting slice after slice). */
  processing: boolean;
  /** Ask the editor to drive the import to the end (after a retry starts). */
  onContinue: () => void;
  /** Pages changed on the server — reload them. */
  onChanged: () => Promise<void> | void;
}) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState<null | "retry" | "ocr">(null);
  const [ocr, setOcr] = useState<OcrProgress | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/modules/${moduleId}/process`, { cache: "no-store" });
      const body = await res.json();
      if (body?.success) setJob((body.data?.job as ImportJob) ?? null);
    } catch {
      // a dropped poll; the next one will catch up
    }
  }, [moduleId]);

  useEffect(() => {
    void refresh();
    if (!processing && !busy) return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh, processing, busy]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!job) return null;
  const pages = Object.values(job.pageStatuses).sort((a, b) => a.pageNumber - b.pageNumber);
  const failed = pages.filter((p) => p.status === "FAILED");
  const needOcr = pages.filter((p) => p.status === "NEEDS_OCR");
  const problems = pages.filter((p) => p.status === "FAILED" || p.status === "NEEDS_OCR" || (p.warnings?.length ?? 0) > 0);
  const running = job.status === "processing" || job.status === "queued";
  const label = STATUS_LABEL[job.status] ?? STATUS_LABEL.processing;

  async function retry() {
    setBusy("retry");
    setNotice(null);
    try {
      const res = await fetch(`/api/team/modules/${moduleId}/process?action=retry`, { method: "POST" });
      const body = await res.json();
      if (!body?.success) throw new Error(body?.error ?? "Retry could not start.");
      if (!body.data?.done) onContinue();
      await onChanged();
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "Retry could not start." });
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  async function runOcr(pageNumbers: number[]) {
    if (!pageNumbers.length) return;
    setBusy("ocr");
    setNotice(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const { ocrModulePages } = await import("@/lib/module-studio/ocr-client");
      const results = await ocrModulePages(moduleId, pdfUrl, pageNumbers, setOcr, ac.signal);
      const bad = results.filter((r) => !r.ok);
      const good = results.filter((r) => r.ok);
      if (ac.signal.aborted) setNotice({ kind: "ok", text: `OCR stopped. ${good.length} page(s) were recognised before stopping.` });
      else if (bad.length) setNotice({ kind: "error", text: `OCR failed on page ${bad.map((b) => b.pageNumber).join(", ")}: ${bad[0]!.error}` });
      else setNotice({ kind: "ok", text: `OCR done on ${good.length} page(s). Average confidence ${Math.round(good.reduce((n, r) => n + (r.confidence ?? 0), 0) / Math.max(1, good.length))}%. Check the recognised text — formulas and diagrams are not reconstructed.` });
      await onChanged();
    } catch (e) {
      setNotice({ kind: "error", text: `OCR could not run: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      abortRef.current = null;
      setBusy(null);
      setOcr(null);
      void refresh();
    }
  }

  return (
    <div className="space-y-3 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
      <div className="flex flex-wrap items-center justify-between gap-2 text-label-sm">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${label.cls}`}>
            {running && <span className="inline-block w-1.5 h-1.5 mr-1.5 rounded-full bg-current animate-ping align-middle" />}
            {label.text}
          </span>
          {running && job.currentPage && (
            <span className="text-on-surface-variant">
              reading page {job.currentPage} of {job.totalPages}
            </span>
          )}
        </div>
        <span className="font-bold text-on-surface tabular-nums">
          {job.progress}% · {job.completedPages} / {job.totalPages} pages
        </span>
      </div>

      <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${job.progress}%` }} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Stat label="From text layer" value={job.textPages} cls="text-green-700 dark:text-green-400" />
        <Stat label="OCR done" value={job.ocrDonePages} cls="text-teal-700 dark:text-teal-400" />
        <Stat label="Need OCR" value={job.ocrPendingPages} cls="text-amber-700 dark:text-amber-400" />
        <Stat label="Failed" value={job.failedPages} cls="text-red-700 dark:text-red-400" />
      </div>

      {job.errorMessage && (job.status === "failed" || job.status === "completed_with_errors") && (
        <p className={`text-xs rounded-lg px-3 py-2 ${job.status === "failed" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}>
          {job.errorCode && <span className="font-mono font-bold mr-1.5">{job.errorCode}</span>}
          {job.errorMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {failed.length > 0 && !running && !processing && (
          <button type="button" disabled={!!busy} onClick={retry} className="rounded-full border border-red-500/40 text-red-700 dark:text-red-300 px-3.5 py-1.5 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-50">
            {busy === "retry" ? "Retrying…" : `Retry ${failed.length} failed page${failed.length > 1 ? "s" : ""}`}
          </button>
        )}
        {needOcr.length > 0 && !running && !processing && busy !== "ocr" && (
          <button type="button" disabled={!!busy} onClick={() => runOcr(needOcr.map((p) => p.pageNumber))} className="rounded-full border border-amber-500/50 text-amber-800 dark:text-amber-300 px-3.5 py-1.5 text-xs font-semibold hover:bg-amber-500/10 disabled:opacity-50">
            Run OCR on {needOcr.length} page{needOcr.length > 1 ? "s" : ""} (in this browser)
          </button>
        )}
        {busy === "ocr" && (
          <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-full border border-outline-variant/50 px-3.5 py-1.5 text-xs font-semibold hover:bg-surface-container-high">
            Stop OCR
          </button>
        )}
        <a href={`/api/team/modules/${moduleId}/process?report=1`} className="rounded-full border border-outline-variant/50 px-3.5 py-1.5 text-xs font-semibold hover:bg-surface-container-high">
          Download import report
        </a>
      </div>

      {ocr && (
        <p className="text-xs text-on-surface-variant tabular-nums">
          OCR page {ocr.pageNumber} ({ocr.index + 1} of {ocr.total}) —{" "}
          {ocr.phase === "loading" ? "loading the OCR engine and English + Hindi language data (first time only, ~15 MB)…" : ocr.phase === "rendering" ? "rendering the page…" : ocr.phase === "recognising" ? `recognising text ${ocr.percent}%` : "saving…"}
        </p>
      )}
      {notice && <p className={`text-xs ${notice.kind === "error" ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-400"}`}>{notice.text}</p>}

      {pages.length > 0 && (
        <div>
          <p className="text-[11px] uppercase font-bold text-on-surface-variant mb-1.5">Pages</p>
          <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-2 bg-surface-container-high/30 rounded-lg">
            {pages.map((p) => (
              <button
                type="button"
                key={p.pageNumber}
                disabled={p.status !== "NEEDS_OCR" || !!busy || running || processing}
                onClick={() => runOcr([p.pageNumber])}
                title={[
                  `Page ${p.pageNumber}: ${p.status}${p.source ? ` (${p.source})` : ""}`,
                  p.error ? `Error: ${p.error}` : "",
                  p.ocrConfidence != null ? `OCR confidence ${Math.round(p.ocrConfidence)}%` : "",
                  ...(p.warnings ?? []),
                  p.status === "NEEDS_OCR" ? "Click to run OCR on this page" : "",
                ].filter(Boolean).join("\n")}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold disabled:cursor-default ${CHIP[p.status] ?? CHIP.QUEUED}`}
              >
                {p.pageNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      {problems.length > 0 && !running && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-on-surface">Pages that need a look ({problems.length})</summary>
          <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {problems.slice(0, 200).map((p) => (
              <li key={p.pageNumber} className="text-on-surface-variant">
                <span className="font-mono font-bold text-on-surface">p{p.pageNumber}</span> {p.status === "FAILED" ? `failed after ${p.attempts} attempt(s): ${p.error ?? "unknown error"}` : (p.warnings ?? []).join(" · ")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <span className="px-2.5 py-1 rounded-lg bg-surface-container-high/50">
      <span className={`font-bold tabular-nums ${cls}`}>{value}</span> <span className="text-on-surface-variant">{label}</span>
    </span>
  );
}
