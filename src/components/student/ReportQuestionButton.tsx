"use client";

import React, { useState } from "react";
import { Flag, AlertCircle } from "lucide-react";
import { ReportQuestionModal, type QuestionMetadataForReport } from "@/components/student/ReportQuestionModal";

interface ReportQuestionButtonProps {
  questionId: string;
  questionMeta?: QuestionMetadataForReport;
  testId?: string;
  className?: string;
  variant?: "pill" | "text" | "subtle" | "banner";
  label?: string;
}

export function ReportQuestionButton({
  questionId,
  questionMeta,
  testId,
  className = "",
  variant = "subtle",
  label,
}: ReportQuestionButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {variant === "banner" ? (
        <div
          className={`flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-300 ${className}`}
        >
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Found an error in this answer or explanation?</span>
          </span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:underline"
          >
            <Flag className="h-3 w-3" />
            {label || "Report Question"}
          </button>
        </div>
      ) : variant === "pill" ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50 transition ${className}`}
        >
          <Flag className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          {label || "Report Question"}
        </button>
      ) : variant === "text" ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline dark:text-amber-400 ${className}`}
        >
          <Flag className="h-3 w-3" />
          {label || "Answer seems wrong? Report it"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition ${className}`}
          title="Report an issue with this question or answer"
        >
          <Flag className="h-3 w-3" />
          {label || "Report issue"}
        </button>
      )}

      <ReportQuestionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        questionId={questionId}
        questionMeta={questionMeta}
        testId={testId}
      />
    </>
  );
}
