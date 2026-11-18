"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { UnifiedQuestionEditor } from "@/components/questions/UnifiedQuestionEditor";

export interface ManualQuestionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultExamId?: string;
  defaultSubject?: string;
  defaultChapter?: string;
  defaultYear?: number | string;
  defaultSession?: string;
  defaultShift?: string;
  defaultPaper?: string;
  defaultQuestionNumber?: string;
  exams?: Array<{ id: string; name: string; canonicalType?: string; legacyCode?: string }>;
}

export function ManualQuestionDialog({
  open,
  onClose,
  onSuccess,
  defaultExamId,
  defaultSubject,
  defaultChapter,
  defaultYear,
  defaultSession,
  defaultShift,
  defaultPaper,
  defaultQuestionNumber,
  exams = [],
}: ManualQuestionDialogProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const currentYearStr = defaultYear ? String(defaultYear) : new Date().getFullYear().toString();
  const matchedExam = exams.find((e) => e.id === defaultExamId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl h-[94vh] max-h-[94vh] flex flex-col rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Studio Dialog Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-3.5 bg-white dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20 text-xs tracking-wider">
              PYQ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Add PYQ Question
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  Shared Question Studio
                </span>
                {matchedExam && (
                  <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {matchedExam.name} {currentYearStr}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Identical to Test Management Studio — Ctrl+V screenshot paste, bilingual Hindi/English &amp; LaTeX formulas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Body - Exact UnifiedQuestionEditor */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <UnifiedQuestionEditor
            mode="pyq"
            pyqExamId={defaultExamId}
            pyqExamName={matchedExam?.name}
            pyqYear={currentYearStr}
            pyqSession={defaultSession}
            pyqShift={defaultShift}
            pyqPaper={defaultPaper}
            pyqQuestionNumber={defaultQuestionNumber || "Question 01"}
            pyqExams={exams}
            initialQuestion={{
              subject: defaultSubject || "Physics",
              chapter: defaultChapter || "",
            }}
            onSaveSuccess={(_saved) => {
              onSuccess();
              onClose();
            }}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
