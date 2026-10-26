"use client";

import React from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Cpu,
  ShieldCheck,
  Binary,
  FlaskConical,
  Scale,
  BrainCircuit,
} from "lucide-react";

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

interface PipelineStage {
  id: number;
  title: string;
  subtitle: string;
  provider: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 1,
    title: "Question Generation",
    subtitle: "Drafting stem, distractors, KaTeX LaTeX math & NCERT references",
    provider: "Google Gemini",
    icon: Sparkles,
  },
  {
    id: 2,
    title: "L1 Review & Citation Check",
    subtitle: "Independent solve, curriculum topic grounding & solution corrections",
    provider: "Gemini 1.5",
    icon: Cpu,
  },
  {
    id: 3,
    title: "L2 Independent Audit",
    subtitle: "Blind solve, scientific & mathematical correctness validation",
    provider: "OpenAI GPT-4o",
    icon: BrainCircuit,
  },
  {
    id: 4,
    title: "L3 Independent Audit",
    subtitle: "Blind solve, ambiguity & multiple correct option detection",
    provider: "Anthropic Claude 3.5",
    icon: ShieldCheck,
  },
  {
    id: 5,
    title: "Deterministic Validation",
    subtitle: "KaTeX bracket syntax, arithmetic evaluation & chemical charge balance",
    provider: "Deterministic Engine",
    icon: FlaskConical,
  },
  {
    id: 6,
    title: "Consensus Quality Decision",
    subtitle: "Multi-model agreement gate & discrepancy resolution",
    provider: "Adversarial Consensus",
    icon: Scale,
  },
];

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

  // Derive active stage from progress percentage
  const getStageState = (stageId: number): "DONE" | "ACTIVE" | "PENDING" => {
    if (progress >= 100) return "DONE";
    if (stageId === 1) {
      return progress < 30 ? "ACTIVE" : "DONE";
    }
    if (stageId === 2) {
      if (progress < 30) return "PENDING";
      return progress < 50 ? "ACTIVE" : "DONE";
    }
    if (stageId === 3) {
      if (progress < 50) return "PENDING";
      return progress < 68 ? "ACTIVE" : "DONE";
    }
    if (stageId === 4) {
      if (progress < 68) return "PENDING";
      return progress < 82 ? "ACTIVE" : "DONE";
    }
    if (stageId === 5) {
      if (progress < 82) return "PENDING";
      return progress < 92 ? "ACTIVE" : "DONE";
    }
    if (stageId === 6) {
      if (progress < 92) return "PENDING";
      return "ACTIVE";
    }
    return "PENDING";
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            {progress < 100 ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900 truncate">
              {progress < 100
                ? "Multi-Model Intelligence & QC Engine Active"
                : "All Verification Stages Complete!"}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
              Batch: <strong className="text-slate-800">{batchCode}</strong> ·{" "}
              <span className="text-blue-600 font-bold">3 AI Models + Deterministic QC</span>
            </p>
          </div>
        </div>

        {/* Progress Bar & Real Step Text */}
        <div className="space-y-2 shrink-0">
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span className="line-clamp-1">{currentStep || "Processing..."}</span>
            <span className="font-mono text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
        </div>

        {/* 6-Stage Visual Pipeline Checklist */}
        <div className="border border-slate-100 bg-slate-50/60 rounded-2xl p-3.5 space-y-2 overflow-y-auto max-h-56 scrollbar-thin">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
            6-Stage Multi-Model Quality Pipeline
          </p>
          <div className="space-y-1.5">
            {PIPELINE_STAGES.map((stage) => {
              const state = getStageState(stage.id);
              const Icon = stage.icon;
              return (
                <div
                  key={stage.id}
                  className={`flex items-center justify-between gap-3 p-2 rounded-xl text-xs transition border ${
                    state === "ACTIVE"
                      ? "bg-blue-50/80 border-blue-200 shadow-sm"
                      : state === "DONE"
                      ? "bg-white border-slate-100"
                      : "bg-slate-50/30 border-transparent opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                        state === "DONE"
                          ? "bg-emerald-100 text-emerald-700"
                          : state === "ACTIVE"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {state === "DONE" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : state === "ACTIVE" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>{stage.id}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-[11px] truncate">
                        {stage.title}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{stage.subtitle}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      state === "DONE"
                        ? "bg-emerald-50 text-emerald-700 font-bold"
                        : state === "ACTIVE"
                        ? "bg-blue-100 text-blue-800 font-bold animate-pulse"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {stage.provider}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Counters Breakdown */}
        <div className="grid grid-cols-4 gap-2 text-center shrink-0">
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
            <p className="text-[10px] text-amber-700 font-bold uppercase">Needs Review</p>
            <p className="text-lg font-black text-amber-700 mt-0.5">{needsReviewCount}</p>
          </div>
          <div className="bg-rose-50 p-2.5 rounded-2xl border border-rose-200">
            <p className="text-[10px] text-rose-700 font-bold uppercase">Failed</p>
            <p className="text-lg font-black text-rose-700 mt-0.5">{failedCount}</p>
          </div>
        </div>

        {/* Close / View Deck button */}
        {progress >= 100 && onClose && (
          <div className="pt-1 flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition shadow-blue-500/20"
            >
              View Verified Questions &amp; Review Panels
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
