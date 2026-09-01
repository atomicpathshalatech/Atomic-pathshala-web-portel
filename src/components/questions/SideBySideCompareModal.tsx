"use client";

import React from "react";
import { SimilarityMatch } from "@/lib/questions/similarity";

interface SideBySideCompareModalProps {
  newQuestion: {
    statementEn: string;
    statementHi?: string;
    optionsEn?: Record<string, string>;
    optionsHi?: Record<string, string>;
    correctAnswer?: string[];
    subject?: string;
    chapter?: string;
    topic?: string;
  };
  match: SimilarityMatch;
  onClose: () => void;
  onUseExisting?: (match: SimilarityMatch) => void;
}

export function SideBySideCompareModal({
  newQuestion,
  match,
  onClose,
  onUseExisting,
}: SideBySideCompareModalProps) {
  const getBadgeColor = (classification: string) => {
    switch (classification) {
      case "EXACT_DUPLICATE":
        return "bg-red-500/20 text-red-300 border-red-500/40";
      case "NEAR_DUPLICATE":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "HIGHLY_SIMILAR":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "SIMILAR":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
      default:
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400 text-2xl">compare</span>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Side-by-Side Similarity Comparison</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${getBadgeColor(
                    match.classification
                  )}`}
                >
                  {match.overallScore}% · {match.classification.replace("_", " ")}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Comparing newly drafted question with Existing ID: <span className="font-mono text-amber-400 font-bold">{match.questionCode}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Detailed Metrics Breakdown */}
        <div className="grid grid-cols-4 gap-2 px-6 py-3 bg-slate-950/40 border-b border-slate-800 text-center text-xs">
          <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Text Match</span>
            <span className="font-mono font-bold text-white text-sm">{match.textSimilarity}%</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Structure/Template</span>
            <span className="font-mono font-bold text-white text-sm">{match.structureSimilarity}%</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Concept Match</span>
            <span className="font-mono font-bold text-white text-sm">{match.conceptSimilarity}%</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Option Match</span>
            <span className="font-mono font-bold text-white text-sm">{match.optionSimilarity}%</span>
          </div>
        </div>

        {/* Comparison Columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Left: New Question */}
          <div className="space-y-4 pr-0 md:pr-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-black uppercase text-rose-400 tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Newly Drafted Question
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Unsaved</span>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400">Statement (English)</label>
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-sm text-slate-100 leading-relaxed min-h-[80px]">
                {newQuestion.statementEn || <span className="text-slate-500 italic">No English statement</span>}
              </div>
            </div>

            {newQuestion.statementHi && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400">Statement (Hindi)</label>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-sm text-slate-100 leading-relaxed">
                  {newQuestion.statementHi}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400">Options</label>
              <div className="space-y-1.5 text-xs">
                {["A", "B", "C", "D"].map((key) => {
                  const opt = newQuestion.optionsEn?.[key];
                  const isCorrect = newQuestion.correctAnswer?.includes(key);
                  return (
                    <div
                      key={key}
                      className={`p-2.5 rounded-xl flex items-start gap-2 border ${
                        isCorrect
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-800/40 border-slate-800 text-slate-300"
                      }`}
                    >
                      <span className="font-bold font-mono">({key})</span>
                      <span>{opt || "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Existing Question in Database */}
          <div className="space-y-4 pl-0 md:pl-3 pt-4 md:pt-0">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Existing Question in Bank
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                ID: {match.questionCode}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400">Statement (English)</label>
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-sm text-slate-100 leading-relaxed min-h-[80px]">
                {match.statementEn || <span className="text-slate-500 italic">No English statement</span>}
              </div>
            </div>

            {match.statementHi && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400">Statement (Hindi)</label>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-sm text-slate-100 leading-relaxed">
                  {match.statementHi}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400">Options</label>
              <div className="space-y-1.5 text-xs">
                {["A", "B", "C", "D"].map((key) => {
                  const opt = match.optionsEn?.[key];
                  const isCorrect = match.correctAnswer?.includes(key);
                  return (
                    <div
                      key={key}
                      className={`p-2.5 rounded-xl flex items-start gap-2 border ${
                        isCorrect
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-800/40 border-slate-800 text-slate-300"
                      }`}
                    >
                      <span className="font-bold font-mono">({key})</span>
                      <span>{opt || "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {match.solutionEn && (
              <div className="space-y-1 text-xs">
                <label className="text-[11px] font-bold text-slate-400">Solution</label>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 line-clamp-3">
                  {match.solutionEn}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
          >
            Close Comparison
          </button>

          <div className="flex items-center gap-3">
            {onUseExisting && (
              <button
                type="button"
                onClick={() => onUseExisting(match)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md transition"
              >
                Use Existing Question #{match.questionCode}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition"
            >
              Continue Editing New
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}