"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Trophy,
  RotateCcw,
  Award,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";

interface QuestionTranslation {
  language: string;
  statement: string;
  options: any;
  correctOptionIds: any;
  solution: string | null;
}

interface QuestionItem {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  type: string;
  difficulty: string;
  pyqExam: string | null;
  pyqYear: number | null;
  pyqMonth: string | null;
  solution: string | null;
  translations: QuestionTranslation[];
}

interface FlatQuestion {
  index: number;
  id: string;
  marks: number;
  negativeMarks: number;
  question: QuestionItem;
}

interface ExerciseData {
  id: string;
  exerciseCode: string;
  title: string;
  subject: string;
  chapter: string;
  defaultMarks: number;
  defaultNegativeMarks: number;
  sections: {
    id: string;
    title: string;
    questions: {
      id: string;
      marks: number | null;
      negativeMarks: number | null;
      question: QuestionItem;
    }[];
  }[];
}

export default function StudentExercisePracticePage() {
  const params = useParams();
  const router = useRouter();
  const exerciseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<ExerciseData | null>(null);
  const [questions, setQuestions] = useState<FlatQuestion[]>([]);

  // Practice state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"INSTANT_FEEDBACK" | "EXAM_MODE">("INSTANT_FEEDBACK");
  const [preferredLang, setPreferredLang] = useState<"HINDI" | "ENGLISH">("HINDI");
  const [timeSpentSeconds, setTimeSpentSeconds] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // Timer
  useEffect(() => {
    if (isSubmitted) return;
    const interval = setInterval(() => {
      setTimeSpentSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted]);

  // Load exercise data
  useEffect(() => {
    async function fetchExercise() {
      try {
        setLoading(true);
        const res = await fetch(`/api/student/exercises/${exerciseId}`);
        const json = await res.json();
        if (json.success && json.data?.exercise) {
          const ex: ExerciseData = json.data.exercise;
          setExercise(ex);

          // Flatten questions
          const flat: FlatQuestion[] = [];
          let idx = 0;
          for (const s of ex.sections) {
            for (const q of s.questions) {
              flat.push({
                index: idx++,
                id: q.question.id,
                marks: q.marks ?? ex.defaultMarks,
                negativeMarks: q.negativeMarks ?? ex.defaultNegativeMarks,
                question: q.question,
              });
            }
          }
          setQuestions(flat);
        }
      } catch (err) {
        console.error("Failed to load exercise", err);
      } finally {
        setLoading(false);
      }
    }
    fetchExercise();
  }, [exerciseId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm font-semibold text-slate-500">Loading Practice Sheet...</p>
      </div>
    );
  }

  if (!exercise || questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h2 className="text-lg font-bold text-slate-800">Exercise not found or empty</h2>
        <Link href="/practice" className="mt-4 inline-block text-xs font-semibold text-amber-600">
          &larr; Back to Practice Hub
        </Link>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  if (!currentQ) return null;
  const qItem = currentQ.question;
  const en = qItem.translations.find((t) => t.language.toUpperCase() === "ENGLISH");
  const hi = qItem.translations.find((t) => t.language.toUpperCase() === "HINDI");

  const activeTranslation = preferredLang === "HINDI" ? hi || en : en || hi;

  // Options
  const rawOpts = activeTranslation?.options || {};
  const optionKeys = ["A", "B", "C", "D"].filter((k) => (rawOpts as any)[k] !== undefined);
  const keysToUse = optionKeys.length > 0 ? optionKeys : Object.keys(rawOpts);

  // Correct options
  let correctOptionIds: string[] = [];
  if (activeTranslation?.correctOptionIds) {
    if (Array.isArray(activeTranslation.correctOptionIds)) {
      correctOptionIds = activeTranslation.correctOptionIds.map((c) => String(c).toUpperCase());
    } else if (typeof activeTranslation.correctOptionIds === "string") {
      correctOptionIds = [activeTranslation.correctOptionIds.toUpperCase()];
    }
  }

  const selectedForCurrent = userAnswers[qItem.id];
  const isAnswered = selectedForCurrent !== undefined;
  const isCurrentCorrect = selectedForCurrent && correctOptionIds.includes(selectedForCurrent.toUpperCase());

  const handleSelectOption = (key: string) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [qItem.id]: key,
    }));
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch(`/api/student/exercises/${exerciseId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          answers: userAnswers,
          timeSpentSeconds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitResult(json.data);
        setIsSubmitted(true);
      }
    } catch (err) {
      console.error("Failed to submit", err);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{exercise.subject}</span>
            <span>&bull;</span>
            <span>{exercise.chapter}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {exercise.title}
          </h1>
        </div>

        {/* Practice Controls */}
        <div className="flex items-center gap-3">
          {/* Mode Selector */}
          {!isSubmitted && (
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs font-semibold dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setMode("INSTANT_FEEDBACK")}
                className={`rounded-md px-2.5 py-1 ${
                  mode === "INSTANT_FEEDBACK"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-500"
                }`}
              >
                Instant Solution
              </button>
              <button
                type="button"
                onClick={() => setMode("EXAM_MODE")}
                className={`rounded-md px-2.5 py-1 ${
                  mode === "EXAM_MODE"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-500"
                }`}
              >
                Test Mode
              </button>
            </div>
          )}

          {/* Language Switch */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs font-semibold dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setPreferredLang("HINDI")}
              className={`rounded-md px-2 py-1 ${
                preferredLang === "HINDI"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500"
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => setPreferredLang("ENGLISH")}
              className={`rounded-md px-2 py-1 ${
                preferredLang === "ENGLISH"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-500"
              }`}
            >
              EN
            </button>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            {formatTimer(timeSpentSeconds)}
          </div>
        </div>
      </div>

      {/* Completion Score Card Banner if submitted */}
      {isSubmitted && submitResult && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-5 dark:border-emerald-800 dark:bg-emerald-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-emerald-900 dark:text-emerald-100">
                Practice Complete! Your Result:
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSubmitted(false);
                setUserAnswers({});
                setTimeSpentSeconds(0);
                setCurrentIndex(0);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-attempt
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-900">
              <span className="block text-xl font-extrabold text-slate-900 dark:text-white">
                {submitResult.score} / {submitResult.totalMarks}
              </span>
              <span className="text-[11px] text-slate-500">Score</span>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-900">
              <span className="block text-xl font-extrabold text-emerald-600">
                {submitResult.accuracy}%
              </span>
              <span className="text-[11px] text-slate-500">Accuracy</span>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-900">
              <span className="block text-xl font-extrabold text-emerald-600">
                {submitResult.correctCount}
              </span>
              <span className="text-[11px] text-slate-500">Correct</span>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-900">
              <span className="block text-xl font-extrabold text-rose-600">
                {submitResult.incorrectCount}
              </span>
              <span className="text-[11px] text-slate-500">Incorrect</span>
            </div>
          </div>
        </div>
      )}

      {/* Question Circles Navigation Palette */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
        {questions.map((q, idx) => {
          const ans = userAnswers[q.question.id];
          const isCur = idx === currentIndex;
          let circleBg = "bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

          if (isCur) {
            circleBg = "bg-amber-600 text-white font-bold ring-2 ring-amber-400";
          } else if (ans) {
            circleBg = "bg-blue-600 text-white font-semibold";
          }

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition-all ${circleBg}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Active Question Box */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
        {/* Question Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-extrabold text-white dark:bg-white dark:text-slate-900">
              Question {currentIndex + 1} of {questions.length}
            </span>

            {/* PYQ Badge */}
            {(qItem.pyqExam || qItem.pyqYear) && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                <Award className="h-3 w-3" />
                {[qItem.pyqExam, qItem.pyqYear].filter(Boolean).join(" ")}
              </span>
            )}
          </div>

          <span className="text-xs font-semibold text-slate-400">
            [+{currentQ.marks}, -{currentQ.negativeMarks}]
          </span>
        </div>

        {/* Statement */}
        <div className="text-sm font-medium leading-relaxed text-slate-900 dark:text-slate-100">
          {activeTranslation?.statement ? (
            <FormulaText text={activeTranslation.statement} />
          ) : (
            <p className="italic text-slate-400">Question statement unavailable in {preferredLang}.</p>
          )}
        </div>

        {/* Options */}
        <div className="space-y-2.5 pt-2">
          {keysToUse.map((key) => {
            const optText = (rawOpts as any)[key];
            const isSelected = selectedForCurrent === key;
            const isCorrect = correctOptionIds.includes(key);

            let optStyle = "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800";

            if (mode === "INSTANT_FEEDBACK" && isAnswered) {
              if (isCorrect) {
                optStyle = "border-emerald-500 bg-emerald-50/70 text-emerald-900 font-semibold dark:bg-emerald-950/60 dark:text-emerald-100 dark:border-emerald-500";
              } else if (isSelected && !isCorrect) {
                optStyle = "border-rose-500 bg-rose-50 text-rose-900 font-semibold dark:bg-rose-950/60 dark:text-rose-100 dark:border-rose-500";
              }
            } else if (isSelected) {
              optStyle = "border-amber-600 bg-amber-50/70 text-amber-900 font-semibold dark:bg-amber-950/60 dark:text-amber-100 dark:border-amber-500";
            }

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectOption(key)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-xs transition-all ${optStyle}`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    isSelected
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {key}
                </span>

                <div className="flex-1">
                  {optText ? (
                    <FormulaText text={optText} />
                  ) : (
                    <span className="italic text-slate-400">Option unavailable</span>
                  )}
                </div>

                {mode === "INSTANT_FEEDBACK" && isAnswered && isCorrect && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
                {mode === "INSTANT_FEEDBACK" && isAnswered && isSelected && !isCorrect && (
                  <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* Instant Solution reveal */}
        {(mode === "INSTANT_FEEDBACK" && isAnswered) || isSubmitted ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Solution &amp; Explanation:
            </div>
            <div className="text-xs text-slate-700 leading-relaxed dark:text-slate-300">
              {activeTranslation?.solution ? (
                <FormulaText text={activeTranslation.solution} />
              ) : qItem.solution ? (
                <FormulaText text={qItem.solution} />
              ) : (
                <p className="italic text-slate-400">Direct concept question. Correct answer is option ({correctOptionIds.join(", ")}).</p>
              )}
            </div>
          </div>
        ) : null}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          {!isSubmitted ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-xs"
            >
              Submit Sheet
            </button>
          ) : null}

          <button
            type="button"
            disabled={currentIndex === questions.length - 1}
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
