"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface AnalyticsData {
  totalQuestions: number;
  publishedQuestions: number;
  pendingQcQuestions: number;
  duplicateCandidatesCount: number;
  failedImportsCount: number;
  neetQuestions: number;
  jeeMainQuestions: number;
  jeeAdvancedQuestions: number;
  exams: { id: string; name: string; slug: string; count: number }[];
  subjects: { name: string; count: number }[];
  years: { year: number; count: number }[];
  aiTelemetry: {
    geminiCalls: number;
    openaiCalls: number;
    totalTokens: number;
    estimatedCostInr: number;
  };
}

export function PyqAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/team/pyq/analytics")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
        else toast.error(j.error || "Failed to load analytics");
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total PYQs</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            {data.totalQuestions}
          </p>
          <span className="text-[10px] text-emerald-600 font-bold">Verified in DB</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">NEET UG</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">
            {data.neetQuestions}
          </p>
          <span className="text-[10px] text-slate-400">Questions</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">JEE Main</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {data.jeeMainQuestions}
          </p>
          <span className="text-[10px] text-slate-400">Questions</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">JEE Advanced</p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 font-mono">
            {data.jeeAdvancedQuestions}
          </p>
          <span className="text-[10px] text-slate-400">Questions</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending QC</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">
            {data.pendingQcQuestions}
          </p>
          <span className="text-[10px] text-rose-500 font-bold">Awaiting approval</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Duplicates</p>
          <p className="text-2xl font-black text-amber-500 mt-1 font-mono">
            {data.duplicateCandidatesCount}
          </p>
          <span className="text-[10px] text-amber-600 font-bold">Unresolved pairs</span>
        </div>
      </div>

      {/* AI Telemetry & Cost Control Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-xl">payments</span>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                AI Telemetry & Cost Expenditure
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Multi-model routing: Gemini 2.0 Flash primary with conditional OpenAI review. Zero-cost deterministic PDF text parser enabled.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Gemini Calls</p>
              <p className="text-lg font-black font-mono">{data.aiTelemetry.geminiCalls}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">OpenAI Calls</p>
              <p className="text-lg font-black font-mono">{data.aiTelemetry.openaiCalls}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Tokens</p>
              <p className="text-lg font-black font-mono">
                {(data.aiTelemetry.totalTokens / 1000).toFixed(1)}k
              </p>
            </div>
            <div className="pl-4 border-l border-white/20">
              <p className="text-[10px] uppercase font-bold text-amber-400">Estimated Cost</p>
              <p className="text-xl font-black text-amber-300 font-mono">
                ₹{data.aiTelemetry.estimatedCostInr}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Subjects & Years Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subject-Wise */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
            Subject-Wise Question Breakdown
          </h4>
          <div className="space-y-2">
            {data.subjects.length === 0 ? (
              <p className="text-xs text-slate-400">No subject data recorded</p>
            ) : (
              data.subjects.map((sub) => {
                const pct = data.totalQuestions > 0 ? (sub.count / data.totalQuestions) * 100 : 0;
                return (
                  <div key={sub.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">{sub.name}</span>
                      <span className="font-mono text-slate-500 font-bold">
                        {sub.count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Year-Wise */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
            Year-Wise Question Breakdown
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.years.length === 0 ? (
              <p className="text-xs text-slate-400 col-span-2">No year data recorded</p>
            ) : (
              data.years.map((y) => (
                <div
                  key={y.year}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs"
                >
                  <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {y.year}
                  </span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-black">
                    {y.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
