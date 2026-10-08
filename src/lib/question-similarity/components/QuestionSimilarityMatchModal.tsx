// src/question-similarity/components/QuestionSimilarityMatchModal.tsx
"use client";

import React from "react";
import { SimilarityMatch } from "../types";

export interface QuestionSimilarityMatchModalProps {
  match: SimilarityMatch;
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
  onClose: () => void;
  onUseExisting?: (match: SimilarityMatch) => void;
  onKeepAnyway?: () => void;
}

export function QuestionSimilarityMatchModal({
  match,
  newQuestion,
  onClose,
  onUseExisting,
  onKeepAnyway,
}: QuestionSimilarityMatchModalProps) {
  const isHighRisk = match.overallSimilarityPct >= 70;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg ${
                isHighRisk
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              {isHighRisk ? "⚠️" : "🔍"}
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2.5">
                <span>Similar Question Found — {match.overallSimilarityPct}%</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold border ${
                    match.overallSimilarityPct >= 90
                      ? "bg-red-500/20 text-red-300 border-red-500/40"
                      : match.overallSimilarityPct >= 70
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}
                >
                  {match.classification.replace(/_/g, " ")}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Matched Existing Question ID:{" "}
                <span className="font-mono text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                  {match.questionCode}
                </span>{" "}
                · {match.subject} {match.chapter ? `· ${match.chapter}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* 4-Metric Breakdown Bar */}
        <div className="grid grid-cols-4 gap-3 px-6 py-3 bg-slate-950/50 border-b border-slate-800 text-center text-xs">
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
              Exact Duplicate %
            </span>
            <span className="font-mono font-black text-white text-base">
              {match.exactDuplicatePct}%
            </span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
              Content Similarity %
            </span>
            <span className="font-mono font-black text-sky-400 text-base">
              {match.contentSimilarityPct}%
            </span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
              Structural Similarity %
            </span>
            <span className="font-mono font-black text-purple-400 text-base">
              {match.structuralSimilarityPct}%
            </span>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/80">
            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
              Overall Similarity %
            </span>
            <span className="font-mono font-black text-amber-400 text-base">
              {match.overallSimilarityPct}%
            </span>
          </div>
        </div>

        {/* Comparison Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Left Column: Original / Existing Question */}
          <div className="space-y-4 pr-0 md:pr-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Original Existing Question
              </span>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                {match.questionCode}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Statement (Highlighted Match)
              </label>
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-sm text-slate-100 leading-relaxed min-h-[90px]">
                {match.highlightedDiff ? (
                  match.highlightedDiff.originalTokens.map((tok, idx) => (
                    <span
                      key={idx}
                      className={
                        tok.isMatched
                          ? "bg-amber-500/25 text-amber-200 font-medium px-0.5 rounded"
                          : ""
                      }
                    >
                      {tok.text}{" "}
                    </span>
                  ))
                ) : (
                  match.statementEn
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Options
              </label>
              <div className="space-y-1.5 text-xs">
                {["A", "B", "C", "D"].map((optKey) => {
                  const val = match.optionsEn?.[optKey];
                  const isCorrect = match.correctAnswer?.includes(optKey);
                  return (
                    <div
                      key={optKey}
                      className={`p-2.5 rounded-xl flex items-start gap-2 border ${
                        isCorrect
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-800/40 border-slate-800 text-slate-300"
                      }`}
                    >
                      <span className="font-bold font-mono">({optKey})</span>
                      <span>{val || "—"}</span>
                      {isCorrect && (
                        <span className="ml-auto text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                          Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: New Question Draft */}
          <div className="space-y-4 pl-0 md:pl-4 pt-4 md:pt-0">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-black uppercase text-rose-400 tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse" />
                New Question (Being Added/Reviewed)
              </span>
              <span className="text-[11px] font-mono text-slate-400">New Candidate</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Statement (Highlighted Match)
              </label>
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-sm text-slate-100 leading-relaxed min-h-[90px]">
                {match.highlightedDiff ? (
                  match.highlightedDiff.newTokens.map((tok, idx) => (
                    <span
                      key={idx}
                      className={
                        tok.isMatched
                          ? "bg-rose-500/25 text-rose-200 font-medium px-0.5 rounded"
                          : ""
                      }
                    >
                      {tok.text}{" "}
                    </span>
                  ))
                ) : (
                  newQuestion.statementEn
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Options
              </label>
              <div className="space-y-1.5 text-xs">
                {["A", "B", "C", "D"].map((optKey) => {
                  const val = newQuestion.optionsEn?.[optKey];
                  const isCorrect = newQuestion.correctAnswer?.includes(optKey);
                  return (
                    <div
                      key={optKey}
                      className={`p-2.5 rounded-xl flex items-start gap-2 border ${
                        isCorrect
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-800/40 border-slate-800 text-slate-300"
                      }`}
                    >
                      <span className="font-bold font-mono">({optKey})</span>
                      <span>{val || "—"}</span>
                      {isCorrect && (
                        <span className="ml-auto text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                          Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
          >
            Close Inspector
          </button>

          <div className="flex items-center gap-3">
            {onUseExisting && (
              <button
                type="button"
                onClick={() => {
                  onUseExisting(match);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md transition"
              >
                Use Existing Question #{match.questionCode}
              </button>
            )}

            {onKeepAnyway && (
              <button
                type="button"
                onClick={() => {
                  onKeepAnyway();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition"
              >
                Keep New Question Anyway
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
