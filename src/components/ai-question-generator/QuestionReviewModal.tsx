"use client";

import React, { useEffect, useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";
import type { GeneratedQuestionItem } from "./GeneratedQuestionCard";

/**
 * A generated question as the student will see it in a test — formulas,
 * tables, structures and the figure rendered, English or Hindi — with the
 * answer and solution shown on request. For checking before it is saved.
 */
export function QuestionReviewModal({
  question,
  onClose,
}: {
  question: GeneratedQuestionItem;
  onClose: () => void;
}) {
  const hasHindi = Boolean(question.statementHi?.trim());
  const [lang, setLang] = useState<"EN" | "HI">("EN");
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hi = lang === "HI" && hasHindi;
  const statement = (hi ? question.statementHi : question.statementEn) || question.statementEn || "";
  const options = (hi && question.optionsHi ? question.optionsHi : question.optionsEn) || {};
  const solution = (hi ? question.solutionHi : question.solutionEn) || question.solutionEn || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Question review"
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white">
              Review — Question {question.questionIndex}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {[question.subject, question.chapter, question.topic].filter(Boolean).join(" › ")} · {question.difficulty} ·{" "}
              {question.questionType.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasHindi && (
              <div className="flex rounded-xl border border-slate-200 p-0.5 text-[11px] font-bold dark:border-slate-700">
                {(["EN", "HI"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={`rounded-lg px-2.5 py-1 ${lang === l ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
                  >
                    {l === "EN" ? "English" : "हिंदी"}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close review"
              className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* The question, as in the test */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-sm font-black text-slate-500">Q{question.questionIndex}.</span>
            <FormulaText text={statement} className="block text-[15px] leading-relaxed text-slate-900 dark:text-slate-100" />
          </div>

          {question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={question.imageUrl} alt="Question figure" className="mx-auto max-h-72 rounded-xl object-contain" />
          )}

          <div className="space-y-2.5">
            {(["A", "B", "C", "D"] as const).map((key) => {
              const text = options[key];
              if (!text) return null;
              const correct = showAnswer && question.correctAnswer?.includes(key);
              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
                    correct
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      correct ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {key}
                  </span>
                  <FormulaText text={text} className="block leading-snug text-slate-800 dark:text-slate-200" />
                </div>
              );
            })}
          </div>

          {showAnswer && solution && (
            <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Answer: Option ({question.correctAnswer?.join(", ")}) — Solution
              </p>
              <FormulaText text={solution} className="block whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowAnswer((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {showAnswer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{showAnswer ? "Hide answer & solution" : "Show answer & solution"}</span>
          </button>
          <button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
