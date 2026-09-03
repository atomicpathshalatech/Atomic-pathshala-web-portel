"use client";

import React, { useState } from "react";

interface QuestionIdBadgeProps {
  questionCode?: string | null;
  subjectName?: string;
  isSaving?: boolean;
}

export function QuestionIdBadge({
  questionCode,
  subjectName = "Chemistry",
  isSaving = false,
}: QuestionIdBadgeProps) {
  const [copied, setCopied] = useState(false);

  const displayId = questionCode || "AUTO-GENERATED ON SAVE";

  const handleCopy = () => {
    if (!questionCode) return;
    navigator.clipboard.writeText(questionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPrefixInfo = (code?: string | null) => {
    if (!code || code.length < 2) return "Prefix: Dynamic";
    const prefix = code.slice(0, 2);
    if (prefix === "80" || prefix === "81") return "Physics (80)";
    if (prefix === "82") return "Chemistry (82)";
    if (prefix === "83") return "Biology (83)";
    if (prefix === "84") return "Mathematics (84)";
    return "Standard Prefix";
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
          <span className="material-symbols-outlined text-lg">tag</span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-extrabold text-blue-600 dark:text-blue-400 tracking-wider">
              QUESTION ID
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
              8-Digit Standard
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm sm:text-base font-mono font-black text-slate-900 dark:text-white tracking-widest">
              {displayId}
            </span>

            {questionCode && (
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition font-sans flex items-center gap-1"
                title="Copy Question ID"
              >
                <span className="material-symbols-outlined text-xs">
                  {copied ? "check" : "content_copy"}
                </span>
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono font-bold">
          {getPrefixInfo(questionCode)}
        </span>
        {isSaving && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            Generating ID...
          </span>
        )}
      </div>
    </div>
  );
}