"use client";

import React, { useState, useEffect } from "react";
import { History, Eye, FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface BatchSummary {
  id: string;
  batchCode: string;
  method: string;
  subject: string;
  chapter: string;
  topics: any;
  totalRequested: number;
  generatedCount: number;
  passedCount: number;
  needsReviewCount: number;
  failedCount: number;
  savedDraftCount: number;
  status: string;
  createdAt: string;
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  sourcePdf?: { id: string; fileName: string; resourceId: string } | null;
}

interface Props {
  onSelectBatch: (batchId: string) => void;
}

export function GenerationHistoryView({ onSelectBatch }: Props) {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (methodFilter !== "ALL") params.set("method", methodFilter);
      params.set("page", String(page));

      const res = await fetch(`/api/team/ai-questions/batches?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setBatches(json.data.batches);
        setTotalPages(json.data.totalPages || 1);
      }
    } catch {
      toast.error("Failed to load generation history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [methodFilter, page]);

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-black text-slate-800">AI Generation Batches History</h3>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none"
          >
            <option value="ALL">All Methods</option>
            <option value="AI">🤖 BY AI</option>
            <option value="PDF">📄 BY PDF</option>
          </select>

          <button
            type="button"
            onClick={fetchBatches}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading generation history...</div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No previous generation batches found. Create your first batch in the Generator tab!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Batch Code &amp; Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Subject &amp; Chapter</th>
                  <th className="px-4 py-3">Progress / Status</th>
                  <th className="px-4 py-3 text-center">Quality Breakdown</th>
                  <th className="px-4 py-3 text-center">Drafted</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {batches.map((b) => {
                  const topicsArr = Array.isArray(b.topics) ? (b.topics as string[]) : [];
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition">
                      {/* Code & Date */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-blue-700 block">{b.batchCode}</span>
                        <span className="text-[11px] text-slate-400">
                          {format(new Date(b.createdAt), "MMM d, yyyy · HH:mm")}
                        </span>
                        {b.createdBy?.name && (
                          <span className="text-[10px] text-slate-500 block">by {b.createdBy.name}</span>
                        )}
                      </td>

                      {/* Method */}
                      <td className="px-4 py-3.5">
                        {b.method === "PDF" ? (
                          <div>
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              <span>BY PDF</span>
                            </span>
                            {b.sourcePdf?.fileName && (
                              <span className="text-[10px] text-slate-500 block mt-1 line-clamp-1 max-w-[140px]">
                                {b.sourcePdf.fileName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            🤖 BY AI
                          </span>
                        )}
                      </td>

                      {/* Subject & Chapter */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <span className="font-bold text-slate-900 block">{b.subject}</span>
                        <span className="text-slate-600 block truncate">{b.chapter}</span>
                        {topicsArr.length > 0 && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            {topicsArr.join(", ")}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            b.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : b.status === "PROCESSING"
                              ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {b.status}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-1">
                          {b.generatedCount} of {b.totalRequested} generated
                        </span>
                      </td>

                      {/* Quality Breakdown */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded" title="Passed independent validation">
                            ✓ {b.passedCount}
                          </span>
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded" title="Needs review / ambiguous">
                            ⚠ {b.needsReviewCount}
                          </span>
                          {b.failedCount > 0 && (
                            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded" title="Validation failed">
                              ✕ {b.failedCount}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Drafted count */}
                      <td className="px-4 py-3.5 text-center font-bold text-slate-800">
                        {b.savedDraftCount} saved
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectBatch(b.id)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition inline-flex items-center gap-1 shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end gap-2 text-xs">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-slate-500 font-bold">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
