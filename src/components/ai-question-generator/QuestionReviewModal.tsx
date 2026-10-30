"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  X,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { canonicalChapter } from "@/lib/academic/canonical-chapter";
import { MultiModelReviewDeck } from "./MultiModelReviewDeck";
import type { GeneratedQuestionItem } from "./GeneratedQuestionCard";

export interface QuestionReviewModalProps {
  question?: GeneratedQuestionItem;
  questions?: GeneratedQuestionItem[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  onClose: () => void;
  onUpdateQuestion?: (id: string, updated: Partial<GeneratedQuestionItem>) => Promise<void>;
  onSaveToDraft?: (id: string, submitToReview?: boolean) => Promise<void>;
}

/**
 * Sequential Review Modal for AI-Generated Questions:
 * Displays student view, complete academic metadata (Class 11/12, Subject, Chapter, Topic, Subtopic),
 * verified similarity match against question bank with direct link, and 4-Panel Multi-AI solutions.
 * Supports Next / Previous navigation and keyboard shortcuts (ArrowLeft / ArrowRight).
 */
export function QuestionReviewModal({
  question,
  questions: passedQuestions,
  currentIndex: passedCurrentIndex = 0,
  onNavigate,
  onClose,
  onUpdateQuestion,
}: QuestionReviewModalProps) {
  const questionsList = useMemo(() => {
    if (passedQuestions && passedQuestions.length > 0) return passedQuestions;
    if (question) return [question];
    return [];
  }, [passedQuestions, question]);

  const [localIndex, setLocalIndex] = useState(passedCurrentIndex);

  // Sync index if passed prop changes
  useEffect(() => {
    if (typeof passedCurrentIndex === "number") {
      setLocalIndex(passedCurrentIndex);
    }
  }, [passedCurrentIndex]);

  const activeIndex = typeof onNavigate === "function" ? passedCurrentIndex : localIndex;
  const currentQ = questionsList[activeIndex] || question;

  const hasHindi = Boolean(currentQ?.statementHi?.trim());
  const [lang, setLang] = useState<"EN" | "HI">("EN");
  const [showAnswer, setShowAnswer] = useState(true);

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < questionsList.length - 1;

  const handlePrev = () => {
    if (!canPrev) return;
    const nextIdx = activeIndex - 1;
    if (onNavigate) {
      onNavigate(nextIdx);
    } else {
      setLocalIndex(nextIdx);
    }
  };

  const handleNext = () => {
    if (!canNext) return;
    const nextIdx = activeIndex + 1;
    if (onNavigate) {
      onNavigate(nextIdx);
    } else {
      setLocalIndex(nextIdx);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && canPrev) {
        handlePrev();
      } else if (e.key === "ArrowRight" && canNext) {
        handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, canPrev, canNext, activeIndex]);

  if (!currentQ) return null;

  const classInfo = canonicalChapter(currentQ.subject, currentQ.chapter);
  const classLabel = classInfo?.classNumber ? `Class ${classInfo.classNumber}` : null;

  const hi = lang === "HI" && hasHindi;
  const statement = (hi ? currentQ.statementHi : currentQ.statementEn) || currentQ.statementEn || "";
  const options = (hi && currentQ.optionsHi ? currentQ.optionsHi : currentQ.optionsEn) || {};
  const solution = (hi ? currentQ.solutionHi : currentQ.solutionEn) || currentQ.solutionEn || "";

  // Similarity details from validation report
  const simReport = currentQ.validationReport?.similarityReport;
  const highestMatch = simReport?.highestMatch;
  const simScore = simReport?.highestScore ?? currentQ.validationReport?.duplicateScore ?? 0;
  const dupCode = highestMatch?.questionCode || currentQ.validationReport?.potentialDuplicateCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 md:p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Question review"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header with Title, Sequential Navigation & Close */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow-sm shrink-0">
              Q #{currentQ.questionIndex}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  Continuous Review
                </p>
                {questionsList.length > 1 && (
                  <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {activeIndex + 1} of {questionsList.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Sequential Previous / Next Buttons */}
            {questionsList.length > 1 && (
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={!canPrev}
                  title="Previous Question (ArrowLeft)"
                  className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-1 text-slate-500">
                  {activeIndex + 1}/{questionsList.length}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canNext}
                  title="Next Question (ArrowRight)"
                  className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {hasHindi && (
              <div className="flex rounded-xl border border-slate-200 p-0.5 text-[11px] font-bold dark:border-slate-700 bg-white dark:bg-slate-900">
                {(["EN", "HI"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={`rounded-lg px-2.5 py-1 transition ${lang === l ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
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
              className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 2. Complete Metadata Bar */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
            {currentQ.subject}
          </span>
          {classLabel && (
            <>
              <span className="text-slate-400">›</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {classLabel}
              </span>
            </>
          )}
          <span className="text-slate-400">›</span>
          <span className="font-semibold text-slate-700">{currentQ.chapter}</span>
          <span className="text-slate-400">›</span>
          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold border border-blue-200">
            Topic: {currentQ.topic}
          </span>
          {currentQ.subTopic && (
            <>
              <span className="text-slate-400">›</span>
              <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium border border-purple-200">
                Subtopic: {currentQ.subTopic}
              </span>
            </>
          )}
          <span className="text-slate-300">|</span>
          <span className="font-mono text-[11px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-bold uppercase">
            {currentQ.difficulty}
          </span>
          <span className="font-mono text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
            {currentQ.questionType.replace(/_/g, " ")}
          </span>
          {currentQ.pyqStyle && currentQ.pyqStyle !== "STANDARD" && (
            <span className="font-mono text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
              ⚡ {currentQ.pyqStyle.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* 3. Question Similarity Match Card */}
        {simScore > 0 && (
          <div className={`px-5 py-2.5 border-b text-xs flex flex-wrap items-center justify-between gap-2.5 ${
            simScore >= 85
              ? "bg-rose-50/80 border-rose-200 text-rose-950"
              : simScore >= 60
              ? "bg-amber-50/80 border-amber-200 text-amber-950"
              : "bg-slate-50 border-slate-200 text-slate-800"
          }`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
                simScore >= 85 ? "bg-rose-600 text-white" : simScore >= 60 ? "bg-amber-500 text-white" : "bg-slate-300 text-slate-800"
              }`}>
                {simScore}% Similarity
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                simScore >= 85 ? "bg-rose-100 text-rose-800 border-rose-300" : simScore >= 60 ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"
              }`}>
                {highestMatch?.classification || (simScore >= 85 ? "NEAR_DUPLICATE" : simScore >= 60 ? "SIMILAR" : "UNIQUE")}
              </span>
              {dupCode && (
                <span className="font-mono font-bold text-slate-800">
                  Matched Code: {dupCode}
                </span>
              )}
            </div>

            {highestMatch?.questionId && (
              <a
                href={`/team/questions/${highestMatch.questionId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded-lg shadow-2xs transition"
              >
                <span>Open Matched Question</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* 4. Body: Question Statement, Options, Solution & Multi-AI Deck */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
          {/* Statement */}
          <div className="flex gap-3">
            <span className="mt-0.5 shrink-0 text-sm font-black text-slate-500">Q{currentQ.questionIndex}.</span>
            <FormulaText text={statement} className="block text-[15px] leading-relaxed text-slate-900 dark:text-slate-100" />
          </div>

          {currentQ.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentQ.imageUrl} alt="Question figure" className="mx-auto max-h-72 rounded-xl object-contain border border-slate-200 shadow-sm" />
          )}

          {/* Options */}
          <div className="space-y-2.5">
            {(["A", "B", "C", "D"] as const).map((key) => {
              const text = options[key];
              if (!text) return null;
              const correct = showAnswer && currentQ.correctAnswer?.includes(key);
              return (
                <div
                  key={key}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                    correct
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40 shadow-2xs"
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
                  <FormulaText text={text} className="block leading-snug text-slate-800 dark:text-slate-200 flex-1" />
                  {correct && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                      Correct Key
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Solution & Explanation */}
          {showAnswer && solution && (
            <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Answer: Option ({currentQ.correctAnswer?.join(", ")}) — NCERT Step-by-Step Solution</span>
              </p>
              <FormulaText text={solution} className="block whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 pt-1" />
            </div>
          )}

          {/* 4-Panel Multi-AI Adversarial Review Deck */}
          <div className="pt-2 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
            <MultiModelReviewDeck
              questionId={currentQ.id}
              storedAnswer={currentQ.correctAnswer}
              validationStatus={currentQ.validationStatus}
              validationReport={currentQ.validationReport}
              onFacultyOverride={
                onUpdateQuestion
                  ? async () => {
                      await onUpdateQuestion(currentQ.id, {
                        validationStatus: "APPROVED_BY_FACULTY_OVERRIDE",
                      });
                    }
                  : undefined
              }
              onAcceptAiSolution={
                onUpdateQuestion
                  ? async (answer: string[], sol: string) => {
                      await onUpdateQuestion(currentQ.id, {
                        correctAnswer: answer,
                        solutionEn: sol,
                      });
                    }
                  : undefined
              }
            />
          </div>
        </div>

        {/* 5. Footer with Show/Hide Answer & Sequential Next / Previous */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3.5 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setShowAnswer((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shadow-2xs"
          >
            {showAnswer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{showAnswer ? "Hide Answer & Solution" : "Show Answer & Solution"}</span>
          </button>

          <div className="flex items-center gap-2">
            {canPrev && (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 shadow-2xs transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
            )}

            {canNext ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 shadow-sm transition"
              >
                <span>Next Question</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 shadow-sm"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
