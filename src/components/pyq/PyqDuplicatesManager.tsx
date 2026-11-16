"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormulaText } from "@/components/test-portal/FormulaText";

interface DuplicatePair {
  id: string;
  category: string;
  score: number;
  status: string;
  note: string;
  questionA: {
    id: string;
    questionCode: string | null;
    subject: string;
    chapter: string | null;
    topic: string | null;
    translations: { statement: string; options: any; correctOptionIds: any }[];
    pyqOccurrences: { year: number | null; session: string | null; shift: string | null; paper: string | null; questionNumber: string | null; exam: { name: string } }[];
  };
  questionB: {
    id: string;
    questionCode: string | null;
    subject: string;
    chapter: string | null;
    topic: string | null;
    translations: { statement: string; options: any; correctOptionIds: any }[];
    pyqOccurrences: { year: number | null; session: string | null; shift: string | null; paper: string | null; questionNumber: string | null; exam: { name: string } }[];
  };
}

export function PyqDuplicatesManager() {
  const [items, setItems] = useState<DuplicatePair[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  function loadCandidates() {
    setLoading(true);
    fetch("/api/team/pyq/duplicates?status=PENDING")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setItems(j.data.items);
          setTotal(j.data.total);
        } else {
          toast.error(j.error || "Failed to load duplicates");
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCandidates();
  }, []);

  async function handleResolve(id: string, decision: "MERGE_OCCURRENCE" | "KEEP_BOTH" | "NOT_DUPLICATE") {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/team/pyq/duplicates/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve duplicate");
      toast.success(data.data?.message || "Decision recorded!");
      setItems((prev) => prev.filter((p) => p.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve");
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">check_circle</span>
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Zero Unresolved Duplicates</h4>
        <p className="text-xs text-slate-400 mt-1">
          All imported questions have unique content fingerprints or have already been linked to existing canonical questions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900 dark:text-white">
          Duplicate Candidates Review ({total})
        </h3>
        <p className="text-xs text-slate-500">
          Compare candidate questions side by side before merging or keeping separate
        </p>
      </div>

      <div className="space-y-4">
        {items.map((pair) => {
          const transA = pair.questionA?.translations?.[0];
          const transB = pair.questionB?.translations?.[0];
          const occA = pair.questionA?.pyqOccurrences?.[0];
          const occB = pair.questionB?.pyqOccurrences?.[0];
          const isBusy = resolvingId === pair.id;

          return (
            <div
              key={pair.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-black">
                    {pair.score}% Match
                  </span>
                  <span className="text-slate-500 font-medium">Category: {pair.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleResolve(pair.id, "MERGE_OCCURRENCE")}
                    className="pyq-btn-primary"
                  >
                    Merge into Question A
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleResolve(pair.id, "KEEP_BOTH")}
                    className="pyq-btn"
                  >
                    Keep Both
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleResolve(pair.id, "NOT_DUPLICATE")}
                    className="pyq-btn text-slate-500"
                  >
                    Not Duplicate
                  </button>
                </div>
              </div>

              {/* Side by Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Question A */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-blue-600">Question A (Canonical Target)</span>
                    <span className="font-mono">{pair.questionA?.questionCode || pair.questionA?.id.slice(-6)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {occA ? `${occA.exam?.name} ${occA.year || ""} Q.${occA.questionNumber || ""}` : "No occurrence mapped"} · {pair.questionA?.subject} · {pair.questionA?.chapter}
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                    <FormulaText text={transA?.statement || "(No text)"} />
                  </div>
                </div>

                {/* Question B */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-amber-600">Question B (Duplicate Candidate)</span>
                    <span className="font-mono">{pair.questionB?.questionCode || pair.questionB?.id.slice(-6)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {occB ? `${occB.exam?.name} ${occB.year || ""} Q.${occB.questionNumber || ""}` : "No occurrence mapped"} · {pair.questionB?.subject} · {pair.questionB?.chapter}
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                    <FormulaText text={transB?.statement || "(No text)"} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
