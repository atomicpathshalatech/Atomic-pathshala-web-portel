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
    <div className="bg-white text-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4 select-none font-sans animate-in fade-in">
      {/* Top Review Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span>Student View Preview</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                KaTeX Live
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Live preview of what students will see on screen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {subject && (
            <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
              {subject}
            </span>
          )}
          {chapter && (
            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200 max-w-[180px] truncate">
              {chapter}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
            +{marks} / -{negativeMarks}
          </span>
        </div>
      </div>

      {/* 1. Live Statement Review */}
      <div className="space-y-2.5">
        {statementHi.trim() && (
          <div className="space-y-1 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-800 font-mono">
              <span>[कथन - हिंदी पूर्वावलोकन]</span>
            </div>
            <EquationLivePreview
              content={statementHi}
              label="हिंदी प्रश्न"
              className="bg-transparent border-0 p-0 text-slate-900"
            />
          </div>
        )}

        {statementEn.trim() && (
          <div className="space-y-1 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-[10px] font-bold text-blue-800 font-mono">
              <span>[STATEMENT - ENGLISH PREVIEW]</span>
            </div>
            <EquationLivePreview
              content={statementEn}
              label="English Statement"
              className="bg-transparent border-0 p-0 text-slate-900"
            />
          </div>
        )}

        {/* Diagram in Student View */}
        {diagramUrl && (
          <div className="flex items-center justify-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <img
              src={diagramUrl}
              alt="Question Figure"
              className="max-h-48 max-w-full object-contain rounded-lg shadow-xs border border-slate-200"
            />
          </div>
        )}
      </div>

      {/* 2. Live Options Review Cards */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600 tracking-wider">
          <span>Options Preview</span>
          <span className="text-[11px] text-emerald-700 font-mono font-bold">
            Correct Answer: Option ({correctOption || "None"})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {optionsList.map((opt) => {
            const isCorrect = correctOption === opt.key;
            const hasText = opt.en.trim() || opt.hi.trim();
            if (!hasText) return null;

            return (
              <div
                key={opt.key}
                className={`p-2.5 rounded-xl border transition-all ${
                  isCorrect
                    ? "bg-emerald-50/90 border-emerald-500 shadow-xs"
                    : "bg-slate-50/60 border-slate-200 text-slate-800"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`w-6 h-6 shrink-0 rounded-lg font-mono font-black text-xs flex items-center justify-center ${
                      isCorrect
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-slate-700 border border-slate-300"
                    }`}
                  >
                    {isCorrect ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : opt.key}
                  </span>

                  <div className="flex-1 space-y-1 overflow-x-auto text-xs">
                    {opt.hi.trim() && (
                      <div className="text-amber-950 font-medium">
                        <EquationLivePreview
                          content={opt.hi}
                          label={`Option (${opt.key}) Hindi`}
                          className="bg-transparent border-0 p-0 text-amber-950"
                        />
                      </div>
                    )}
                    {opt.en.trim() && (
                      <div className="text-slate-900 font-medium">
                        <EquationLivePreview
                          content={opt.en}
                          label={`Option (${opt.key}) English`}
                          className="bg-transparent border-0 p-0 text-slate-900"
                        />
                      </div>
                    )}
                  </div>

                  {isCorrect && (
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
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
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-blue-700 tracking-wider">
            <span>Solution Preview</span>
            <span className="text-[10px] text-slate-500 font-mono">Step-by-Step</span>
          </div>

          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-2">
            {solutionHi.trim() && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-amber-800 font-mono">[हिंदी व्याख्या]</span>
                <EquationLivePreview
                  content={solutionHi}
                  label="Hindi Solution"
                  className="bg-transparent border-0 p-0 text-slate-800 text-xs leading-relaxed"
                />
              </div>
            )}

            {solutionEn.trim() && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-blue-800 font-mono">[ENGLISH SOLUTION]</span>
                <EquationLivePreview
                  content={solutionEn}
                  label="English Solution"
                  className="bg-transparent border-0 p-0 text-slate-800 text-xs leading-relaxed"
                />
              </div>
            )}

            {solutionImageUrl && (
              <div className="pt-1">
                <span className="text-[10px] font-bold text-blue-800 font-mono block mb-1">
                  [SOLUTION DIAGRAM]
                </span>
                <img
                  src={solutionImageUrl}
                  alt="Solution Figure"
                  className="max-h-44 object-contain rounded-lg border border-slate-200"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
