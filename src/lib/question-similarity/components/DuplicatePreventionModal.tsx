// src/question-similarity/components/DuplicatePreventionModal.tsx
"use client";

import React, { useState } from "react";
import { SimilarityMatch, SimilarityReport } from "../types";
import { QuestionSimilarityMatchModal } from "./QuestionSimilarityMatchModal";

export interface DuplicatePreventionModalProps {
  report: SimilarityReport;
  newQuestionData: {
    statementEn: string;
    statementHi?: string;
    optionsEn?: Record<string, string>;
    optionsHi?: Record<string, string>;
    correctAnswer?: string[];
    subject?: string;
    chapter?: string;
  };
  onKeepAnyway: () => void;
  onCancel: () => void;
  onUseExisting?: (match: SimilarityMatch) => void;
}

export function DuplicatePreventionModal({
  report,
  newQuestionData,
  onKeepAnyway,
  onCancel,
  onUseExisting,
}: DuplicatePreventionModalProps) {
  const [showFullMatch, setShowFullMatch] = useState(false);
  const highestMatch = report.highestMatch;

  if (!highestMatch) return null;

  const isNearDuplicate = report.isExactDuplicate; // >= 90%

  return (
    <>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
          {/* Warning Icon & Title */}
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                isNearDuplicate
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              {isNearDuplicate ? "🛑" : "⚠️"}
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {isNearDuplicate ? "Possible Duplicate Question" : "Potential Duplicate Detected"}
              </h3>
              <p className="text-xs text-slate-400">
                Similarity Score:{" "}
                <span className="font-mono font-bold text-amber-400">
                  {report.overallScore}% Similar
                </span>
              </p>
            </div>
          </div>

          {/* Alert Box */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
              <span>Matching Question ID:</span>
              <span className="font-bold text-amber-400">{highestMatch.questionCode}</span>
            </div>
            <p className="text-slate-300 line-clamp-3 leading-relaxed">
              "{highestMatch.statementEn || highestMatch.statementHi}"
            </p>
          </div>

          {/* 3 User Actions: View Match, Keep Anyway, Cancel */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition border border-slate-700"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => setShowFullMatch(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5"
            >
              <span>🔍</span>
              <span>View Match</span>
            </button>

            <button
              type="button"
              onClick={onKeepAnyway}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md transition"
            >
              Keep Anyway
            </button>
          </div>
        </div>
      </div>

      {/* Side-by-Side Detailed Compare Modal */}
      {showFullMatch && (
        <QuestionSimilarityMatchModal
          match={highestMatch}
          newQuestion={newQuestionData}
          onClose={() => setShowFullMatch(false)}
          onUseExisting={onUseExisting}
          onKeepAnyway={onKeepAnyway}
        />
      )}
    </>
  );
}
