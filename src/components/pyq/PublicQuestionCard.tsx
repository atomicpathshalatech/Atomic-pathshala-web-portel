"use client";

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
  const translation = question.translations?.[0];
  const options = (translation?.options || {}) as Record<string, string>;
  const correctKeys = (translation?.correctOptionIds || []) as string[];
  const occurrence = question.pyqOccurrences?.[0];
  const qSlug = question.slug || question.id;

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

          <span className="font-mono text-[10px] text-slate-400">
            {question.questionCode || question.id.slice(-6)}
          </span>
        </div>

        {/* Statement */}
        <div className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed my-2">
          <FormulaText text={translation?.statement || "(Question text not available)"} />
        </div>

        {/* Image / Diagram */}
        {question.imageUrl && (
          <div className="my-3 max-w-xs rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <img src={question.imageUrl} alt="Question diagram" className="w-full object-contain" />
          </div>
        )}

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          {["A", "B", "C", "D"].map((key) => {
            const optText = options[key];
            if (!optText) return null;
            const isCorrect = isAuthorized && correctKeys.includes(key);

            return (
              <div
                key={key}
                className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs transition ${
                  isCorrect
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200 font-bold"
                    : "bg-slate-50/60 border-slate-200/70 text-slate-700 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300"
                }`}
              >
                <span className={`font-black shrink-0 ${isCorrect ? "text-emerald-600" : "text-blue-600"}`}>
                  ({key})
                </span>
                <div className="flex-1">
                  <FormulaText text={optText} />
                </div>
              </div>
            );
          })}
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
            href={`/login?redirect=/pyq/question/${qSlug}`}
            className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            Login to View Solution
          </Link>
        )}

        <Link
          href={`/pyq/question/${qSlug}`}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
        >
          Discuss & Practice &rarr;
        </Link>
      </div>
    </article>
  );
}
