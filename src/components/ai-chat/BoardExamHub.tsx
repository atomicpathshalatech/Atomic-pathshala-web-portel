"use client";

import {
  ArrowLeft,
  BookOpenCheck,
  FileQuestion,
  Loader2,
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
  type BoardClass,
  type BoardLanguage,
  type BoardMode,
  type BoardPaper,
  type BoardSubPart,
} from "@/lib/ai-chat/boardExam";

function SubPartBlock({ part, index }: { part: BoardSubPart; index: number }) {
  const [revealed, setRevealed] = useState(false);
  const label = String.fromCharCode(97 + index);

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">
          <span className="mr-1.5 font-semibold text-atomic-orange">({part.label ?? label})</span>
          {part.text}
        </p>
        <span className="whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800">
          {part.marks} {part.marks === 1 ? "mark" : "marks"}
        </span>
      </div>

      {(part.type === "mcq" || part.type === "assertion_reason") && part.options && (
        <div className="mt-2 space-y-1 pl-4">
          {part.options.map((option, optIndex) => (
            <p
              key={optIndex}
              className={`text-sm ${
                revealed && optIndex === part.correctIndex
                  ? "font-semibold text-emerald-600"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              ({String.fromCharCode(105 + optIndex)}) {option}
            </p>
          ))}
        </div>
      )}

      {(part.type === "short" || part.type === "long") && part.answer && revealed && (
        <p className="mt-2 rounded bg-emerald-50 p-2 pl-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          {part.answer}
        </p>
      )}

      {(part.options || part.answer) && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="mt-2 text-xs font-semibold text-atomic-orange hover:underline"
        >
          {revealed ? "Hide answer" : "Show answer"}
        </button>
      )}
    </div>
  );
}

function PaperView({ paper, onReset }: { paper: BoardPaper; onReset: () => void }) {
  const boardLabel = BOARDS.find((b) => b.value === paper.board)?.label ?? paper.board;

  return (
    <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5 dark:border-slate-700">
        <div>
          <p className="text-sm font-medium text-atomic-orange">
            {boardLabel} - Class {paper.className}
          </p>
          <h1 className="text-2xl font-bold">{paper.subject}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {paper.mode === "pyq" ? "PYQ-style practice" : "Model paper"} - Total marks:{" "}
            {paper.totalMarks} - Time: {paper.timeAllowed}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" />
          New paper
        </button>
      </div>

      <div className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        AI-generated practice questions in the board&apos;s usual style and pattern - not an
        official leaked or copied paper. Use it for practice, not as a guaranteed paper.
      </div>

      <div className="mt-6 space-y-8">
        {paper.questions.map((question) => (
          <div key={question.id}>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              {question.sectionTitle}
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="mb-2 text-sm font-bold">Q{question.questionNumber}.</p>
              <div className="space-y-3">
                {question.subParts.map((part, i) => (
                  <SubPartBlock key={i} part={part} index={i} />
                ))}
              </div>

              {question.orAlternative && question.orAlternative.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                    OR
                  </p>
                  <div className="space-y-3">
                    {question.orAlternative.map((part, i) => (
                      <SubPartBlock key={i} part={part} index={i} />
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

export function BoardExamHub() {
  const [board, setBoard] = useState("");
  const [className, setClassName] = useState<BoardClass>("12th");
  const [subject, setSubject] = useState("");
  const [language, setLanguage] = useState<BoardLanguage>("hindi");
  const [mode, setMode] = useState<BoardMode>("pyq");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<BoardPaper | null>(null);

  const subjects = SUBJECTS_BY_CLASS[className];

  const handleGenerate = async () => {
    if (!board || !subject) {
      setError("Board aur subject select karo pehle.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-chat/board-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board, className, subject, language, mode }),
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
      <main className="min-h-dvh bg-white dark:bg-atomic-navy">
        <PaperView paper={paper} onReset={() => setPaper(null)} />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-white dark:bg-atomic-navy">
      <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-6 w-6 text-atomic-orange" />
            <div>
              <p className="text-sm font-medium text-atomic-orange">Atomic Pathshala</p>
              <h1 className="text-2xl font-bold">Board Exam Hub</h1>
            </div>
          </div>
          <Link
            href="/guru"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Return to chat
          </Link>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Board, class, subject, language aur paper type select karo - AI board ke pattern ke
          hisaab se ek practice paper bana dega.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Board</label>
            <select
              value={board}
              onChange={(event) => setBoard(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select board</option>
              {BOARDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Class</label>
            <div className="flex gap-2">
              {CLASSES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setClassName(item.value);
                    setSubject("");
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    className === item.value
                      ? "border-atomic-orange bg-atomic-orange/10 text-atomic-orange"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Subject</label>
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Select subject</option>
              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Language</label>
            <div className="flex gap-2">
              {LANGUAGES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setLanguage(item.value)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    language === item.value
                      ? "border-atomic-orange bg-atomic-orange/10 text-atomic-orange"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Paper type</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMode(item.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    mode === item.value
                      ? "border-atomic-orange bg-atomic-orange/10"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <p className={`text-sm font-bold ${mode === item.value ? "text-atomic-orange" : ""}`}>
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-atomic-orange py-3 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating paper...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Paper
              </>
            )}
          </button>

          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <FileQuestion className="h-3.5 w-3.5" />
            Papers are freshly AI-generated each time, in the board&apos;s usual pattern.
          </p>
        </div>
      </div>
    </main>
  );
}
