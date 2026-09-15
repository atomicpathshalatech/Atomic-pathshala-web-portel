"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  FileQuestion,
  GraduationCap,
  Loader2,
  Printer,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  BOARDS,
  CLASSES,
  LANGUAGES,
  MODES,
  SUBJECTS_BY_CLASS,
  YEARS,
  type BoardClass,
  type BoardLanguage,
  type BoardMode,
  type BoardPaper,
  type BoardSubPart,
} from "@/lib/ai-chat/boardExam";

interface SubPartBlockProps {
  part: BoardSubPart;
  index: number;
  globalReveal?: boolean;
}

function SubPartBlock({ part, index, globalReveal }: SubPartBlockProps) {
  const [localRevealed, setLocalRevealed] = useState<boolean | null>(null);
  const revealed = localRevealed !== null ? localRevealed : Boolean(globalReveal);
  const label = String.fromCharCode(97 + index);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
          <span className="mr-1.5 font-bold text-amber-600 dark:text-amber-400">
            ({part.label ?? label})
          </span>
          {part.text}
        </p>
        <span className="shrink-0 whitespace-nowrap rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          {part.marks} {part.marks === 1 ? "Mark" : "Marks"}
        </span>
      </div>

      {(part.type === "mcq" || part.type === "assertion_reason") && part.options && (
        <div className="mt-3 grid gap-1.5 pl-3 sm:grid-cols-2">
          {part.options.map((option, optIndex) => {
            const isCorrect = optIndex === part.correctIndex;
            return (
              <div
                key={optIndex}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
                  revealed && isCorrect
                    ? "border-emerald-500 bg-emerald-50 font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-slate-200 bg-slate-50/70 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
                }`}
              >
                <span className="font-mono font-semibold">
                  ({String.fromCharCode(105 + optIndex)})
                </span>
                <span className="flex-1">{option}</span>
                {revealed && isCorrect && (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {(part.type === "short" || part.type === "long") && part.answer && revealed && (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-50/80 p-3 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <span className="mb-1 block font-bold text-emerald-700 dark:text-emerald-400">
            Model Solution & Scheme:
          </span>
          {part.answer}
        </div>
      )}

      {(part.options || part.answer) && (
        <div className="mt-2.5 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setLocalRevealed(!revealed)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
          >
            {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {revealed ? "Hide Answer" : "Reveal Answer & Solution"}
          </button>
        </div>
      )}
    </div>
  );
}

function PaperView({ paper, onReset }: { paper: BoardPaper; onReset: () => void }) {
  const [globalReveal, setGlobalReveal] = useState(false);
  const boardLabel = BOARDS.find((b) => b.value === paper.board)?.label ?? paper.board;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              {boardLabel}
            </span>
            <span className="rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              Class {paper.className}
            </span>
            {paper.year && (
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Year: {paper.year}
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
            {paper.subject}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {paper.mode === "pyq" ? "Previous Year Question (PYQ) Practice" : "Expected Model Paper"}{" "}
            • Total Marks: <span className="font-semibold text-slate-700 dark:text-slate-200">{paper.totalMarks}</span> • Time Allowed:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{paper.timeAllowed}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setGlobalReveal((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {globalReveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {globalReveal ? "Hide All Answers" : "Show All Answers"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            New Paper
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
        <span className="font-bold">Important Instructions:</span> All questions are compulsory. Internal choices are provided in Long Answer sections. Read each question carefully before attempting.
      </div>

      {/* Questions Stack */}
      <div className="mt-8 space-y-8">
        {paper.questions.map((question) => (
          <div key={question.id} className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {question.sectionTitle}
              </span>
              <span className="text-xs font-medium text-slate-400">
                Question {question.questionNumber}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/50">
              <div className="space-y-3.5">
                {question.subParts.map((part, i) => (
                  <SubPartBlock key={i} part={part} index={i} globalReveal={globalReveal} />
                ))}
              </div>

              {question.orAlternative && question.orAlternative.length > 0 && (
                <div className="mt-5 pt-3">
                  <div className="relative my-4 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                    </div>
                    <span className="relative rounded-full bg-slate-200 px-3 py-1 text-xs font-black tracking-widest text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      OR
                    </span>
                  </div>
                  <div className="space-y-3.5">
                    {question.orAlternative.map((part, i) => (
                      <SubPartBlock key={i} part={part} index={i} globalReveal={globalReveal} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BoardExamHubProps {
  backUrl?: string;
  backLabel?: string;
}

export function BoardExamHub({
  backUrl = "/practice",
  backLabel = "Return to Practice",
}: BoardExamHubProps) {
  const [board, setBoard] = useState("CBSE");
  const [className, setClassName] = useState<BoardClass>("12th");
  const [subject, setSubject] = useState("Physics");
  const [language, setLanguage] = useState<BoardLanguage>("hindi");
  const [mode, setMode] = useState<BoardMode>("pyq");
  const [year, setYear] = useState("2024");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<BoardPaper | null>(null);

  const subjects = SUBJECTS_BY_CLASS[className];

  const handleGenerate = async () => {
    if (!board || !subject) {
      setError("Please select both a Board and a Subject.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-chat/board-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board, className, subject, language, mode, year }),
      });
      const data = (await response.json()) as { paper?: BoardPaper; error?: string };
      if (!response.ok || !data.paper) {
        throw new Error(data.error ?? "Could not generate the paper.");
      }
      setPaper(data.paper);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not generate the paper.");
    } finally {
      setLoading(false);
    }
  };

  if (paper) {
    return (
      <main className="min-h-dvh bg-white dark:bg-slate-950">
        <PaperView paper={paper} onReset={() => setPaper(null)} />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50/60 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Atomic Pathshala
              </p>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                Board Exam Hub
              </h1>
            </div>
          </div>
          <Link
            href={backUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Select your Board, Class, Subject, and Mode. Practice authentic previous-year style papers and expected model exam papers with detailed step-by-step marking schemes.
        </p>

        {/* Configuration Card */}
        <div className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Board Selector */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              1. Select Board
            </label>
            <select
              value={board}
              onChange={(event) => setBoard(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            >
              {BOARDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              2. Select Class
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CLASSES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setClassName(item.value);
                    const newSubs = SUBJECTS_BY_CLASS[item.value];
                    if (newSubs && newSubs[0]) setSubject(newSubs[0]);
                  }}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                    className === item.value
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Selector */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              3. Select Subject
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {subjects.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSubject(item)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                    subject === item
                      ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                      : "border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Paper Mode & Year Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Paper Mode */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                4. Paper Type
              </label>
              <div className="space-y-2">
                {MODES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setMode(item.value)}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${
                      mode === item.value
                        ? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/30"
                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50"
                    }`}
                  >
                    <p
                      className={`text-xs font-bold ${
                        mode === item.value
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {item.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Year Focus */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                5. Target Year / Trend
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
              >
                {YEARS.map((y) => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </select>

              {/* Language Selector */}
              <div className="mt-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  6. Medium / Language
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {LANGUAGES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setLanguage(item.value)}
                      className={`rounded-lg border px-2 py-1.5 text-center text-xs font-semibold transition-all ${
                        language === item.value
                          ? "border-amber-500 bg-amber-500 text-white shadow-xs"
                          : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
                      }`}
                    >
                      {item.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border-l-4 border-red-500 bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Official-Pattern Paper...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate & Start Board Exam Paper
              </>
            )}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <FileQuestion className="h-3.5 w-3.5" />
            Complete authentic pattern with MCQs, Assertion-Reason, Short & Long Answer with OR choice.
          </p>
        </div>
      </div>
    </main>
  );
}
