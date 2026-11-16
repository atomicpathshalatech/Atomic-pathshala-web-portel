"use client";

import { useState } from "react";
import Link from "next/link";
import { FormulaText } from "@/components/test-portal/FormulaText";

export interface PublicQuestionCardProps {
  question: {
    id: string;
    slug?: string | null;
    questionCode?: string | null;
    subject?: string;
    chapter?: string | null;
    topic?: string | null;
    pyqYear?: number | null;
    imageUrl?: string | null;
    solution?: string | null;
    translations?: {
      language: string;
      statement: string;
      options: any;
      correctOptionIds?: any;
      solution?: string | null;
    }[];
    pyqOccurrences?: {
      year?: number | null;
      session?: string | null;
      shift?: string | null;
      paper?: string | null;
      questionNumber?: string | null;
      exam?: { name: string; slug: string };
    }[];
  };
  isAuthorized?: boolean;
}

export function PublicQuestionCard({ question, isAuthorized = false }: PublicQuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const translation = question.translations?.[0];
  const options = (translation?.options || {}) as Record<string, string>;
  const correctKeys = ((translation?.correctOptionIds || []) as string[]).map((k) =>
    String(k).trim().toUpperCase()
  );
  const occurrence = question.pyqOccurrences?.[0];
  const qSlug = question.slug || question.id;

  const hasAnswered = selectedOption !== null;
  const isSelectedCorrect = selectedOption ? correctKeys.includes(selectedOption) : false;

  const handleSelect = (key: string) => {
    if (hasAnswered) return;
    setSelectedOption(key);
  };

  return (
    <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {occurrence ? (
              <span className="font-black text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg">
                {occurrence.exam?.name} {occurrence.year}{" "}
                {occurrence.session ? `(${occurrence.session})` : ""}
              </span>
            ) : question.pyqYear ? (
              <span className="font-black text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg">
                PYQ {question.pyqYear}
              </span>
            ) : null}

            {question.subject && (
              <span className="font-bold text-slate-600 dark:text-slate-400">
                {question.subject}
              </span>
            )}

            {question.chapter && (
              <span className="text-slate-400 font-medium truncate max-w-[150px]">
                · {question.chapter}
              </span>
            )}
          </div>

          <span className="font-mono text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800">
            {question.questionCode || question.id.slice(-6)}
          </span>
        </div>

        {/* Statement */}
        <Link href={`/pyq/question/${qSlug}`} className="block group">
          <div className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed my-2 group-hover:text-blue-600 transition">
            <FormulaText text={translation?.statement || "(Question text not available)"} />
          </div>
        </Link>

        {/* Image / Diagram */}
        {question.imageUrl && (
          <div className="my-3 max-w-xs rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white">
            <img src={question.imageUrl} alt="Question diagram" className="w-full object-contain" />
          </div>
        )}

        {/* Interactive Options Grid */}
        <div className="space-y-1 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1">
            <span className="font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-blue-600">touch_app</span>
              Click an option to test yourself:
            </span>
            {hasAnswered && (
              <span
                className={`font-black uppercase tracking-wider text-[10px] ${
                  isSelectedCorrect ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {isSelectedCorrect ? "Correct (+4)" : "Incorrect"}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {["A", "B", "C", "D"].map((key) => {
              const optText = options[key];
              if (!optText) return null;

              const isThisSelected = selectedOption === key;
              const isThisCorrect = correctKeys.includes(key);

              let buttonStyle =
                "border-slate-200/80 dark:border-slate-800 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-300 dark:bg-slate-950 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300";
              let badgeStyle = "text-slate-500 font-black";

              if (hasAnswered) {
                if (isThisCorrect) {
                  buttonStyle =
                    "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 font-bold shadow-xs";
                  badgeStyle = "text-emerald-700 dark:text-emerald-300 font-black";
                } else if (isThisSelected && !isThisCorrect) {
                  buttonStyle =
                    "border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 font-medium";
                  badgeStyle = "text-rose-700 dark:text-rose-300 font-black";
                } else {
                  buttonStyle =
                    "border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/40 text-slate-400 dark:text-slate-600 opacity-60";
                  badgeStyle = "text-slate-400 font-bold";
                }
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(key)}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${buttonStyle}`}
                >
                  <span className={`shrink-0 ${badgeStyle}`}>({key})</span>
                  <div className="flex-1">
                    <FormulaText text={optText} />
                  </div>
                  {hasAnswered && isThisCorrect && (
                    <span className="material-symbols-outlined text-xs text-emerald-600 shrink-0">
                      check_circle
                    </span>
                  )}
                  {hasAnswered && isThisSelected && !isThisCorrect && (
                    <span className="material-symbols-outlined text-xs text-rose-600 shrink-0">
                      cancel
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Solution Gate */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        {isAuthorized ? (
          <Link
            href={`/pyq/question/${qSlug}`}
            className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Verified Solution
          </Link>
        ) : (
          <Link
            href={`/login?redirect=${encodeURIComponent(`/pyq/question/${qSlug}`)}`}
            className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            Unlock Detailed Solution
          </Link>
        )}

        <Link
          href={`/pyq/question/${qSlug}`}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
        >
          Full Question & Solution &rarr;
        </Link>
      </div>
    </article>
  );
}
