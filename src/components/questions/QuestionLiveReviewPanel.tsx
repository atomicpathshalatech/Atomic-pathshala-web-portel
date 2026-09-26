"use client";

import React from "react";
import { Check, Eye, BookOpen, Layers, CheckCircle2 } from "lucide-react";
import { EquationLivePreview } from "./EquationLivePreview";

export interface QuestionLiveReviewPanelProps {
  statementEn: string;
  statementHi: string;
  optionAEn: string;
  optionAHi: string;
  optionBEn: string;
  optionBHi: string;
  optionCEn: string;
  optionCHi: string;
  optionDEn: string;
  optionDHi: string;
  correctOption: string;
  solutionEn: string;
  solutionHi: string;
  diagramUrl?: string | null;
  solutionImageUrl?: string | null;
  subject?: string;
  chapter?: string;
  marks?: number;
  negativeMarks?: number;
}

export function QuestionLiveReviewPanel({
  statementEn,
  statementHi,
  optionAEn,
  optionAHi,
  optionBEn,
  optionBHi,
  optionCEn,
  optionCHi,
  optionDEn,
  optionDHi,
  correctOption,
  solutionEn,
  solutionHi,
  diagramUrl,
  solutionImageUrl,
  subject,
  chapter,
  marks = 4,
  negativeMarks = 1,
}: QuestionLiveReviewPanelProps) {
  const hasContent = Boolean(
    statementEn.trim() ||
      statementHi.trim() ||
      optionAEn.trim() ||
      optionAHi.trim() ||
      solutionEn.trim() ||
      solutionHi.trim()
  );

  if (!hasContent) return null;

  const optionsList = [
    { key: "A", en: optionAEn, hi: optionAHi },
    { key: "B", en: optionBEn, hi: optionBHi },
    { key: "C", en: optionCEn, hi: optionCHi },
    { key: "D", en: optionDEn, hi: optionDHi },
  ];

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-[#0c1938] text-white rounded-3xl p-6 shadow-2xl border border-slate-700/80 space-y-6 select-none font-sans animate-in fade-in">
      {/* Top Review Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
              <span>Live Student View &amp; Review Column</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 font-bold">
                Real-Time KaTeX Rendered
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Instant preview of what students will see on their test screen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {subject && (
            <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-blue-300 font-bold text-xs border border-slate-700">
              {subject}
            </span>
          )}
          {chapter && (
            <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 font-medium text-xs border border-slate-700 max-w-[200px] truncate">
              {chapter}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-xl bg-emerald-950/80 text-emerald-400 font-bold text-xs border border-emerald-800">
            +{marks} / -{negativeMarks}
          </span>
        </div>
      </div>

      {/* 1. Live Statement Review */}
      <div className="space-y-4">
        {statementHi.trim() && (
          <div className="space-y-1 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 font-mono">
              <span>[कथन - HINDI REVIEW]</span>
            </div>
            <EquationLivePreview
              content={statementHi}
              label="हिंदी प्रश्न"
              className="bg-transparent border-0 p-0 text-white dark:text-white"
            />
          </div>
        )}

        {statementEn.trim() && (
          <div className="space-y-1 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
            <div className="flex items-center justify-between text-[11px] font-bold text-blue-400 font-mono">
              <span>[STATEMENT - ENGLISH REVIEW]</span>
            </div>
            <EquationLivePreview
              content={statementEn}
              label="English Statement"
              className="bg-transparent border-0 p-0 text-white dark:text-white"
            />
          </div>
        )}

        {/* Diagram in Student View */}
        {diagramUrl && (
          <div className="flex items-center justify-center p-3 bg-slate-800/40 rounded-2xl border border-slate-700/50">
            <img
              src={diagramUrl}
              alt="Question Figure"
              className="max-h-60 max-w-full object-contain rounded-xl shadow-lg border border-slate-700"
            />
          </div>
        )}
      </div>

      {/* 2. Live Options Review Cards */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between text-xs font-black uppercase text-slate-400 tracking-wider">
          <span>Options Review</span>
          <span className="text-[11px] text-emerald-400 font-mono">
            Correct Key: Option ({correctOption || "None"})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {optionsList.map((opt) => {
            const isCorrect = correctOption === opt.key;
            const hasText = opt.en.trim() || opt.hi.trim();
            if (!hasText) return null;

            return (
              <div
                key={opt.key}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isCorrect
                    ? "bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/50"
                    : "bg-slate-800/70 border-slate-700/70 text-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`w-7 h-7 shrink-0 rounded-xl font-mono font-black text-xs flex items-center justify-center ${
                      isCorrect
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/40"
                        : "bg-slate-700 text-slate-300 border border-slate-600"
                    }`}
                  >
                    {isCorrect ? <Check className="w-4 h-4 stroke-[3]" /> : opt.key}
                  </span>

                  <div className="flex-1 space-y-1 overflow-x-auto">
                    {opt.hi.trim() && (
                      <div className="text-xs text-amber-200">
                        <EquationLivePreview
                          content={opt.hi}
                          label={`Option (${opt.key}) Hindi`}
                          className="bg-transparent border-0 p-0 text-amber-200 dark:text-amber-200"
                        />
                      </div>
                    )}
                    {opt.en.trim() && (
                      <div className="text-xs text-slate-100 font-medium">
                        <EquationLivePreview
                          content={opt.en}
                          label={`Option (${opt.key}) English`}
                          className="bg-transparent border-0 p-0 text-white dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {isCorrect && (
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Correct Key
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Live Solution Review */}
      {(solutionEn.trim() || solutionHi.trim() || solutionImageUrl) && (
        <div className="space-y-3 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs font-black uppercase text-blue-400 tracking-wider">
            <span>Authoritative Solution Review</span>
            <span className="text-[11px] text-slate-400 font-mono">4-Part NCERT Method</span>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 space-y-3">
            {solutionHi.trim() && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-amber-400 font-mono">[हिंदी व्याख्या]</span>
                <EquationLivePreview
                  content={solutionHi}
                  label="Hindi Solution"
                  className="bg-transparent border-0 p-0 text-slate-200 dark:text-slate-200 text-xs leading-relaxed"
                />
              </div>
            )}

            {solutionEn.trim() && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-blue-400 font-mono">[ENGLISH SOLUTION]</span>
                <EquationLivePreview
                  content={solutionEn}
                  label="English Solution"
                  className="bg-transparent border-0 p-0 text-slate-200 dark:text-slate-200 text-xs leading-relaxed"
                />
              </div>
            )}

            {solutionImageUrl && (
              <div className="pt-2">
                <span className="text-[11px] font-bold text-blue-400 font-mono block mb-1">
                  [SOLUTION DIAGRAM]
                </span>
                <img
                  src={solutionImageUrl}
                  alt="Solution Figure"
                  className="max-h-56 object-contain rounded-xl border border-slate-700"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
