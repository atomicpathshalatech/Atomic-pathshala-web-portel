"use client";

import React from "react";
import {
  FileText,
  AlertOctagon,
  Copy,
  Layers,
  Repeat,
  CheckCircle2,
  ImageOff,
  BookOpen,
  Award,
  Zap,
  Flame,
  ShieldAlert,
} from "lucide-react";

interface AuditMetricsGridProps {
  metrics: {
    totalQuestions: number;
    exactIdDuplicates: number;
    contentDuplicates: number;
    nearDuplicates: number;
    conceptRepetitions: number;
    answerKeyConflicts: number;
    missingDiagrams: number;
    missingSolutions: number;
    neetPatternAlignment: string;
    easyCount: number;
    moderateCount: number;
    difficultCount: number;
    veryDifficultCount: number;
    criticalIssuesCount: number;
  };
  activeFilter: string | null;
  onSelectFilter: (filterKey: string | null) => void;
}

export function AuditMetricsGrid({
  metrics,
  activeFilter,
  onSelectFilter,
}: AuditMetricsGridProps) {
  const cards = [
    {
      key: "ALL",
      label: "Total Audited",
      value: metrics.totalQuestions,
      icon: FileText,
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      description: "Complete question set",
    },
    {
      key: "CRITICAL",
      label: "Critical Issues",
      value: metrics.criticalIssuesCount,
      icon: ShieldAlert,
      badgeColor:
        metrics.criticalIssuesCount > 0
          ? "bg-red-100 text-red-800 border-red-300 ring-2 ring-red-400"
          : "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Blocks test publication",
    },
    {
      key: "EXACT_ID",
      label: "Exact ID Dups",
      value: metrics.exactIdDuplicates,
      icon: AlertOctagon,
      badgeColor:
        metrics.exactIdDuplicates > 0
          ? "bg-red-100 text-red-800 border-red-300"
          : "bg-slate-50 text-slate-600 border-slate-200",
      description: "Zero tolerance (DB locked)",
    },
    {
      key: "EXACT_CONTENT",
      label: "Content Dups",
      value: metrics.contentDuplicates,
      icon: Copy,
      badgeColor:
        metrics.contentDuplicates > 0
          ? "bg-red-100 text-red-800 border-red-300"
          : "bg-slate-50 text-slate-600 border-slate-200",
      description: "Exact statement match",
    },
    {
      key: "NEAR_DUPLICATE",
      label: "Near Duplicates",
      value: metrics.nearDuplicates,
      icon: Layers,
      badgeColor:
        metrics.nearDuplicates > 0
          ? "bg-amber-100 text-amber-800 border-amber-300"
          : "bg-slate-50 text-slate-600 border-slate-200",
      description: "Rearranged or variant questions",
    },
    {
      key: "CONCEPT_REPETITION",
      label: "Concept Repetitions",
      value: metrics.conceptRepetitions,
      icon: Repeat,
      badgeColor: "bg-slate-50 text-slate-600 border-slate-200",
      description: "Same concept clustered",
    },
    {
      key: "ANSWER_CONFLICT",
      label: "Answer Conflicts",
      value: metrics.answerKeyConflicts,
      icon: CheckCircle2,
      badgeColor:
        metrics.answerKeyConflicts > 0
          ? "bg-rose-100 text-rose-800 border-rose-300"
          : "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Key mismatch or missing",
    },
    {
      key: "MISSING_DIAGRAM",
      label: "Missing Diagrams",
      value: metrics.missingDiagrams,
      icon: ImageOff,
      badgeColor:
        metrics.missingDiagrams > 0
          ? "bg-amber-100 text-amber-800 border-amber-300"
          : "bg-slate-50 text-slate-600 border-slate-200",
      description: "Referenced but missing",
    },
    {
      key: "MISSING_SOLUTION",
      label: "Missing Solutions",
      value: metrics.missingSolutions,
      icon: BookOpen,
      badgeColor:
        metrics.missingSolutions > 0
          ? "bg-orange-100 text-orange-800 border-orange-300"
          : "bg-slate-50 text-slate-600 border-slate-200",
      description: "No explanation provided",
    },
    {
      key: "NEET_ALIGNMENT",
      label: "NEET Alignment",
      value: metrics.neetPatternAlignment.replace(/_/g, " "),
      isText: true,
      icon: Award,
      badgeColor:
        metrics.neetPatternAlignment === "NEET_STANDARD"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-700 border-amber-200",
      description: "Blueprint calibration",
    },
    {
      key: "DIFF_EASY",
      label: "Easy Questions",
      value: metrics.easyCount,
      icon: Zap,
      badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
      description: "Direct concept recall",
    },
    {
      key: "DIFF_MODERATE",
      label: "Moderate Questions",
      value: metrics.moderateCount,
      icon: Zap,
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      description: "Core NEET difficulty",
    },
    {
      key: "DIFF_DIFFICULT",
      label: "Difficult Questions",
      value: metrics.difficultCount,
      icon: Flame,
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      description: "Multi-step analytical",
    },
    {
      key: "DIFF_VERY_DIFFICULT",
      label: "Very Difficult",
      value: metrics.veryDifficultCount,
      icon: Flame,
      badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
      description: "Advanced rank-boosters",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {cards.map((c) => {
        const Icon = c.icon;
        const isSelected = activeFilter === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelectFilter(isSelected ? null : c.key)}
            className={`flex flex-col justify-between p-3 rounded-xl border text-left transition-all ${
              isSelected
                ? "ring-2 ring-blue-600 shadow-md bg-white border-blue-500 scale-[1.02]"
                : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold text-slate-500 truncate mr-1">
                {c.label}
              </span>
              <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>

            <div className="my-1">
              <span
                className={`inline-block px-2 py-0.5 rounded-lg text-sm font-bold border ${c.badgeColor} ${
                  c.isText ? "text-[11px] font-semibold" : "text-base"
                }`}
              >
                {c.value}
              </span>
            </div>

            <p className="text-[10px] text-slate-400 truncate mt-1">
              {c.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
