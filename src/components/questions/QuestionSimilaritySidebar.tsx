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
        return "text-red-400 bg-red-500/15 border-red-500/30";
      case "HIGH":
        return "text-rose-400 bg-rose-500/15 border-rose-500/30";
      case "MEDIUM":
        return "text-amber-400 bg-amber-500/15 border-amber-500/30";
      case "LOW":
        return "text-yellow-400 bg-yellow-500/15 border-yellow-500/30";
      default:
        return "text-emerald-400 bg-emerald-500/15 border-emerald-500/30";
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400 text-lg">policy</span>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Similarity & Duplication Check
          </h4>
        </div>

        <button
          type="button"
          onClick={onCheckSimilarity}
          disabled={checking}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition flex items-center gap-1 border border-slate-700"
        >
          <span className="material-symbols-outlined text-xs">
            {checking ? "sync" : "refresh"}
          </span>
          <span>{checking ? "Scanning..." : "Check"}</span>
        </button>
      </div>

      {/* Duplicate Risk Summary Card */}
      {report ? (
        <div className="space-y-3">
          <div
            className={`p-3 rounded-xl border flex items-center justify-between ${getRiskColor(
              report.duplicateRisk
            )}`}
          >
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider block opacity-80">
                Duplicate Risk
              </span>
              <span className="text-sm font-black tracking-wide">
                {report.duplicateRisk === "NONE"
                  ? "✓ NO DUPLICATES FOUND"
                  : `${report.duplicateRisk} RISK (${report.highestScore}% MATCH)`}
              </span>
            </div>

            <div className="text-right">
              <span className="text-lg font-mono font-black">
                {report.highestScore}%
              </span>
            </div>
          </div>

          {/* Counts Breakdown Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block">Exact (100%)</span>
              <span className="font-bold text-red-400 text-xs font-mono">{report.exactCount}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block">Near (90-99%)</span>
              <span className="font-bold text-rose-400 text-xs font-mono">{report.nearDuplicateCount}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block">Similar (75-89%)</span>
              <span className="font-bold text-amber-400 text-xs font-mono">{report.highlySimilarCount}</span>
            </div>
          </div>

          {/* Top Matches List */}
          {report.matches.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-slate-300 block">
                Top Matches in Question Bank:
              </span>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {report.matches.map((m) => (
                  <div
                    key={m.questionId}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-amber-400 text-[11px]">
                        #{m.questionCode}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">
                        {m.overallScore}% Match
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug">
                      {m.statementEn || m.statementHi}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                      <span>{m.subject} {m.chapter ? `· ${m.chapter}` : ""}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMatch(m)}
                        className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5"
                      >
                        <span>Compare</span>
                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
          <p className="text-xs text-slate-400">
            Write or paste a question statement to run automatic duplicate and similarity scanning.
          </p>
        </div>
      )}

      {/* Side by Side Modal */}
      {selectedMatch && (
        <SideBySideCompareModal
          newQuestion={newQuestionData}
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onUseExisting={onUseExisting}
        />
      )}
    </div>
  );
}