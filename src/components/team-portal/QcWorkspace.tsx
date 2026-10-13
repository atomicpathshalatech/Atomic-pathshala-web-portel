"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, Loader2, Play, RefreshCw, Search, ShieldCheck, Square, X, XCircle } from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { QcDuplicates } from "@/components/team-portal/QcDuplicates";

type Overview = {
  total: number;
  statusCounts: Record<string, number>;
  subjects: Record<string, Record<string, number>>;
  chapters: { subject: string; chapter: string | null; count: number }[];
  corrections: Record<string, number>;
  findingCategories: { category: string; count: number }[];
  usage: { feature: string; model: string; calls: number; inputTokens: number; outputTokens: number; durationMs: number }[];
  failedCalls: number;
};

type QueueItem = {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  type: string;
  status: string;
  qcStatus: string;
  qcReviewedAt: string | null;
  preview: string;
  findings: number;
  openCorrections: number;
};

type Finding = {
  id: string;
  source: string;
  category: string;
  severity: string;
  description: string;
  evidence: string | null;
  directorDecision: string | null;
  directorReason: string | null;
  finalAction: string | null;
};

type Review = {
  id: string;
  agent: string;
  status: string;
  model: string;
  promptVersion: string;
  storedAnswer: string | null;
  derivedAnswer: string | null;
  answerMatches: boolean | null;
  result: any;
  calcChecks: any;
  references: any;
  modelConfidence: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  findings: Finding[];
};

type Correction = {
  id: string;
  field: string;
  language: string | null;
  originalValue: string | null;
  proposedValue: string;
  reason: string;
  evidence: string | null;
  status: string;
  decisionNote: string | null;
  appliedVersion: number | null;
  createdAt: string;
};

type Detail = {
  question: { id: string; questionCode: string | null; status: string; version: number; qcStatus: string | null; qcReviewedAt: string | null };
  content: {
    subject: string;
    chapter?: string | null;
    topic?: string | null;
    type: string;
    language: string;
    statement: string;
    options: { key: string; text: string }[];
    storedAnswer: string[];
    solution?: string | null;
    hasImage: boolean;
  } | null;
  changedSinceReview: boolean;
  expert: Review | null;
  director: Review | null;
  corrections: Correction[];
};

