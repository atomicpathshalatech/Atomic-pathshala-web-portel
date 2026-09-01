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
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
          <span className="material-symbols-outlined text-lg">tag</span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-extrabold text-amber-400 tracking-wider">
              QUESTION ID
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
              8-Digit Standard
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm sm:text-base font-mono font-black text-white tracking-widest">
              {displayId}
            </span>

            {questionCode && (
              <button
                type="button"
                onClick={handleCopy}
                title="Copy Question ID"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? "check" : "content_copy"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Unique Non-Reusable ID</span>
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 font-mono text-[11px]">
          {getPrefixInfo(questionCode)}
        </span>
      </div>
    </div>
  );
}