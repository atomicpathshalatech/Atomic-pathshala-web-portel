"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  Layers,
  HelpCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Award,
  TrendingUp,
  Brain,
} from "lucide-react";
import type { ChapterAuditSummary } from "@/lib/questions/chapter-audit-engine";

interface ChapterQuestionIntelligenceDashboardProps {
  subjectName: string;
  chapterName: string;
}

export function ChapterQuestionIntelligenceDashboard({
  subjectName,
  chapterName,
}: ChapterQuestionIntelligenceDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<ChapterAuditSummary | null>(null);

  const fetchAuditMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team/questions/audit-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectName,
          chapter: chapterName,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAuditData(json.data);
      } else {
        toast.error(json.error || "Failed to load chapter intelligence data");
      }
    } catch {
      toast.error("Network error loading chapter analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subjectName && chapterName) {
      fetchAuditMetrics();
    }
  }, [subjectName, chapterName]);

  if (loading && !auditData) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Analyzing chapter question repository &amp; intelligence...</p>
      </div>
    );
  }

  if (!auditData) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
        <p className="text-xs text-slate-500">No questions found for this chapter yet.</p>
        <button
          type="button"
          onClick={fetchAuditMetrics}
          className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
        >
          Run Chapter Audit
        </button>
      </div>
    );
  }

  const {
    totalQuestions,
    averageQualityScore,
    averageNeetRelevance,
    criticalErrorCount,
    distributions,
    coverage,
    criticalIssuesList,
  } = auditData;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] font-mono font-bold uppercase">
              {subjectName}
            </span>
            <span className="text-xs font-semibold text-slate-300">Chapter Intelligence Dashboard</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">{chapterName}</h2>
          <p className="text-xs text-slate-300">
            Automated 100-pt Quality Score · NCERT Grounding · NEET Relevance &amp; Multi-Concept Coverage
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={fetchAuditMetrics}
          className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Auditing..." : "Re-Audit Chapter"}</span>
        </button>
      </div>

      {/* Top 4 Key Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Questions</span>
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
            {totalQuestions}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">In Canonical Bank</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Quality Score</span>
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {averageQualityScore}
            <span className="text-sm font-normal text-slate-400">/100</span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">100-pt Multi-Factor</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">NEET Relevance</span>
            <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {averageNeetRelevance}%
          </div>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Grade A Target</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Critical Issues</span>
            <AlertTriangle className={`w-4 h-4 ${criticalErrorCount > 0 ? "text-rose-600" : "text-slate-400"}`} />
          </div>
          <div className={`text-2xl sm:text-3xl font-black font-mono ${criticalErrorCount > 0 ? "text-rose-600" : "text-slate-900 dark:text-white"}`}>
            {criticalErrorCount}
          </div>
          <span className={`text-[10px] font-bold ${criticalErrorCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {criticalErrorCount === 0 ? "Zero Blockers" : "Needs Faculty Fix"}
          </span>
        </div>
      </div>

      {/* 4 Distributions Grid (Difficulty, Cognitive L1-L6, Nature, Type) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Difficulty Distribution */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
              Difficulty Spread
            </h4>
          </div>
          <div className="space-y-1.5 text-xs">
            {Object.entries(distributions.difficulty).map(([k, count]) => {
              const pct = totalQuestions > 0 ? Math.round((count / totalQuestions) * 100) : 0;
              return (
                <div key={k} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{k}</span>
                    <span className="font-mono text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        k === "EASY" ? "bg-emerald-500" : k === "HARD" || k === "VERY_HARD" ? "bg-rose-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cognitive Levels (L1 to L6) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-indigo-600" />
              Cognitive Depth (L1–L6)
            </h4>
          </div>
          <div className="space-y-1.5 text-xs">
            {["L1", "L2", "L3", "L4", "L5", "L6"].map((lvl) => {
              const count = distributions.cognitive[lvl] || 0;
              const pct = totalQuestions > 0 ? Math.round((count / totalQuestions) * 100) : 0;
              return (
                <div key={lvl} className="space-y-0.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{lvl}</span>
                    <span className="font-mono text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Question Nature */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Nature Breakdown
          </h4>
          <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-1">
            {Object.entries(distributions.nature).map(([nat, count]) => {
              const pct = totalQuestions > 0 ? Math.round((count / totalQuestions) * 100) : 0;
              return (
                <div key={nat} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <span className="text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{nat}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Question Types */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Format Types
          </h4>
          <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-1">
            {Object.entries(distributions.type).map(([t, count]) => (
              <div key={t} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[120px] font-mono">{t.replace("_", " ")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Issues Box */}
      {criticalIssuesList.length > 0 && (
        <div className="p-5 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-3">
          <h4 className="text-xs font-bold text-rose-800 dark:text-rose-200 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Critical Issues Requiring Attention ({criticalIssuesList.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {criticalIssuesList.map((c, idx) => (
              <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/40 text-xs flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded text-[10px]">
                      {c.canonicalId}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 truncate">{c.statementSnippet}</span>
                  </div>
                  <ul className="list-disc list-inside text-rose-600 dark:text-rose-400 text-[11px] font-medium">
                    {c.issues.map((err, errIdx) => (
                      <li key={errIdx}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
