// src/question-similarity/components/QuestionSimilarityBadge.tsx
"use client";

import React, { useState } from "react";
import { SimilarityMatch, SimilarityReport } from "../types";
import { QuestionSimilarityMatchModal } from "./QuestionSimilarityMatchModal";

export interface QuestionSimilarityBadgeProps {
  score?: number;
  report?: SimilarityReport | null;
  newQuestionData?: {
    statementEn: string;
    statementHi?: string;
    optionsEn?: Record<string, string>;
    optionsHi?: Record<string, string>;
    correctAnswer?: string[];
    subject?: string;
    chapter?: string;
  };
  onClick?: () => void;
  onUseExisting?: (match: SimilarityMatch) => void;
  size?: "sm" | "md" | "lg";
}

export function QuestionSimilarityBadge({
  score,
  report,
  newQuestionData,
  onClick,
  onUseExisting,
  size = "md",
}: QuestionSimilarityBadgeProps) {
  const [showModal, setShowModal] = useState(false);

  const effectiveScore = score !== undefined ? score : report?.overallScore ?? 0;
  const highestMatch = report?.highestMatch || null;

  // Exact Requested Color Thresholds:
  // 🟢 0–29% — Low Similarity
  // 🟡 30–69% — Similar
  // 🔴 70–89% — High Similarity
  // 🔴 90–100% — Duplicate / Near Duplicate
  const getBadgeStyle = (pct: number) => {
    if (pct >= 90) {
      return {
        bg: "bg-red-500/15 dark:bg-red-950/50 hover:bg-red-500/25",
        text: "text-red-700 dark:text-red-400 font-black",
        border: "border-red-400 dark:border-red-800",
        dot: "bg-red-500 animate-pulse",
        label: "Duplicate / Near Duplicate",
        emoji: "🔴",
      };
    }
    if (pct >= 70) {
      return {
        bg: "bg-rose-500/15 dark:bg-rose-950/50 hover:bg-rose-500/25",
        text: "text-rose-700 dark:text-rose-400 font-bold",
        border: "border-rose-400 dark:border-rose-800",
        dot: "bg-rose-500",
        label: "High Similarity",
        emoji: "🔴",
      };
    }
    if (pct >= 30) {
      return {
        bg: "bg-amber-500/15 dark:bg-amber-950/50 hover:bg-amber-500/25",
        text: "text-amber-800 dark:text-amber-300 font-bold",
        border: "border-amber-400 dark:border-amber-800",
        dot: "bg-amber-500",
        label: "Similar",
        emoji: "🟡",
      };
    }
    return {
      bg: "bg-emerald-500/15 dark:bg-emerald-950/50 hover:bg-emerald-500/25",
      text: "text-emerald-800 dark:text-emerald-300 font-bold",
      border: "border-emerald-400 dark:border-emerald-800",
      dot: "bg-emerald-500",
      label: "Low Similarity",
      emoji: "🟢",
    };
  };

  const style = getBadgeStyle(effectiveScore);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else if (highestMatch && newQuestionData) {
      setShowModal(true);
    }
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1.5",
    md: "px-3 py-1 text-xs gap-2",
    lg: "px-4 py-1.5 text-sm gap-2.5",
  }[size];

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={`Similarity: ${effectiveScore}% (${style.label}) - Click to inspect match`}
        className={`inline-flex items-center rounded-full border transition-all cursor-pointer select-none shadow-sm ${style.bg} ${style.border} ${style.text} ${sizeClasses}`}
      >
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
        <span className="font-mono">
          Similarity: <strong>{effectiveScore}%</strong>
        </span>
        {size !== "sm" && (
          <span className="opacity-80 text-[10px] font-normal border-l border-current/20 pl-1.5">
            {style.label}
          </span>
        )}
      </button>

      {/* Comparison Modal */}
      {showModal && highestMatch && newQuestionData && (
        <QuestionSimilarityMatchModal
          match={highestMatch}
          newQuestion={newQuestionData}
          onClose={() => setShowModal(false)}
          onUseExisting={onUseExisting}
        />
      )}
    </>
  );
}
