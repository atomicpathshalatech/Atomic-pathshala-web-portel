"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { getMasterNcertChapters } from "@/lib/academic/master-ncert-catalog";
import { uploadFileToR2 } from "@/lib/storage/upload-client";
import { api, answerText, optionEntries, SUBJECTS } from "./api-client";
import { PyqStyles } from "./PyqStyles";
import { ocrPyqPages, releasePyqOcr } from "./pyq-ocr-client";

type Chunk = { index: number; firstPage: number; lastPage: number; isVision: boolean; status: string; extractedQuestionsCount: number; method?: string; error?: string };
type Status = {
  job: { id: string; sourceName: string; fileName: string; fileUrl: string; status: string; progress: number; currentStep: string | null; yearMode: string; pyqYear: number | null; extractedCount: number; pyqExamRef: { id: string; name: string } | null; cancelRequested: boolean };
  plan: { totalPages: number; totalChunks: number; chunks: Chunk[]; processedPages: number; failedPages: number } | null;
  ocrPagesNeeded: number[];
  ocrPagesDone: number;
  aiFallback: boolean;
  counts: { decisions: Record<string, number>; needsChapterReview: number; duplicatesToResolve: number; missingYear: number };
};
type Candidate = { subject: string; chapter: string; topic: string | null; score: number };
type Row = {
  id: string;
  originalNumber: number;
  sourcePage: number;
  sourcePageUrl: string | null;
  statement: string;
  options: Record<string, string>;
  correctAnswer: string;
  solution: string | null;
  imageUrl: string | null;
  pyqExamId: string | null;
  pyqExamRef: { id: string; name: string } | null;
  pyqYear: number | null;
  pyqSession: string | null;
  pyqShift: string | null;
  pyqPaper: string | null;
  sectionLabel: string | null;
  metadataMethod: string | null;
  extractionMethod: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  difficulty: string;
  questionType: string;
  chapterCandidates: Candidate[] | null;
  needsChapterReview: boolean;
  duplicateOfQuestionId: string | null;
  duplicateScore: number | null;
  duplicateDecision: string | null;
  reviewDecision: string;
  reviewReasons: string[] | null;
  blockers: string[];
  duplicateOf: null | {
    id: string;
    questionCode: string | null;
    subject: string;
    chapter: string | null;
    translations: { statement: string; options: unknown; correctOptionIds: unknown }[];
    pyqOccurrences: { year: number | null; session: string | null; shift: string | null; verificationStatus: string; exam: { name: string } }[];
  };
};
type Exam = { id: string; name: string };

const METHOD_LABEL: Record<string, string> = {
  ADMIN_DOCUMENT: "from import settings",
  SECTION_HEADING: "from section heading",
  QUESTION_TAG: "from question tag",
  MANUAL: "set by reviewer",
  NONE: "not detected",
};

