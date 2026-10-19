"use client";

import { useState } from "react";
import { FormulaText } from "@/components/test-portal/FormulaText";
import {
  Trash2,
  MoveRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Award,
} from "lucide-react";

interface Translation {
  language: string;
  statement: string;
  options: any;
  correctOptionIds: any;
  solution: string | null;
}

interface QuestionDetails {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  type: string;
  difficulty: string;
  pyqExam: string | null;
  pyqYear: number | null;
  pyqMonth: string | null;
  pyqQuestionNumber: string | null;
  solution: string | null;
  isPublished: boolean;
  translations: Translation[];
}

interface SectionOption {
  id: string;
  title: string;
}

interface ExerciseQuestionCardProps {
  exerciseId: string;
  exerciseQuestionId: string;
  questionNumber: number;
  question: QuestionDetails;
  exerciseChapter: string;
  currentSectionId: string | null;
  sections: SectionOption[];
  onRemove: (eqId: string) => void;
  onMoveSection: (eqId: string, newSectionId: string) => void;
}

export function ExerciseQuestionCard({
  exerciseId,
  exerciseQuestionId,
  questionNumber,
  question,
  exerciseChapter,
  currentSectionId,
  sections,
  onRemove,
  onMoveSection,
}: ExerciseQuestionCardProps) {
  const [activeLang, setActiveLang] = useState<"BILINGUAL" | "HINDI" | "ENGLISH">("BILINGUAL");
  const [showSolution, setShowSolution] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const en = question.translations.find((t) => t.language.toUpperCase() === "ENGLISH");
  const hi = question.translations.find((t) => t.language.toUpperCase() === "HINDI");

  // Chapter mismatch detection
  const hasChapterMismatch =
    exerciseChapter &&
    question.chapter &&
    question.chapter.trim().toLowerCase() !== exerciseChapter.trim().toLowerCase();

  // Determine correct answer keys
  let correctOptionIds: string[] = [];
  const primaryTrans = en || hi;
  if (primaryTrans?.correctOptionIds) {
    if (Array.isArray(primaryTrans.correctOptionIds)) {
      correctOptionIds = primaryTrans.correctOptionIds.map((c) => String(c).toUpperCase());
    } else if (typeof primaryTrans.correctOptionIds === "string") {
      correctOptionIds = [primaryTrans.correctOptionIds.toUpperCase()];
    }
  }

  // Options keys
  const optionsObj = (hi?.options || en?.options || {}) as Record<string, string>;
  const optionKeys = ["A", "B", "C", "D"].filter((k) => optionsObj[k] !== undefined);
  const keysToDisplay = optionKeys.length > 0 ? optionKeys : Object.keys(optionsObj);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
            {questionNumber}
          </span>
          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
            {question.questionCode || question.id}
          </span>

          {/* PYQ Badge */}
          {(question.pyqExam || question.pyqYear) && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
              <Award className="h-3 w-3" />
              {[question.pyqExam, question.pyqYear, question.pyqMonth].filter(Boolean).join(" ")}
            </span>
          )}

          {/* Type Badge */}
          <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
            {question.type.replace(/_/g, " ")}
          </span>

          {/* Difficulty Badge */}
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {question.difficulty}
          </span>

          {/* Chapter mismatch warning pill */}
          {hasChapterMismatch && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              From: {question.chapter}
            </span>
          )}

          {!question.isPublished && (
            <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
              Draft in Question Bank
            </span>
          )}
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-2">
          {/* Language Switch Tabs */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-[11px] font-medium dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setActiveLang("BILINGUAL")}
              className={`rounded px-2 py-0.5 ${
                activeLang === "BILINGUAL"
                  ? "bg-white font-bold text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Both
            </button>
            <button
              type="button"
              onClick={() => setActiveLang("HINDI")}
              className={`rounded px-2 py-0.5 ${
                activeLang === "HINDI"
                  ? "bg-white font-bold text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => setActiveLang("ENGLISH")}
              className={`rounded px-2 py-0.5 ${
                activeLang === "ENGLISH"
                  ? "bg-white font-bold text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              EN
            </button>
          </div>

          {/* Move to Section dropdown */}
          {sections.length > 1 && (
            <select
              value={currentSectionId || ""}
              onChange={(e) => onMoveSection(exerciseQuestionId, e.target.value)}
              className="h-7 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Move &rarr; {s.title}
                </option>
              ))}
            </select>
          )}

          {/* Non-destructive Delete Button */}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title="Remove question from this exercise (does not delete from Question Bank)"
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[11px] text-red-700 border border-red-200 dark:bg-red-950/60 dark:border-red-800">
              <span>Remove from sheet?</span>
              <button
                type="button"
                onClick={() => onRemove(exerciseQuestionId)}
                className="font-bold underline hover:text-red-900"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Question Statements Body */}
      <div className="mt-3 space-y-2.5">
        {(activeLang === "BILINGUAL" || activeLang === "HINDI") && hi?.statement && (
          <div className="text-xs text-slate-900 leading-relaxed dark:text-slate-100">
            <FormulaText text={hi.statement} />
          </div>
        )}

        {(activeLang === "BILINGUAL" || activeLang === "ENGLISH") && en?.statement && (
          <div className="text-xs text-slate-700 leading-relaxed dark:text-slate-300">
            <FormulaText text={en.statement} />
          </div>
        )}

        {!hi?.statement && !en?.statement && (
          <p className="text-xs italic text-slate-400">Question statement is empty.</p>
        )}
      </div>

      {/* Options Grid */}
      {keysToDisplay.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {keysToDisplay.map((key) => {
            const isCorrect = correctOptionIds.includes(key);
            const hiText = hi?.options?.[key];
            const enText = en?.options?.[key];

            return (
              <div
                key={key}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-xs transition-colors ${
                  isCorrect
                    ? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-500/70 dark:bg-emerald-950/30"
                    : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    isCorrect
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {key}
                </span>

                <div className="flex-1 space-y-1">
                  {(activeLang === "BILINGUAL" || activeLang === "HINDI") && hiText && (
                    <div className="text-slate-900 dark:text-white">
                      <FormulaText text={hiText} />
                    </div>
                  )}
                  {(activeLang === "BILINGUAL" || activeLang === "ENGLISH") && enText && (
                    <div className="text-slate-600 dark:text-slate-400">
                      <FormulaText text={enText} />
                    </div>
                  )}
                  {!hiText && !enText && (
                    <span className="text-slate-400 italic">Option text unavailable</span>
                  )}
                </div>

                {isCorrect && (
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Expandable Solution Toggle */}
      <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setShowSolution(!showSolution)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
        >
          {showSolution ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Hide Explanation / Solution
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              View Explanation / Solution
            </>
          )}
        </button>

        {showSolution && (
          <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700 space-y-2">
            <span className="block font-bold text-slate-700 dark:text-slate-300">
              Answer &amp; Detailed Explanation:
            </span>
            {hi?.solution && (
              <div>
                <span className="font-semibold text-slate-500 text-[10px] uppercase">हिन्दी व्याख्या:</span>
                <div className="text-slate-900 dark:text-white mt-0.5">
                  <FormulaText text={hi.solution} />
                </div>
              </div>
            )}
            {en?.solution && (
              <div>
                <span className="font-semibold text-slate-500 text-[10px] uppercase">English Explanation:</span>
                <div className="text-slate-700 dark:text-slate-300 mt-0.5">
                  <FormulaText text={en.solution} />
                </div>
              </div>
            )}
            {!hi?.solution && !en?.solution && question.solution && (
              <div className="text-slate-800 dark:text-slate-200">
                <FormulaText text={question.solution} />
              </div>
            )}
            {!hi?.solution && !en?.solution && !question.solution && (
              <p className="italic text-slate-400">No extended solution registered for this question.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
