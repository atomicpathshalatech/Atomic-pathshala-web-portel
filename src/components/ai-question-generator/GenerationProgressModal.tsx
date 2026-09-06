"use client";

import React from "react";
import { Sparkles, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  batchCode: string;
  progress: number;
  currentStep: string;
  generatedCount: number;
  totalRequested: number;
  passedCount: number;
  needsReviewCount: number;
  failedCount: number;
  onClose?: () => void;
}

export function GenerationProgressModal({
  isOpen,
  batchCode,
  progress,
  currentStep,
  generatedCount,
  totalRequested,
  passedCount,
  needsReviewCount,
  failedCount,
  onClose,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
            {progress < 100 ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              {progress < 100 ? "Generating Production-Grade Questions..." : "Generation Complete!"}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Batch Code: <strong className="text-slate-800">{batchCode}</strong>
            </p>
          </div>
        </div>

        {/* Progress Bar & Real Step Text */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span className="line-clamp-1">{currentStep || "Processing..."}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
        </div>

        {/* Live Counters Breakdown */}
        <div className="grid grid-cols-4 gap-2 pt-2 text-center">
          <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            <p className="text-[10px] text-slate-500 font-bold uppercase">Generated</p>
            <p className="text-lg font-black text-slate-800 mt-0.5">
              {generatedCount}/{totalRequested}
            </p>
          </div>
          <div className="bg-emerald-50 p-2.5 rounded-2xl border border-emerald-200">
            <p className="text-[10px] text-emerald-700 font-bold uppercase">Passed</p>
            <p className="text-lg font-black text-emerald-700 mt-0.5">{passedCount}</p>
          </div>
          <div className="bg-amber-50 p-2.5 rounded-2xl border border-amber-200">
            <p className="text-[10px] text-amber-700 font-bold uppercase">Review</p>
            <p className="text-lg font-black text-amber-700 mt-0.5">{needsReviewCount}</p>
          </div>
          <div className="bg-rose-50 p-2.5 rounded-2xl border border-rose-200">
            <p className="text-[10px] text-rose-700 font-bold uppercase">Failed</p>
            <p className="text-lg font-black text-rose-700 mt-0.5">{failedCount}</p>
          </div>
        </div>

        {/* Policy reminder */}
        <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100 text-[11px] text-purple-900 leading-relaxed">
          <p className="font-bold flex items-center gap-1 mb-0.5">
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>Adversarial AI Quality Assurance Active:</span>
          </p>
          <span>
            Every question undergoes independent solver verification, ambiguity inspection, distractor validation, and cross-question duplicate detection before entering the review card deck.
          </span>
        </div>

        {/* Close / Background button */}
        {progress >= 100 && onClose && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              View Generated Questions Deck
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