export function PyqImportReview({ jobId, canApprove }: { jobId: string; canApprove: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState("pending");
  const [issue, setIssue] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [running, setRunning] = useState(false);
  const [ocr, setOcr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bulkChapter, setBulkChapter] = useState({ subject: "", chapter: "" });
  const [bulkYear, setBulkYear] = useState({ examId: "", year: "" });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const runnerRef = useRef(false);
  const ocrAbort = useRef<AbortController | null>(null);

  const loadStatus = useCallback(async () => {
    const s = await api<Status>(`/api/team/pyq/imports/${jobId}`);
    setStatus(s);
    return s;
  }, [jobId]);

  const loadRows = useCallback(async () => {
    const d = await api<{ total: number; items: Row[] }>(`/api/team/pyq/imports/${jobId}/questions?view=${view}&issue=${issue}&page=${page}&pageSize=25`);
    setRows(d.items);
    setTotal(d.total);
  }, [jobId, view, issue, page]);

  useEffect(() => {
    if (status?.job.status !== "PROCESSING" && !running) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [status?.job.status, running]);

  // Periodic polling to keep import progress, chunks, and questions dynamically in sync
  useEffect(() => {
    if (status?.job.status !== "PROCESSING" && !running) return;
    const pollInterval = setInterval(async () => {
      try {
        const s = await loadStatus();
        if (s?.job.extractedCount !== status?.job.extractedCount) {
          loadRows().catch(() => {});
        }
      } catch {
        // ignore polling errors
      }
    }, 2500);
    return () => clearInterval(pollInterval);
  }, [status?.job.status, status?.job.extractedCount, running, loadStatus, loadRows]);

  useEffect(() => {
    loadStatus().catch((e) => toast.error(e.message));
    api<{ exams: Exam[] }>("/api/team/pyq/exams?verification=ALL").then((d) => setExams(d.exams)).catch(() => undefined);
  }, [loadStatus]);

  useEffect(() => {
    loadRows().catch((e) => toast.error(e.message));
  }, [loadRows]);

  useEffect(() => setSelected(new Set()), [view, issue, page]);

  // Keeps the import moving while this page is open: one page group per call.
  const runImport = useCallback(async () => {
    if (runnerRef.current) return;
    runnerRef.current = true;
    setRunning(true);
    try {
      for (let i = 0; i < 400; i++) {
        const r = await api<{ isComplete?: boolean; busy?: boolean; cancelled?: boolean; questionsExtracted?: number }>(`/api/team/pyq/imports/${jobId}`, { method: "POST", json: { action: "run" } });
        const s = await loadStatus();
        if (r.busy) await new Promise((res) => setTimeout(res, 4000));
        if (r.isComplete || r.cancelled || s.job.status !== "PROCESSING") break;
        if (i % 3 === 0) await loadRows();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      runnerRef.current = false;
      setRunning(false);
      loadRows().catch(() => undefined);
    }
  }, [jobId, loadStatus, loadRows]);

  useEffect(() => {
    if (status?.job.status === "PROCESSING" && !runnerRef.current) runImport();
  }, [status?.job.status, runImport]);

  useEffect(() => () => {
    ocrAbort.current?.abort();
    releasePyqOcr();
  }, []);

  async function act(action: "cancel" | "resume" | "retry-failed" | "retry-chunk", chunkIndex?: number) {
    try {
      const r = await api<{ requeued?: number }>(`/api/team/pyq/imports/${jobId}`, {
        method: "POST",
        json: { action, chunkIndex },
      });
      if (action === "retry-chunk") {
        toast.success(`Chunk ${Number(chunkIndex) + 1} queued for retry.`);
      } else if (action !== "cancel") {
        toast.success(`${r.requeued ?? 0} page group(s) queued.`);
      }
      await loadStatus();
      if (action !== "cancel") {
        runImport();
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function runOcr() {
    if (!status) return;
    ocrAbort.current = new AbortController();
    try {
      const res = await ocrPyqPages(jobId, status.job.fileUrl, status.ocrPagesNeeded, (p) => setOcr(`OCR page ${p.pageNumber} (${p.index + 1}/${p.total}) — ${p.phase} ${p.percent}%`), ocrAbort.current.signal);
      const failed = res.filter((r) => !r.ok);
      if (failed.length) toast.error(`${failed.length} page(s) could not be read: ${failed[0]!.error}`);
      else toast.success(`Read ${res.length} scanned page(s).`);
      await loadStatus();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOcr(null);
    }
  }

  async function review(body: Record<string, unknown>, success: (d: any) => string) {
    setBusy(true);
    try {
      const d = await api(`/api/team/pyq/imports/${jobId}/review`, { method: "POST", json: body });
      toast.success(success(d));
      const failed = (d.results as { ok: boolean; problems?: string[] }[] | undefined)?.filter((r) => !r.ok) ?? [];
      if (failed.length) toast.warning(`${failed.length} not approved: ${failed[0]!.problems?.join(" ")}`);
      setSelected(new Set());
      await Promise.all([loadRows(), loadStatus()]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(row: Row, patch: Record<string, unknown>) {
    try {
      await api(`/api/team/pyq/imports/${jobId}/questions/${row.id}`, { method: "PATCH", json: patch });
      toast.success("Saved");
      setEditing(null);
      await loadRows();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (!status) return <p className="text-sm text-slate-500 p-4">Loading import…</p>;
  const { job, plan, counts } = status;
  const d = counts.decisions;
  const ids = Array.from(selected);

  return (
    <div className="space-y-4 text-sm">
      <PyqStyles />
      {/* Header + real progress */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="min-w-0">
            <Link href="/team/pyq-library/import" className="text-xs font-bold text-blue-600">
              ← Imports
            </Link>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">{job.sourceName}</h1>
            <p className="text-xs text-slate-500">
              {job.pyqExamRef?.name} · {job.yearMode === "MULTI" ? "several years (detected per question)" : job.pyqYear} ·{" "}
              <a href={job.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                original PDF ({job.fileName})
              </a>
            </p>
          </div>
          <div className="ml-auto flex gap-2 flex-wrap">
            {job.status === "PROCESSING" && !job.cancelRequested && (
              <button type="button" onClick={() => act("cancel")} className="pyq-btn-danger">
                Cancel
              </button>
            )}
            {(job.status === "CANCELLED" || job.cancelRequested) && (
              <button type="button" onClick={() => act("resume").then(runImport)} className="pyq-btn">
                Resume
              </button>
            )}
            {(plan?.failedPages ?? 0) > 0 && (
              <button type="button" onClick={() => act("retry-failed").then(runImport)} className="pyq-btn">
                Retry failed pages
              </button>
            )}
            <a href={`/api/team/pyq/imports/${jobId}/report`} className="pyq-btn">
              Export report (CSV)
            </a>
          </div>
        </div>
        {(() => {
          const processedPages = plan?.processedPages ?? 0;
          const totalPages = plan?.totalPages ?? 1;
          const completedChunks = plan?.chunks.filter((c) => c.status === "COMPLETED").length ?? 0;
          const failedChunks = plan?.chunks.filter((c) => c.status === "FAILED").length ?? 0;
          const totalChunks = plan?.totalChunks ?? 1;
          const displayPercent = Math.max(
            job.progress,
            Math.round(((completedChunks + failedChunks) / Math.max(1, totalChunks)) * 100)
          );
          const speed = elapsedSeconds > 5 && processedPages > 0 ? ((processedPages / elapsedSeconds) * 60).toFixed(1) + " p/min" : null;
          const remainingPages = Math.max(0, totalPages - processedPages);
          const etaSec = speed && remainingPages > 0 && processedPages > 0 ? Math.round(remainingPages / (processedPages / elapsedSeconds)) : null;
          const formatSec = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

          return (
            <div className="space-y-3">
              <div className="space-y-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${job.status === "PROCESSING" ? "bg-blue-600 animate-pulse" : job.status === "COMPLETED" || job.status === "REVIEW_REQUIRED" ? "bg-emerald-500" : "bg-slate-400"}`} />
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {job.status === "PROCESSING" ? "Processing PDF (Multimodal AI & Text Extraction)..." : job.status === "REVIEW_REQUIRED" ? "Extraction Ready — Review Questions" : job.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    {job.status === "PROCESSING" && (
                      <>
                        <span>⏱️ Elapsed: <b>{formatSec(elapsedSeconds)}</b></span>
                        {etaSec ? <span>⏳ Est. remaining: <b>~{formatSec(etaSec)}</b></span> : null}
                        {speed ? <span className="text-blue-600 dark:text-blue-400 font-bold">⚡ {speed}</span> : null}
                      </>
                    )}
                    <span className="font-black text-blue-600 dark:text-blue-400 text-sm">{displayPercent}%</span>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(displayPercent, 2))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {running ? "⚡ Active: " : ""}{job.currentStep || "Reading document structure..."}
                  </span>
                  {plan && (
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      Page {processedPages} of {totalPages} • Chunk {Math.min(completedChunks + 1, plan.totalChunks)} of {plan.totalChunks}
                    </span>
                  )}
                </div>
              </div>

              {/* Chunk Progress Pipeline */}
              {plan && plan.chunks && plan.chunks.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden text-xs">
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Page Groups Pipeline ({plan.chunks.length} Chunks)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        • {completedChunks} Done • {plan.chunks.filter(c => c.status === "PROCESSING").length} Active • {plan.chunks.filter(c => c.status === "PENDING").length} Queued{failedChunks > 0 ? ` • ${failedChunks} Failed` : ''}
                      </span>
                    </div>
                    {job.status === "PROCESSING" && !running && (
                      <button
                        type="button"
                        onClick={() => runImport()}
                        className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 text-[11px] flex items-center gap-1 shadow-sm transition-colors"
                      >
                        ⚡ Resume / Next Chunk
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                    {plan.chunks.map((c) => {
                      const isActive = running && c.status === "PROCESSING";
                      return (
                        <div
                          key={c.index}
                          className={`flex items-center justify-between px-3.5 py-2 gap-3 transition-colors ${
                            isActive ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-[150px]">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                c.status === 'COMPLETED'
                                  ? 'bg-emerald-500'
                                  : c.status === 'PROCESSING'
                                  ? 'bg-blue-500 animate-pulse'
                                  : c.status === 'FAILED'
                                  ? 'bg-red-500'
                                  : c.status === 'NEEDS_OCR'
                                  ? 'bg-amber-500'
                                  : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                            />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              Chunk {c.index + 1}
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              (Pages {c.firstPage}–{c.lastPage})
                            </span>
                          </div>

                          <div className="flex-1 flex items-center gap-2 text-[11px] truncate">
                            {c.status === 'COMPLETED' && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                                ✓ Extracted {c.extractedQuestionsCount} question{c.extractedQuestionsCount === 1 ? '' : 's'}
                                {c.method && (
                                  <span className="text-slate-400 text-[10px]">
                                    ({c.method.replace('_', ' ')})
                                  </span>
                                )}
                              </span>
                            )}
                            {c.status === 'PROCESSING' && (
                              <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                                <span className="inline-block animate-spin">⏳</span> Reading pages and extracting questions...
                              </span>
                            )}
                            {c.status === 'PENDING' && (
                              <span className="text-slate-400">
                                Queued in pipeline
                              </span>
                            )}
                            {c.status === 'FAILED' && (
                              <span className="text-red-600 dark:text-red-400 font-medium truncate" title={c.error}>
                                Failed: {c.error || 'Check pages or OCR'}
                              </span>
                            )}
                            {c.status === 'NEEDS_OCR' && (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Scanned pages — run OCR above
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {c.status === 'FAILED' && (
                              <button
                                type="button"
                                onClick={() => act("retry-chunk", c.index)}
                                className="px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold text-[10px] transition-colors"
                              >
                                🔄 Retry
                              </button>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                c.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : c.status === 'PROCESSING'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : c.status === 'FAILED'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                  : c.status === 'NEEDS_OCR'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
          {[
            ["Pages", plan?.totalPages ?? 0],
            ["Pages read", plan?.processedPages ?? 0],
            ["Failed pages", plan?.failedPages ?? 0],
            ["Extracted", job.extractedCount],
            ["Approved", d.APPROVED ?? 0],
            ["Awaiting review", (d.PENDING ?? 0) + (d.APPROVING ?? 0)],
            ["Needs chapter", counts.needsChapterReview],
            ["Duplicates to resolve", counts.duplicatesToResolve],
          ].map(([label, n]) => (
            <div key={String(label)} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2">
              <div className="text-base font-black">{n}</div>
              <div className="text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        {status.ocrPagesNeeded.length > 0 && (
          <div className="rounded-xl bg-amber-50 text-amber-900 p-3 text-xs flex items-center gap-3 flex-wrap">
            <span>
              {status.ocrPagesNeeded.length} scanned page(s) have no text layer.{" "}
              {status.aiFallback ? "AI extraction is available, or" : "Read them with OCR"} in this browser (English + Hindi; diagrams/equations are flagged for review).
            </span>
            <button type="button" disabled={Boolean(ocr)} onClick={runOcr} className="pyq-btn-primary ml-auto">
              {ocr ?? `Run OCR on ${status.ocrPagesNeeded.length} page(s)`}
            </button>
            {ocr && (
              <button type="button" onClick={() => ocrAbort.current?.abort()} className="pyq-btn">
                Stop
              </button>
            )}
          </div>
        )}
        {plan && plan.chunks.some((c) => c.error) && (
          <details className="text-xs">
            <summary className="cursor-pointer font-bold text-red-700">Page groups with problems</summary>
            <ul className="mt-1 space-y-1">
              {plan.chunks
                .filter((c) => c.error)
                .map((c) => (
                  <li key={c.index}>
                    Pages {c.firstPage}–{c.lastPage}: <b>{c.status.replace("_", " ").toLowerCase()}</b> — {c.error}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>

      {/* Review list */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {[
            ["pending", `Awaiting review (${(d.PENDING ?? 0) + (d.APPROVING ?? 0)})`],
            ["approved", `Approved (${d.APPROVED ?? 0})`],
            ["rejected", `Rejected (${d.REJECTED ?? 0})`],
            ["all", "All"],
          ].map(([v, label]) => (
            <button key={v} type="button" onClick={() => (setView(v!), setPage(1))} className={`px-3 py-1.5 rounded-full font-bold ${view === v ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>
              {label}
            </button>
          ))}
          <select value={issue} onChange={(e) => (setIssue(e.target.value), setPage(1))} className="pyq-input ml-auto">
            <option value="">Any issue</option>
            <option value="chapter">Needs chapter review ({counts.needsChapterReview})</option>
            <option value="duplicate">Duplicate to resolve ({counts.duplicatesToResolve})</option>
            <option value="year">Year missing ({counts.missingYear})</option>
            <option value="answer">Answer missing</option>
          </select>
          {canApprove && view === "pending" && (
            <button type="button" disabled={busy} onClick={() => review({ action: "approve-ready" }, (r) => `Approved ${r.approved} ready question(s)${r.published ? " and published them" : " as drafts"}.`)} className="pyq-btn-primary">
              Approve all ready
            </button>
          )}
        </div>

        {view === "pending" && (
          <div className="flex items-center gap-2 flex-wrap text-xs rounded-xl bg-slate-50 dark:bg-slate-800 p-2">
            <label className="flex items-center gap-1 font-bold">
              <input type="checkbox" checked={rows.length > 0 && rows.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
              {selected.size} selected
            </label>
            {canApprove && (
              <button type="button" disabled={!ids.length || busy} onClick={() => review({ action: "approve", ids }, (r) => `Approved ${r.approved} of ${ids.length}.`)} className="pyq-btn">
                Approve
              </button>
            )}
            <button type="button" disabled={!ids.length || busy} onClick={() => review({ action: "reject", ids }, (r) => `Rejected ${r.rejected}.`)} className="pyq-btn-danger">
              Reject
            </button>
            <span className="mx-1 text-slate-300">|</span>
            <select value={bulkChapter.subject} onChange={(e) => setBulkChapter({ subject: e.target.value, chapter: "" })} className="pyq-input">
              <option value="">Subject…</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select value={bulkChapter.chapter} disabled={!bulkChapter.subject} onChange={(e) => setBulkChapter((b) => ({ ...b, chapter: e.target.value }))} className="pyq-input max-w-[14rem]">
              <option value="">Chapter…</option>
              {(bulkChapter.subject ? getMasterNcertChapters(bulkChapter.subject) : []).map((c) => (
                <option key={c.id} value={c.title}>
                  {c.displayTitle}
                </option>
              ))}
            </select>
            <button type="button" disabled={!ids.length || !bulkChapter.chapter || busy} onClick={() => review({ action: "set-chapter", ids, ...bulkChapter }, (r) => `Chapter set on ${r.updated}.`)} className="pyq-btn">
              Set chapter
            </button>
            <span className="mx-1 text-slate-300">|</span>
            <select value={bulkYear.examId} onChange={(e) => setBulkYear((b) => ({ ...b, examId: e.target.value }))} className="pyq-input">
              <option value="">Exam…</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <input value={bulkYear.year} onChange={(e) => setBulkYear((b) => ({ ...b, year: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="Year" className="pyq-input w-20" />
            <button
              type="button"
              disabled={!ids.length || !bulkYear.examId || bulkYear.year.length !== 4 || busy}
              onClick={() => review({ action: "set-year", ids, examId: bulkYear.examId, year: Number(bulkYear.year) }, (r) => `Exam/year set on ${r.updated}.`)}
              className="pyq-btn"
            >
              Set exam & year
            </button>
          </div>
        )}

        {rows.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">{job.status === "PROCESSING" ? "Questions appear here as pages are read." : "Nothing in this view."}</p>}

        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-xl border p-3 ${r.blockers.length ? "border-amber-200" : "border-slate-200 dark:border-slate-800"}`}>
              <div className="flex items-start gap-2">
                {view === "pending" && <input type="checkbox" className="mt-1" checked={selected.has(r.id)} onChange={() => setSelected((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} />}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="font-mono font-bold">Q{r.originalNumber}</span>
                    {r.sourcePageUrl ? (
                      <a href={r.sourcePageUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">
                        Source page {r.sourcePage}
                      </a>
                    ) : (
                      <span>Page {r.sourcePage}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full font-bold ${r.pyqYear ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
                      {r.pyqExamRef?.name ?? "Exam?"} {r.pyqYear ?? "year?"}
                      {r.pyqSession ? ` · ${r.pyqSession}` : ""}
                      {r.pyqShift ? ` · ${r.pyqShift}` : ""}
                      {r.pyqPaper ? ` · ${r.pyqPaper}` : ""}
                    </span>
                    <span className="text-slate-400">({METHOD_LABEL[r.metadataMethod ?? "NONE"] ?? r.metadataMethod}{r.sectionLabel ? `: “${r.sectionLabel}”` : ""})</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${r.chapter ? "bg-slate-100 dark:bg-slate-800" : "bg-red-50 text-red-700"}`}>
                      {r.subject} · {r.chapter ?? "Needs Chapter Review"}
                      {r.topic ? ` · ${r.topic}` : ""}
                      {r.subTopic ? ` › ${r.subTopic}` : ""}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      r.difficulty === "EASY"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : r.difficulty === "HARD"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {r.difficulty || "MEDIUM"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-sky-50 text-sky-700 border border-sky-200 font-mono">
                      {(r.questionType || "SINGLE_CORRECT").replace(/_/g, " ")}
                    </span>
                    {r.extractionMethod && <span className="text-slate-400">{r.extractionMethod.replace("_", " ").toLowerCase()}</span>}
                    {r.reviewDecision !== "PENDING" && <span className="ml-auto font-bold">{r.reviewDecision}</span>}
                  </div>

                  {editing === r.id ? (
                    <Editor row={r} exams={exams} onCancel={() => setEditing(null)} onSave={(patch) => save(r, patch)} />
                  ) : (
                    <>
                      <div className="[overflow-wrap:anywhere]">
                        <FormulaText text={r.statement} className="block" />
                      </div>
                      {r.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- cropped figure from object storage
                        <img src={r.imageUrl} alt="Extracted figure" className="max-h-40 rounded-lg border border-slate-200" />
                      )}
                      <div className="grid sm:grid-cols-2 gap-1 text-xs">
                        {optionEntries(r.options).map(([k, v]) => (
                          <div key={k} className={`flex gap-1.5 [overflow-wrap:anywhere] ${r.correctAnswer.split(",").includes(k) ? "text-emerald-700 font-bold" : ""}`}>
                            <b>{k}.</b>
                            <FormulaText text={v} className="block" />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs">
                        <b>Answer:</b> {r.correctAnswer ? answerText(r.correctAnswer.split(",")) : <span className="text-red-600">not in the PDF — set it</span>}
                      </p>
                      {r.solution && (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-bold text-slate-600">Solution</summary>
                          <FormulaText text={r.solution} className="block mt-1" />
                        </details>
                      )}
                    </>
                  )}

                  {r.chapterCandidates && r.chapterCandidates.length > 0 && r.reviewDecision === "PENDING" && !r.chapter && (
                    <div className="flex items-center gap-1 flex-wrap text-[11px]">
                      <span className="text-slate-500">Suggested chapters:</span>
                      {r.chapterCandidates.map((c) => (
                        <button key={`${c.subject}:${c.chapter}`} type="button" onClick={() => save(r, { subject: c.subject, chapter: c.chapter, topic: c.topic })} className="px-2 py-0.5 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50">
                          {c.chapter} <span className="text-slate-400">({c.score})</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {r.duplicateOf && r.duplicateDecision === "PENDING" && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/50 dark:bg-violet-950/20 p-2 text-xs space-y-2">
                      <p className="font-bold text-violet-800 dark:text-violet-300">
                        Possible duplicate ({r.duplicateScore}% match) of {r.duplicateOf.questionCode ?? r.duplicateOf.id} — {r.duplicateOf.subject} · {r.duplicateOf.chapter ?? "no chapter"}
                      </p>
                      <div className="[overflow-wrap:anywhere] text-slate-700 dark:text-slate-300">
                        <FormulaText text={r.duplicateOf.translations[0]?.statement ?? ""} className="block" />
                      </div>
                      <p className="text-slate-500">
                        Existing occurrences: {r.duplicateOf.pyqOccurrences.length ? r.duplicateOf.pyqOccurrences.map((o) => `${o.exam.name} ${o.year ?? "?"}${o.shift ? ` ${o.shift}` : ""}`).join(", ") : "none"}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <button type="button" onClick={() => review({ action: "duplicate", id: r.id, decision: "LINKED" }, () => "Will add this exam/year to the existing question on approval.")} className="pyq-btn">
                          Same question — link this occurrence
                        </button>
                        <button type="button" onClick={() => review({ action: "duplicate", id: r.id, decision: "KEEP_SEPARATE" }, () => "Kept separate.")} className="pyq-btn">
                          Different — keep separate
                        </button>
                        <button type="button" onClick={() => review({ action: "duplicate", id: r.id, decision: "IGNORED" }, () => "Warning ignored.")} className="pyq-btn">
                          Ignore warning
                        </button>
                      </div>
                    </div>
                  )}

                  {r.blockers.length > 0 && (
                    <ul className="text-[11px] text-amber-800 list-disc ml-4">
                      {r.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}

                  {r.reviewDecision === "PENDING" && editing !== r.id && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(r.id)} className="pyq-btn">
                        Edit
                      </button>
                      {canApprove && (
                        <button type="button" disabled={busy || r.blockers.length > 0} onClick={() => review({ action: "approve", ids: [r.id] }, (x) => (x.approved ? "Approved." : "Not approved."))} className="pyq-btn-primary">
                          Approve
                        </button>
                      )}
                      <button type="button" disabled={busy} onClick={() => review({ action: "reject", ids: [r.id] }, () => "Rejected.")} className="pyq-btn-danger">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {total > 25 && (
          <div className="flex items-center justify-center gap-3 text-xs">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="pyq-btn">
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(total / 25)} ({total})
            </span>
            <button type="button" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((p) => p + 1)} className="pyq-btn">
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Editor({ row, exams, onSave, onCancel }: { row: Row; exams: Exam[]; onSave: (patch: Record<string, unknown>) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    statement: row.statement,
    A: row.options.A ?? "",
    B: row.options.B ?? "",
    C: row.options.C ?? "",
    D: row.options.D ?? "",
    correctAnswer: row.correctAnswer,
    solution: row.solution ?? "",
    imageUrl: row.imageUrl ?? "",
    pyqExamId: row.pyqExamId ?? "",
    pyqYear: row.pyqYear ? String(row.pyqYear) : "",
    pyqSession: row.pyqSession ?? "",
    pyqShift: row.pyqShift ?? "",
    pyqPaper: row.pyqPaper ?? "",
    subject: row.subject,
    chapter: row.chapter ?? "",
    topic: row.topic ?? "",
    subTopic: row.subTopic ?? "",
    difficulty: row.difficulty || "MEDIUM",
    questionType: row.questionType || "SINGLE_CORRECT",
  });
  const [uploading, setUploading] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const chapters = SUBJECTS.includes(f.subject as (typeof SUBJECTS)[number]) ? getMasterNcertChapters(f.subject) : [];

  return (
    <div className="space-y-2 text-xs">
      <textarea value={f.statement} onChange={set("statement")} rows={4} className="pyq-input w-full font-mono" />
      <div className="grid sm:grid-cols-2 gap-2">
        {(["A", "B", "C", "D"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <b>{k}</b>
            <input value={f[k]} onChange={set(k)} className="pyq-input flex-1" />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <input value={f.correctAnswer} onChange={set("correctAnswer")} placeholder="Answer (A / A,C)" className="pyq-input" />
        <select value={f.pyqExamId} onChange={set("pyqExamId")} className="pyq-input">
          <option value="">Exam…</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <input value={f.pyqYear} onChange={(e) => setF((x) => ({ ...x, pyqYear: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="Year" className="pyq-input" />
        <input value={f.pyqSession} onChange={set("pyqSession")} placeholder="Session" className="pyq-input" />
        <input value={f.pyqShift} onChange={set("pyqShift")} placeholder="Shift" className="pyq-input" />
        <input value={f.pyqPaper} onChange={set("pyqPaper")} placeholder="Paper" className="pyq-input" />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <select value={f.subject} onChange={(e) => setF((x) => ({ ...x, subject: e.target.value, chapter: "" }))} className="pyq-input">
          {Array.from(new Set([...SUBJECTS, f.subject])).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={f.chapter} onChange={set("chapter")} className="pyq-input">
          <option value="">Chapter…</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.title}>
              {c.displayTitle}
            </option>
          ))}
          {f.chapter && !chapters.some((c) => c.title === f.chapter) && <option value={f.chapter}>{f.chapter}</option>}
        </select>
      </div>
      <div className="grid sm:grid-cols-4 gap-2">
        <input value={f.topic} onChange={set("topic")} placeholder="Topic" className="pyq-input" />
        <input value={f.subTopic} onChange={set("subTopic")} placeholder="Subtopic" className="pyq-input" />
        <select value={f.difficulty} onChange={set("difficulty")} className="pyq-input">
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
          <option value="VERY_HARD">Very Hard</option>
        </select>
        <select value={f.questionType} onChange={set("questionType")} className="pyq-input">
          <option value="SINGLE_CORRECT">Single Correct</option>
          <option value="MULTIPLE_CORRECT">Multiple Correct</option>
          <option value="INTEGER">Integer</option>
          <option value="NUMERICAL">Numerical</option>
          <option value="ASSERTION_REASON">Assertion Reason</option>
          <option value="MATCH_THE_COLUMN">Match The Column</option>
        </select>
      </div>
      <textarea value={f.solution} onChange={set("solution")} rows={3} placeholder="Solution" className="pyq-input w-full font-mono" />
      <div className="flex items-center gap-2 flex-wrap">
        <input value={f.imageUrl} onChange={set("imageUrl")} placeholder="Figure image URL" className="pyq-input flex-1" />
        <label className="pyq-btn cursor-pointer">
          {uploading ? "Uploading…" : "Upload figure"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const up = await uploadFileToR2(file, { prefix: "question-images", fileType: "IMAGE", visibility: "PUBLIC" });
                if (!up.url) throw new Error("Upload finished but no public link came back.");
                setF((x) => ({ ...x, imageUrl: up.url! }));
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
        {f.imageUrl && (
          <button type="button" onClick={() => setF((x) => ({ ...x, imageUrl: "" }))} className="pyq-btn-danger">
            Remove figure
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onSave({
              statement: f.statement,
              options: { A: f.A, B: f.B, C: f.C, D: f.D },
              correctAnswer: f.correctAnswer,
              solution: f.solution || null,
              imageUrl: f.imageUrl || null,
              pyqExamId: f.pyqExamId || null,
              pyqYear: f.pyqYear ? Number(f.pyqYear) : null,
              pyqSession: f.pyqSession || null,
              pyqShift: f.pyqShift || null,
              pyqPaper: f.pyqPaper || null,
              subject: f.subject,
              chapter: f.chapter || null,
              topic: f.topic || null,
              subTopic: f.subTopic || null,
              difficulty: f.difficulty,
              questionType: f.questionType,
            })
          }
          className="pyq-btn-primary"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="pyq-btn">
          Cancel
        </button>
      </div>
    </div>
  );
}
