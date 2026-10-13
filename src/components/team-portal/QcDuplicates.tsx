"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Loader2, ScanSearch } from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";

type Side = {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  type: string;
  status: string;
  qcStatus: string;
  createdAt: string;
  usedInTests: number;
  usedInDpps: number;
  statement: string;
  options: { key: string; text: string }[];
  answer: string[];
  solution: string | null;
};

type Pair = {
  id: string;
  category: string;
  score: number;
  method: string;
  language: string;
  sameAnswer: boolean | null;
  note: string;
  status: string;
  decisionNote: string | null;
  a: Side;
  b: Side;
};

type Listing = {
  total: number;
  page: number;
  pageSize: number;
  pendingByCategory: Record<string, number>;
  byStatus: Record<string, number>;
  pendingWithDifferentAnswers: number;
  items: Pair[];
};

const CATEGORY: Record<string, { label: string; hint: string; tone: string }> = {
  EXACT_DUPLICATE: { label: "Exactly the same", hint: "Text and options identical", tone: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  FORMAT_DUPLICATE: { label: "Same, formatted differently", hint: "Only formatting or option order differs", tone: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
  STRUCTURAL_VARIANT: { label: "Same wording, other numbers", hint: "Often a valid separate question", tone: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  NEEDS_MANUAL_REVIEW: { label: "Very similar wording", hint: "A person has to look", tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
};
const CATEGORY_ORDER = ["EXACT_DUPLICATE", "FORMAT_DUPLICATE", "STRUCTURAL_VARIANT", "NEEDS_MANUAL_REVIEW"];
const STATUS_LABEL: Record<string, string> = { PENDING: "Waiting for a decision", CONFIRMED_DUPLICATE: "Marked as duplicates", NOT_DUPLICATE: "Marked as not duplicates", KEEP_BOTH: "Keeping both", ALL: "All" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.error || `Request failed (${res.status})`);
  return body.data as T;
}

function QuestionSide({ q, label }: { q: Side; label: string }) {
  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-bold text-slate-200">{label}</span>
        <span className="font-mono text-slate-300">{q.questionCode || q.id.slice(-8)}</span>
        <span>{q.status.toLowerCase().replace(/_/g, " ")}</span>
        <span>· added {new Date(q.createdAt).toLocaleDateString("en-IN")}</span>
      </div>
      <div className="text-[11px] text-slate-500">
        {[q.chapter, q.topic].filter(Boolean).join(" · ") || "No chapter"} · used in {q.usedInTests} test{q.usedInTests === 1 ? "" : "s"} and {q.usedInDpps} DPP{q.usedInDpps === 1 ? "" : "s"}
      </div>
      <div className="overflow-x-auto">
        <FormulaText text={q.statement} />
      </div>
      {q.options.length > 0 ? (
        <ul className="space-y-1">
          {q.options.map((o) => {
            const keyed = q.answer.includes(o.key);
            return (
              <li key={o.key} className={`flex gap-2 rounded-lg border px-2 py-1 ${keyed ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800"}`}>
                <span className="font-bold">{o.key}.</span>
                <FormulaText text={o.text} />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-slate-400">Answer: {q.answer.join(", ") || "none"}</div>
      )}
      {q.solution && (
        <details>
          <summary className="cursor-pointer text-sky-300">Solution</summary>
          <div className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-2">
            <FormulaText text={q.solution} />
          </div>
        </details>
      )}
    </div>
  );
}

export function QcDuplicates({ subjects }: { subjects: string[] }) {
  const [data, setData] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("PENDING");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [onlyDifferent, setOnlyDifferent] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ status, page: String(page) });
      if (category) q.set("category", category);
      if (subject) q.set("subject", subject);
      if (onlyDifferent) q.set("answers", "different");
      setData(await api<Listing>(`/api/team/qc/duplicates?${q}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the duplicate list");
    } finally {
      setLoading(false);
    }
  }, [status, category, subject, onlyDifferent, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      const r = await api<{ questions: number; found: number; added: number; removed: number }>("/api/team/qc/duplicates", { method: "POST", body: JSON.stringify(subject ? { subject } : {}) });
      toast.success(`Compared ${r.questions} questions: ${r.found} similar pairs (${r.added} new, ${r.removed} no longer apply).`);
      setPage(1);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The scan failed");
    } finally {
      setScanning(false);
    }
  };

  const decide = async (pair: Pair, next: string) => {
    setBusy(pair.id);
    try {
      await api(`/api/team/qc/duplicates/${pair.id}`, { method: "POST", body: JSON.stringify({ status: next }) });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the decision");
    } finally {
      setBusy(null);
    }
  };

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 15)));
  const pending = data?.byStatus.PENDING ?? 0;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto text-sm font-bold text-white">Questions that look the same</div>
          <select
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
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
          <button disabled={scanning} onClick={() => void scan()} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
            {scanning ? "Comparing…" : "Scan the Question Bank"}
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          The scan compares the text of the questions (no AI call, so it is free and takes a few seconds). It finds copies, copies with other formatting or option order, the same wording with other numbers, and very close wording
          — within one subject and one language. It does not find the same problem written in different words, a Hindi question against an English one, or equal pictures. Your decision here is only recorded: no question is
          merged, hidden or deleted.
        </p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCategory(category === c ? "" : c);
                setStatus("PENDING");
                setPage(1);
              }}
              className={`rounded-xl border p-3 text-left ${CATEGORY[c]!.tone} ${category === c ? "ring-2 ring-sky-500" : ""}`}
            >
              <div className="text-xs font-semibold">{CATEGORY[c]!.label}</div>
              <div className="mt-0.5 text-xl font-black tabular-nums">{data?.pendingByCategory[c] ?? 0}</div>
              <div className="text-[11px] opacity-70">{CATEGORY[c]!.hint}</div>
            </button>
          ))}
        </div>
        {(data?.pendingWithDifferentAnswers ?? 0) > 0 && (
          <button
            onClick={() => {
              setOnlyDifferent(!onlyDifferent);
              setStatus("PENDING");
              setPage(1);
            }}
            className={`flex w-full items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-left text-xs text-rose-200 ${onlyDifferent ? "ring-2 ring-sky-500" : ""}`}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>{data!.pendingWithDifferentAnswers} pairs have different answer keys.</b> When two copies of one question disagree, one key is probably wrong — look at these first. {onlyDifferent ? "(showing only these — click to show all)" : "(click to show only these)"}
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {Object.keys(STATUS_LABEL).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium ${status === s ? "bg-slate-200 text-slate-900" : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
          >
            {STATUS_LABEL[s]}
            {s !== "ALL" && ` (${data?.byStatus[s] ?? 0})`}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-sm text-slate-400">
          {pending === 0 && status === "PENDING" && !category && !onlyDifferent ? "Nothing is waiting. Run a scan to compare the questions." : "No pairs match these filters."}
        </div>
      ) : (
        data!.items.map((pair) => (
          <div key={pair.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${CATEGORY[pair.category]?.tone ?? ""}`}>
                <Copy className="h-3 w-3" />
                {CATEGORY[pair.category]?.label ?? pair.category}
              </span>
              <span className="text-slate-300">{pair.note}</span>
              {pair.sameAnswer === false && <span className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">Answer keys differ</span>}
              {pair.sameAnswer === true && <span className="text-[11px] text-emerald-300">same answer</span>}
              {pair.sameAnswer === null && <span className="text-[11px] text-slate-500">one has no answer key</span>}
              <span className="ml-auto text-[11px] text-slate-500">
                {pair.a.subject} · {pair.language.toLowerCase()}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <QuestionSide q={pair.a} label="A" />
              <QuestionSide q={pair.b} label="B" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {pair.status === "PENDING" ? (
                <>
                  <button disabled={busy !== null} onClick={() => void decide(pair, "CONFIRMED_DUPLICATE")} className="rounded-xl bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-500 disabled:opacity-50">
                    Yes, duplicates
                  </button>
                  <button disabled={busy !== null} onClick={() => void decide(pair, "KEEP_BOTH")} className="rounded-xl border border-slate-700 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                    Similar, keep both
                  </button>
                  <button disabled={busy !== null} onClick={() => void decide(pair, "NOT_DUPLICATE")} className="rounded-xl border border-slate-700 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                    Not duplicates
                  </button>
                  {busy === pair.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                </>
              ) : (
                <>
                  <span className="text-slate-300">{STATUS_LABEL[pair.status] ?? pair.status}</span>
                  <button disabled={busy !== null} onClick={() => void decide(pair, "PENDING")} className="rounded-xl border border-slate-700 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                    Undo
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-400">
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
  );
}