const STATUS_META: Record<string, { label: string; tone: string }> = {
  UNREVIEWED: { label: "Not reviewed", tone: "border-slate-700 bg-slate-800/60 text-slate-300" },
  VERIFIED: { label: "Verified", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  FAILED: { label: "Failed", tone: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  NEEDS_HUMAN_REVIEW: { label: "Needs a person", tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  ERROR: { label: "Review error", tone: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" },
  EXPERT_DONE: { label: "Expert only", tone: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
};
const STATUS_ORDER = ["UNREVIEWED", "VERIFIED", "NEEDS_HUMAN_REVIEW", "FAILED", "ERROR"];
const SEVERITY_TONE: Record<string, string> = {
  CRITICAL: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  HIGH: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  MEDIUM: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  LOW: "bg-slate-700/60 text-slate-300 border-slate-600",
};

const FIELD_LABEL: Record<string, string> = { correctAnswer: "Answer key", solution: "Solution", statement: "Question text", options: "Options", topic: "Topic", subTopic: "Sub-topic", microConcept: "Micro concept", difficulty: "Difficulty" };

const words = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: words(status), tone: "border-slate-700 bg-slate-800 text-slate-300" };
  return <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}>{meta.label}</span>;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.error || `Request failed (${res.status})`);
  return body.data as T;
}

export function QcWorkspace({ canApply }: { canApply: boolean }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"review" | "duplicates">("review");

  // Batch run: the page calls the run endpoint again and again until nothing is left or it is stopped.
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState<{ done: number; remaining: number; counts: Record<string, number>; lastError?: string } | null>(null);
  const stopRef = useRef(false);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await api<Overview>("/api/team/qc/overview"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the QC overview");
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page) });
      if (status) q.set("status", status);
      if (subject) q.set("subject", subject);
      if (chapter) q.set("chapter", chapter);
      if (search.trim()) q.set("search", search.trim());
      const data = await api<{ total: number; items: QueueItem[] }>(`/api/team/qc/queue?${q}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load questions");
    } finally {
      setLoading(false);
    }
  }, [page, status, subject, chapter, search]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const subjects = useMemo(() => Object.keys(overview?.subjects ?? {}).sort(), [overview]);
  const chapterOptions = useMemo(() => (overview?.chapters ?? []).filter((c) => c.chapter && (!subject || c.subject === subject)), [overview, subject]);

  const runBatch = async (include: "UNREVIEWED" | "ERROR") => {
    stopRef.current = false;
    setRunning(true);
    const counts: Record<string, number> = {};
    let done = 0;
    let failuresInARow = 0;
    setRunLog({ done: 0, remaining: 0, counts });
    try {
      for (;;) {
        if (stopRef.current) break;
        let data: { results: { status: string; message?: string }[]; remaining: number };
        try {
          data = await api("/api/team/qc/run", { method: "POST", body: JSON.stringify({ include, ...(subject && { subject }), ...(chapter && { chapter }) }) });
        } catch (err) {
          setRunLog({ done, remaining: 0, counts: { ...counts }, lastError: err instanceof Error ? err.message : "The request failed" });
          break;
        }
        if (data.results.length === 0) break;
        let lastError: string | undefined;
        for (const r of data.results) {
          counts[r.status] = (counts[r.status] ?? 0) + 1;
          if (r.status === "ERROR") lastError = r.message;
        }
        done += data.results.length;
        setRunLog({ done, remaining: data.remaining, counts: { ...counts }, lastError });
        // A whole batch failing twice in a row means the models are unavailable: stop instead of burning through the bank.
        failuresInARow = data.results.every((r) => r.status === "ERROR") ? failuresInARow + 1 : 0;
        if (failuresInARow >= 2) {
          toast.error("Stopped: the reviews keep failing. Check the model keys and try again later.");
          break;
        }
        // A retry of failed reviews goes round once only.
        if (data.remaining === 0 || (include === "ERROR" && data.results.every((r) => r.status === "ERROR"))) break;
      }
    } finally {
      setRunning(false);
      void loadOverview();
      void loadQueue();
    }
  };

  const reviewOne = async (id: string, force: boolean) => {
    const data = await api<{ results: { status: string; message?: string; reused: boolean }[] }>("/api/team/qc/run", { method: "POST", body: JSON.stringify({ questionIds: [id], force }) });
    const r = data.results[0];
    if (r?.status === "ERROR") toast.error(r.message || "The review failed");
    else toast.success(r?.reused ? "Already reviewed for this content" : `Review finished: ${STATUS_META[r?.status ?? ""]?.label ?? r?.status}`);
    void loadOverview();
    void loadQueue();
  };

  const counts = overview?.statusCounts ?? {};
  const pending = (counts.UNREVIEWED ?? 0) + (counts.EXPERT_DONE ?? 0);
  const scopeLabel = chapter ? chapter : subject ? subject : "the whole Question Bank";
  const tokens = (overview?.usage ?? []).reduce((n, u) => n + u.inputTokens + u.outputTokens, 0);
  const calls = (overview?.usage ?? []).reduce((n, u) => n + u.calls, 0);
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="min-h-screen space-y-6 bg-slate-950 p-4 text-slate-100 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            Question QC
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-slate-400">
            Two reviewers check every question: the QC Expert solves it and looks for errors, then the QC Director solves it again without seeing the stored key or the Expert, and audits the Expert&apos;s findings. A question is
            marked Verified only when both reach the stored answer independently. Nothing is changed in a question until a person approves a correction. This is an AI check — it lowers the number of wrong questions, it does not
            guarantee there are none.
          </p>
        </div>
        <button
          onClick={() => {
            void loadOverview();
            void loadQueue();
          }}
          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {(["review", "duplicates"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${tab === t ? "bg-sky-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}>
            {t === "review" ? "Answer and solution review" : "Duplicate questions"}
          </button>
        ))}
      </div>

      {tab === "duplicates" && <QcDuplicates subjects={subjects} />}

      {tab === "review" && (
      <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {STATUS_ORDER.map((key) => (
          <button
            key={key}
            onClick={() => {
              setStatus(status === key ? "" : key);
              setPage(1);
            }}
            className={`rounded-2xl border p-4 text-left transition ${status === key ? "ring-2 ring-sky-500" : ""} ${STATUS_META[key]!.tone}`}
          >
            <div className="text-xs font-medium opacity-90">{STATUS_META[key]!.label}</div>
            <div className="mt-1 text-2xl font-black tabular-nums">{(key === "UNREVIEWED" ? pending : counts[key] ?? 0).toLocaleString("en-IN")}</div>
            <div className="mt-0.5 text-[11px] opacity-70">{overview ? `of ${overview.total.toLocaleString("en-IN")} questions` : "…"}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2">
          <div className="text-sm font-bold text-white">Run a review</div>
          <div className="flex flex-wrap gap-2">
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setChapter("");
                setPage(1);
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={chapter}
              onChange={(e) => {
                setChapter(e.target.value);
                setPage(1);
              }}
              className="max-w-[16rem] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            >
              <option value="">All chapters</option>
              {chapterOptions.map((c) => (
                <option key={`${c.subject}|${c.chapter}`} value={c.chapter ?? ""}>
                  {c.chapter} ({c.count})
                </option>
              ))}
            </select>
            {running ? (
              <button onClick={() => (stopRef.current = true)} className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300">
                <Square className="h-3.5 w-3.5" />
                Stop after this batch
              </button>
            ) : (
              <>
                <button onClick={() => void runBatch("UNREVIEWED")} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
                  <Play className="h-3.5 w-3.5" />
                  Review not-yet-reviewed questions
                </button>
                {(counts.ERROR ?? 0) > 0 && (
                  <button onClick={() => void runBatch("ERROR")} className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800">
                    Retry failed reviews
                  </button>
                )}
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Scope: {scopeLabel}. Three questions are reviewed at a time and each takes about a minute or two, so a large run takes hours — keep this page open; you can stop any time and continue later (finished questions are not
            repeated).
          </p>
          <p className="text-[11px] text-amber-300/90">
            Each question needs at least three model calls, from the same Gemini keys the rest of the app uses (AI Guru, question tools). Free keys allow only a few calls a day per model, so a big run can use up the day&apos;s
            allowance. Run large batches when students are not using AI Guru, or add a paid key first.
          </p>
          {runLog && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" /> : <Check className="h-3.5 w-3.5 text-emerald-400" />}
                <span>
                  {running ? "Reviewing…" : "Stopped."} {runLog.done} done in this run{running ? `, ${runLog.remaining} left` : ""}.
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(runLog.counts).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1">
                    <StatusBadge status={k} /> {v}
                  </span>
                ))}
              </div>
              {runLog.lastError && <div className="mt-2 break-words text-rose-300">Last error: {runLog.lastError}</div>}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
          <div className="text-sm font-bold text-white">So far</div>
          <div className="flex justify-between">
            <span>Corrections waiting for a decision</span>
            <span className="font-bold tabular-nums text-amber-300">{overview?.corrections.PROPOSED ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Corrections applied</span>
            <span className="font-bold tabular-nums">{overview?.corrections.APPLIED ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Corrections rejected</span>
            <span className="font-bold tabular-nums">{overview?.corrections.REJECTED ?? 0}</span>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-2">
            <span>Model calls made</span>
            <span className="font-bold tabular-nums">
              {calls.toLocaleString("en-IN")}
              {overview?.failedCalls ? ` (${overview.failedCalls} failed)` : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tokens used</span>
            <span className="font-bold tabular-nums">{tokens.toLocaleString("en-IN")}</span>
          </div>
          {(overview?.findingCategories.length ?? 0) > 0 && (
            <div className="border-t border-slate-800 pt-2">
              <div className="mb-1 text-slate-400">Most common findings</div>
              {overview!.findingCategories.slice(0, 5).map((f) => (
                <div key={f.category} className="flex justify-between">
                  <span>{words(f.category)}</span>
                  <span className="tabular-nums">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-3">
          <div className="text-sm font-bold text-white">
            Questions <span className="font-normal text-slate-400">({total.toLocaleString("en-IN")})</span>
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="">Any QC status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s]!.label}
              </option>
            ))}
          </select>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Question code"
              className="w-44 rounded-xl border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-600"
            />
          </div>
        </div>
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No questions match these filters.</div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {items.map((q) => (
              <li key={q.id}>
                <button onClick={() => setOpenId(q.id)} className="flex w-full flex-col gap-1.5 p-3 text-left transition hover:bg-slate-800/50 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono text-slate-300">{q.questionCode || q.id.slice(-8)}</span>
                      <span>{q.subject}</span>
                      {q.chapter && <span className="truncate">· {q.chapter}</span>}
                      <span>· {words(q.type)}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-200">{q.preview || "(no text)"}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {q.openCorrections > 0 && <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">{q.openCorrections} to decide</span>}
                    {q.findings > 0 && <span className="text-[11px] text-slate-400">{q.findings} findings</span>}
                    <StatusBadge status={q.qcStatus} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 p-3 text-xs text-slate-400">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-700 p-1.5 disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            Page {page} of {pages}
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-700 p-1.5 disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      </>
      )}

      {openId && (
        <QcDetailPanel
          questionId={openId}
          canApply={canApply}
          onClose={() => setOpenId(null)}
          onReview={reviewOne}
          onChanged={() => {
            void loadOverview();
            void loadQueue();
          }}
        />
      )}
    </div>
  );
}

function AgentCard({ title, review, note }: { title: string; review: Review | null; note: string }) {
  if (!review) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
        <div className="text-sm font-bold text-white">{title}</div>
        <div className="mt-1">Has not run on this question yet.</div>
      </div>
    );
  }
  const calc: any[] = Array.isArray(review.calcChecks) ? review.calcChecks : [];
  const reasoning: string | undefined = review.agent === "EXPERT" ? review.result?.derivedAnswer?.reasoning : review.result?.solve?.derivedAnswer?.reasoning;
  return (
    <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-white">{title}</div>
        <span className="text-[11px] text-slate-500">
          {review.model} · {review.promptVersion}
        </span>
      </div>
      <div className="text-[11px] text-slate-500">{note}</div>
      {review.status === "ERROR" ? (
        <div className="break-words rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 p-2 text-fuchsia-200">The review did not finish: {review.errorMessage}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Its own answer: <b className="text-white">{review.derivedAnswer || "could not solve"}</b>
            </span>
            <span className="text-slate-500">stored key: {review.storedAnswer || "none"}</span>
            {review.answerMatches === true && (
              <span className="flex items-center gap-1 text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> matches
              </span>
            )}
            {review.answerMatches === false && (
              <span className="flex items-center gap-1 text-rose-300">
                <XCircle className="h-3.5 w-3.5" /> differs
              </span>
            )}
            {review.answerMatches === null && (
              <span className="flex items-center gap-1 text-amber-300">
                <HelpCircle className="h-3.5 w-3.5" /> not comparable
              </span>
            )}
          </div>
          {reasoning && (
            <details>
              <summary className="cursor-pointer text-sky-300">How it solved the question</summary>
              <div className="mt-1 rounded-xl bg-slate-950 p-2 text-slate-300">
                <FormulaText text={reasoning} />
              </div>
            </details>
          )}
          {calc.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sky-300">
                Arithmetic recomputed by the system ({calc.filter((c) => c.agrees === false).length} disagree of {calc.length})
              </summary>
              <ul className="mt-1 space-y-1 rounded-xl bg-slate-950 p-2 font-mono text-[11px]">
                {calc.map((c, i) => (
                  <li key={i} className={c.agrees === false ? "text-rose-300" : c.evaluated ? "text-slate-300" : "text-slate-500"}>
                    {c.expression} = {c.evaluated ? c.computedValue : "could not be evaluated"}
                    {c.claimedValue != null && ` (model said ${c.claimedValue})`}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {review.modelConfidence != null && <div className="text-[11px] text-slate-500">Model&apos;s own confidence {Math.round(review.modelConfidence * 100)}% — shown for information only; it is not used to decide the status.</div>}
        </>
      )}
    </div>
  );
}

function QcDetailPanel({ questionId, canApply, onClose, onReview, onChanged }: { questionId: string; canApply: boolean; onClose: () => void; onReview: (id: string, force: boolean) => Promise<void>; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await api<Detail>(`/api/team/qc/questions/${questionId}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the question");
    }
  }, [questionId]);
  useEffect(() => {
    void load();
  }, [load]);

  const review = async (force: boolean) => {
    setBusy("review");
    try {
      await onReview(questionId, force);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The review failed");
    } finally {
      setBusy(null);
    }
  };

  const decide = async (c: Correction, action: "approve" | "reject") => {
    setBusy(c.id);
    try {
      const data = await api<{ correction: Correction }>(`/api/team/qc/corrections/${c.id}`, { method: "POST", body: JSON.stringify({ action }) });
      const s = data.correction.status;
      toast.success(s === "APPLIED" ? "Applied. The previous version of the question is kept, and the question needs a fresh review." : s === "APPROVED" ? "Approved — make this change in the question editor." : "Rejected. The question is unchanged.");
      await load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the decision");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const content = detail?.content;
  const findings = [...(detail?.expert?.findings ?? []), ...(detail?.director?.findings ?? [])];
  const reasons: string[] = detail?.director?.result?.decision?.reasons ?? detail?.expert?.result?.statusReasons ?? [];
  const references: any[] = Array.isArray(detail?.expert?.references) ? detail!.expert!.references : [];
  const supporting = detail?.expert?.result?.supportingReference;
  const ncertStatus: string | undefined = detail?.expert?.result?.ncert?.status;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="h-full w-full max-w-3xl space-y-4 overflow-y-auto border-l border-slate-800 bg-slate-950 p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-slate-400">{detail?.question.questionCode || questionId}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={detail?.question.qcStatus ?? "UNREVIEWED"} />
              {content && (
                <span className="text-[11px] text-slate-400">
                  {content.subject}
                  {content.chapter ? ` · ${content.chapter}` : ""} · {words(content.type)} · version {detail?.question.version}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={busy !== null} onClick={() => void review(Boolean(detail?.expert))} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              {busy === "review" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {busy === "review" ? "Reviewing (1–2 min)…" : detail?.expert ? "Review again" : "Review now"}
            </button>
            <button onClick={onClose} className="rounded-xl border border-slate-800 p-2 text-slate-300 hover:bg-slate-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}
        {!detail && !error && (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {detail?.changedSinceReview && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This question was edited after its last review. What is shown below is about the older text — review it again.
          </div>
        )}

        {content && (
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
            {content.hasImage && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">This question has a picture. The reviewers cannot see pictures, so it is never marked Verified automatically.</div>}
            <FormulaText text={content.statement} />
            {content.options.length > 0 && (
              <ul className="space-y-1.5">
                {content.options.map((o) => {
                  const isKey = content.storedAnswer.includes(o.key);
                  return (
                    <li key={o.key} className={`flex gap-2 rounded-xl border p-2 text-xs ${isKey ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800"}`}>
                      <span className="font-bold">{o.key}.</span>
                      <FormulaText text={o.text} />
                      {isKey && <span className="ml-auto shrink-0 text-[11px] text-emerald-300">stored key</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {content.options.length === 0 && <div className="text-xs text-slate-400">Stored answer: {content.storedAnswer.join(", ") || "none"}</div>}
            {content.solution && (
              <details className="text-xs">
                <summary className="cursor-pointer text-sky-300">Stored solution</summary>
                <div className="mt-1 rounded-xl bg-slate-950 p-2">
                  <FormulaText text={content.solution} />
                </div>
              </details>
            )}
          </div>
        )}

        {reasons.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
            <div className="text-sm font-bold text-white">Why it has this status</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {detail && (
          <div className="grid gap-3 md:grid-cols-2">
            <AgentCard title="QC Expert" review={detail.expert} note="Solves the question, checks the key, solution, formula, units and classification." />
            <AgentCard title="QC Director" review={detail.director} note="Solves it again without the stored key, the solution or the Expert's work, then audits the Expert." />
          </div>
        )}

        {findings.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-bold text-white">Findings ({findings.length})</div>
            {findings.map((f) => (
              <div key={f.id} className="space-y-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_TONE[f.severity] ?? SEVERITY_TONE.LOW}`}>{words(f.severity)}</span>
                  <span className="font-semibold text-white">{words(f.category)}</span>
                  <span className="text-[11px] text-slate-500">found by {f.source === "SYSTEM" ? "a rule check" : f.source === "EXPERT" ? "the Expert" : "the Director"}</span>
                </div>
                <FormulaText text={f.description} />
                {f.evidence && (
                  <div className="text-slate-400">
                    Evidence: <FormulaText text={f.evidence} className="inline" />
                  </div>
                )}
                {f.directorDecision && (
                  <div className="rounded-xl bg-slate-950 p-2">
                    <span className="font-semibold text-sky-300">Director: {words(f.directorDecision)}</span>
                    {f.directorReason && <span> — {f.directorReason}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {detail && detail.corrections.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-bold text-white">Proposed corrections</div>
            {detail.corrections.map((c) => (
              <div key={c.id} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{FIELD_LABEL[c.field] ?? words(c.field)}</span>
                  {c.language && <span className="text-[11px] text-slate-500">{words(c.language)}</span>}
                  <span className="ml-auto rounded-lg border border-slate-700 px-2 py-0.5 text-[11px]">{words(c.status)}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-950 p-2">
                    <div className="mb-1 text-[11px] text-slate-500">{c.status === "PROPOSED" ? "Now" : "Before"}</div>
                    <FormulaText text={c.originalValue || "(empty)"} />
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2">
                    <div className="mb-1 text-[11px] text-emerald-300">Proposed</div>
                    <FormulaText text={c.proposedValue} />
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Reason:</span> {c.reason}
                </div>
                {c.decisionNote && <div className="text-slate-400">Note: {c.decisionNote}</div>}
                {c.status === "PROPOSED" &&
                  (canApply ? (
                    <div className="flex flex-wrap gap-2">
                      <button disabled={busy !== null} onClick={() => void decide(c, "approve")} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                        {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {["statement", "options"].includes(c.field) ? "Approve (edit by hand)" : "Approve and apply"}
                      </button>
                      <button disabled={busy !== null} onClick={() => void decide(c, "reject")} className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">Only someone with approval rights can accept or reject this.</div>
                  ))}
              </div>
            ))}
          </div>
        )}

        {references.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
            <div className="text-sm font-bold text-white">NCERT pages offered to the Expert</div>
            <div className="text-[11px] text-slate-500">
              Found by a text search in the NCERT library — they may or may not be about this question. Expert&apos;s reading: {ncertStatus ? words(ncertStatus) : "not stated"}
              {supporting ? ` (passage ${supporting.index})` : ""}.
            </div>
            {references.map((r) => (
              <div key={r.pageId ?? r.index} className="rounded-xl bg-slate-950 p-2">
                <div className="font-semibold text-slate-200">
                  [{r.index}] {[r.className, r.subject, r.chapter].filter(Boolean).join(" · ")} — page {r.pageNumber}
                </div>
                <div className="mt-0.5 line-clamp-3 text-slate-400">{r.excerpt}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
