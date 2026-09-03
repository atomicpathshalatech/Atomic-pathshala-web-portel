"use client";

import React, { useState } from "react";
import { SimilarityReport, SimilarityMatch } from "@/lib/questions/similarity";
import { SideBySideCompareModal } from "./SideBySideCompareModal";

interface QuestionSimilaritySidebarProps {
  report: SimilarityReport | null;
  checking: boolean;
  onCheckSimilarity: () => void;
  newQuestionData: {
    statementEn: string;
    statementHi?: string;
    optionsEn?: Record<string, string>;
    optionsHi?: Record<string, string>;
    correctAnswer?: string[];
    subject?: string;
    chapter?: string;
    topic?: string;
  };
  onUseExisting?: (match: SimilarityMatch) => void;
}

export function QuestionSimilaritySidebar({
  report,
  checking,
  onCheckSimilarity,
  newQuestionData,
  onUseExisting,
}: QuestionSimilaritySidebarProps) {
  const [selectedMatch, setSelectedMatch] = useState<SimilarityMatch | null>(null);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "CRITICAL":
        return "text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800";
      case "HIGH":
        return "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
      case "MEDIUM":
        return "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
      case "LOW":
        return "text-yellow-700 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-800";
      default:
        return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
    }
  };

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-base">find_in_page</span>
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Similarity &amp; Duplicates
          </h4>
        </div>

        <button
          type="button"
          onClick={onCheckSimilarity}
          disabled={checking}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition flex items-center gap-1 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-xs">
            {checking ? "hourglass_empty" : "refresh"}
          </span>
          <span>{checking ? "Checking..." : "Re-check"}</span>
        </button>
      </div>

      {/* Body */}
      {checking ? (
        <div className="py-6 text-center space-y-2">
          <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
          <p className="text-xs text-slate-500">Checking vector embeddings for duplicate questions...</p>
        </div>
      ) : !report ? (
        <div className="py-5 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-dashed border-slate-200 dark:border-slate-700">
          Type your question statement to run automatic duplicate verification across 10,000+ repository items.
        </div>
      ) : report.matches.length === 0 ? (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">check_circle</span>
          <div>
            <div className="font-bold">100% Unique Question</div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400">No duplicates detected in repository.</div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Risk Level Alert */}
          <div
            className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${getRiskColor(
              report.duplicateRisk
            )}`}
          >
            <span>Duplicate Risk Level:</span>
            <span className="font-mono uppercase">{report.duplicateRisk}</span>
          </div>

          {/* Matches List */}
          <div className="space-y-2">
            {report.matches.map((m) => (
              <div
                key={m.questionId}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2 hover:border-blue-400 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {m.questionCode}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${getRiskColor(
                      m.classification
                    )}`}
                  >
                    {Math.round(m.overallScore)}% Match
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                  {m.statementEn || m.statementHi}
                </p>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSelectedMatch(m)}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Compare Side-by-Side
                  </button>
                  {onUseExisting && (
                    <button
                      type="button"
                      onClick={() => onUseExisting(m)}
                      className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] transition"
                    >
                      Use Existing
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {selectedMatch && (
        <SideBySideCompareModal
          match={selectedMatch}
          newQuestionData={newQuestionData}
          onClose={() => setSelectedMatch(null)}
          onUseExisting={onUseExisting}
        />
      )}
    </div>
  );
}