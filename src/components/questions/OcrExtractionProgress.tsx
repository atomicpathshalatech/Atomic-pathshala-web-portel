"use client";

import React, { useEffect, useState } from "react";

interface OcrExtractionProgressProps {
  isLoading: boolean;
  onComplete?: () => void;
}

const STAGES = [
  { id: 1, label: "Uploading & preprocessing image...", icon: "image" },
  { id: 2, label: "Detecting document layout & regions...", icon: "view_quilt" },
  { id: 3, label: "Extracting printed text (PaddleOCR Engine)...", icon: "translate" },
  { id: 4, label: "Converting math to LaTeX & formatting chemistry...", icon: "functions" },
  { id: 5, label: "Reconstructing structured options & question...", icon: "account_tree" },
];

export function OcrExtractionProgress({ isLoading }: OcrExtractionProgressProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setCurrentStageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 900);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="p-5 rounded-3xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 shadow-sm space-y-3.5 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <h4 className="text-xs font-black text-blue-900 dark:text-blue-300">
              In-Built OCR &amp; Formula Extraction in Progress
            </h4>
            <p className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">
              {STAGES[currentStageIndex]?.label || "Processing image..."}
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-sm">
          Stage {currentStageIndex + 1}/{STAGES.length}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-blue-200/60 dark:bg-blue-900/60 h-2 rounded-full overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${((currentStageIndex + 1) / STAGES.length) * 100}%` }}
        />
      </div>

      {/* Stage Dots */}
      <div className="grid grid-cols-5 gap-1 pt-1">
        {STAGES.map((s, idx) => (
          <div
            key={s.id}
            className={`text-[10px] font-bold text-center flex flex-col items-center gap-1 transition ${
              idx <= currentStageIndex
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-400 dark:text-slate-600"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{s.icon}</span>
            <span className="hidden sm:inline line-clamp-1">{s.label.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
