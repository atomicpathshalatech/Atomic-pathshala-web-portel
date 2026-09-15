"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

interface PageData {
  id: string;
  pageNumber: number;
  totalPages: number;
  extractedText: string;
  extractedElements: Array<{ type: string; content: string }> | null;
  pageImageUrl?: string | null;
  fileUrl?: string;
}

interface DocumentMeta {
  id: string;
  language: "ENGLISH" | "HINDI";
  chapterTitle: string;
  chapterTitleHindi?: string | null;
  chapterNumber: number;
  subjectName: string;
  subjectNameHindi?: string | null;
  className: string;
}

import { MathText } from "@/components/ai-chat/MathText";
import { Sparkles } from "lucide-react";
import dynamic from "next/dynamic";

const NcertOriginalPageViewer = dynamic(
  () =>
    import("@/components/ncert/NcertOriginalPageViewer").then(
      (m) => m.NcertOriginalPageViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full flex-col items-center justify-center p-12 text-slate-400 space-y-2">
        <span className="material-symbols-outlined animate-spin text-2xl text-emerald-600">
          progress_activity
        </span>
        <span className="text-xs font-semibold text-slate-600">Loading Original NCERT Book Page...</span>
      </div>
    ),
  }
);

interface QuestionOption {
  id: "A" | "B" | "C" | "D";
  text: string;
}

interface QuestionExtrasData {
  assertionText?: string;
  reasonText?: string;
  statements?: string[];
  columnI?: { label: string; text: string }[];
  columnII?: { label: string; text: string }[];
  columnIII?: { label: string; text: string }[];
  sequenceItems?: { label: string; text: string }[];
  tableHeaders?: string[];
  tableRows?: string[][];
  passage?: string;
  imageRequired?: boolean;
  imageDescription?: string;
}

interface ClientQuestion extends QuestionExtrasData {
  id: string;
  questionType: string;
  question: string;
  options: QuestionOption[];
  sourceImageReference?: string | null;
}

interface QuestionReview extends QuestionExtrasData {
  id: string;
  questionType?: string;
  question: string;
  options: QuestionOption[];
  selectedOption: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  sourceTextReference: string;
  sourceImageReference?: string | null;

  // 4-Part Structured Solution
  explainQuestion?: string;
  concept?: string;
  solution?: string;
  finalAnswer?: string;
}

interface EvaluationResult {
  score: number;
  accuracy: number;
  reviews: QuestionReview[];
}

function PracticeQuestionExtras({ item }: { item: QuestionExtrasData & { sourceImageReference?: string | null } }) {
  const hasPassage = Boolean(item.passage?.trim());
  const hasAssertionReason = Boolean(item.assertionText?.trim() && item.reasonText?.trim());
  const hasStatements = Boolean(item.statements?.length);
  const hasColumns = Boolean(item.columnI?.length && item.columnII?.length);
  const hasImage = Boolean(item.sourceImageReference || item.imageRequired);

  return (
    <div className="space-y-2.5">
      {hasPassage && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs italic text-slate-700">
          <MathText text={item.passage ?? ""} />
        </div>
      )}

      {hasAssertionReason && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs space-y-1.5 text-slate-800">
          <div>
            <strong className="text-blue-900 font-bold">Assertion (A): </strong>
            <MathText text={item.assertionText ?? ""} />
          </div>
          <div>
            <strong className="text-blue-900 font-bold">Reason (R): </strong>
            <MathText text={item.reasonText ?? ""} />
          </div>
        </div>
      )}

      {hasStatements && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1.5 text-slate-800">
          {item.statements!.map((stmt, idx) => (
            <div key={idx} className="leading-relaxed">
              <MathText text={stmt} />
            </div>
          ))}
        </div>
      )}

      {hasColumns && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="p-2 text-left font-semibold">Column-I</th>
                <th className="p-2 text-left font-semibold">Column-II</th>
                {item.columnIII?.length ? <th className="p-2 text-left font-semibold">Column-III</th> : null}
              </tr>
            </thead>
            <tbody>
              {item.columnI!.map((col, idx) => {
                const right = item.columnII?.[idx];
                const third = item.columnIII?.[idx];
                return (
                  <tr key={col.label} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="p-2 align-top">
                      <strong>({col.label})</strong> <MathText text={col.text} />
                    </td>
                    <td className="p-2 align-top">
                      {right ? (
                        <>
                          <strong>({right.label})</strong> <MathText text={right.text} />
                        </>
                      ) : null}
                    </td>
                    {item.columnIII?.length ? (
                      <td className="p-2 align-top">
                        {third ? (
                          <>
                            <strong>({third.label})</strong> <MathText text={third.text} />
                          </>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasImage && item.sourceImageReference && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-2.5 text-center">
          <img
            src={item.sourceImageReference}
            alt="NCERT Figure"
            className="mx-auto max-h-64 rounded-lg object-contain border border-slate-100 shadow-sm"
          />
          {item.imageDescription && (
            <p className="mt-1.5 text-[11px] font-medium text-slate-600 italic">
              {item.imageDescription}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NcertChapterReaderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const documentId = params.documentId as string;
  const initialPage = parseInt(searchParams.get("page") || "1", 10) || 1;

  const [currentPageNum, setCurrentPageNum] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [documentMeta, setDocumentMeta] = useState<DocumentMeta | null>(null);

  // States: "READING" | "PRACTICE" | "RESULT"
  const [viewState, setViewState] = useState<"READING" | "PRACTICE" | "RESULT">("READING");

  // Questions & Answers
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [lastResult, setLastResult] = useState<EvaluationResult | null>(null);

  // Progress metadata
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [remainingReattempts, setRemainingReattempts] = useState<number>(3);
  const [canReattempt, setCanReattempt] = useState<boolean>(true);

  // Loaders
  const [loadingPage, setLoadingPage] = useState<boolean>(true);
  const [generatingQuestions, setGeneratingQuestions] = useState<boolean>(false);
  const [submittingAnswers, setSubmittingAnswers] = useState<boolean>(false);
  const [reattempting, setReattempting] = useState<boolean>(false);
  const [skippingPage, setSkippingPage] = useState<boolean>(false);

  // Reader Controls
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Fetch page details (non-blocking for PDF viewer)
  useEffect(() => {
    let isCurrent = true;
    async function loadPage(pageNo: number) {
      setLoadingPage(true);
      setSelectedAnswers({});
      try {
        const res = await fetch(`/api/ncert/chapter/${documentId}/page/${pageNo}`);
        if (!res.ok) {
          throw new Error("Failed to load page");
        }
        const data = await res.json();
        if (!isCurrent) return;

        setPageData(data.page);
        if (data.page?.totalPages) {
          setTotalPages(data.page.totalPages);
        }
        setDocumentMeta(data.document);
        setAttemptCount(data.progress?.attemptCount || 1);
        setRemainingReattempts(data.progress?.remainingReattempts ?? 3);
        setCanReattempt(data.progress?.canReattempt ?? true);

        if (data.lastResult) {
          setLastResult(data.lastResult);
          setViewState("RESULT");
        } else if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setViewState("PRACTICE");
        } else {
          setLastResult(null);
          setQuestions([]);
          setViewState("READING");
        }
      } catch (err: any) {
        if (isCurrent) {
          toast.error(err.message || "Error loading page");
        }
      } finally {
        if (isCurrent) {
          setLoadingPage(false);
        }
      }
    }

    loadPage(currentPageNum);

    return () => {
      isCurrent = false;
    };
  }, [documentId, currentPageNum]);

  // Handle NEXT / Start Practice
  const handleStartPractice = async () => {
    setGeneratingQuestions(true);
    setMobileDrawerOpen(true);
    try {
      const res = await fetch(`/api/ncert/chapter/${documentId}/page/${currentPageNum}/start`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to prepare questions");
      }

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setViewState("PRACTICE");
        toast.success(`Prepared ${data.questions.length} NCERT questions from Page ${currentPageNum}`);
      } else {
        toast.info(data.message || "This page has insufficient text for questions. You can proceed to next page.");
      }
    } catch (err: any) {
      toast.error(err.message || "Generation error");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  // Handle SKIP PAGE (Zero AI Cost)
  const handleSkipPage = async () => {
    setSkippingPage(true);
    try {
      const res = await fetch(`/api/ncert/chapter/${documentId}/page/${currentPageNum}/skip`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to skip page");
      }

      toast.info(`Page ${currentPageNum} skipped.`);
      if (data.nextPageIndex <= data.totalPages) {
        setCurrentPageNum(data.nextPageIndex);
        setMobileDrawerOpen(false);
      } else {
        toast.success("You have reached the end of this chapter!");
      }
    } catch (err: any) {
      toast.error(err.message || "Could not skip page");
    } finally {
      setSkippingPage(false);
    }
  };

  // Handle Option Select
  const handleSelectOption = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  // Handle Submit Page Attempt
  const handleSubmitAttempt = async () => {
    if (questions.length === 0) return;

    const answersPayload = questions.map((q) => ({
      questionId: q.id,
      selectedOption: selectedAnswers[q.id] || "",
    }));

    setSubmittingAnswers(true);
    try {
      const res = await fetch(`/api/ncert/chapter/${documentId}/page/${currentPageNum}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersPayload }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      setLastResult(data.result);
      setAttemptCount(data.result.attemptNumber);
      setRemainingReattempts(data.result.remainingReattempts);
      setCanReattempt(data.result.canReattempt);
      setViewState("RESULT");
      toast.success(`Page ${currentPageNum} attempt submitted! Score: ${data.result.score}`);
    } catch (err: any) {
      toast.error(err.message || "Submission error");
    } finally {
      setSubmittingAnswers(false);
    }
  };

  // Handle REATTEMPT NEW QUESTION (Strict 3-reattempt limit)
  const handleReattempt = async () => {
    setReattempting(true);
    try {
      const res = await fetch(`/api/ncert/chapter/${documentId}/page/${currentPageNum}/reattempt`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start reattempt");
      }

      setQuestions(data.questions);
      setAttemptCount(data.attemptNumber);
      setRemainingReattempts(data.remainingReattempts);
      setSelectedAnswers({});
      setLastResult(null);
      setViewState("PRACTICE");
      setMobileDrawerOpen(true);
      toast.success(`Reattempt #${data.attemptNumber - 1} loaded with new questions!`);
    } catch (err: any) {
      toast.error(err.message || "Reattempt limit reached or error");
    } finally {
      setReattempting(false);
    }
  };

  // Next Page Action
  const handleGoToNextPage = () => {
    if (!pageData) return;
    if (currentPageNum < pageData.totalPages) {
      setCurrentPageNum((p) => p + 1);
      setMobileDrawerOpen(false);
    } else {
      toast.success("Congratulations! You completed all pages in this NCERT chapter!");
      router.push("/practice/ncert");
    }
  };

  // Prev Page Action
  const handleGoToPrevPage = () => {
    if (currentPageNum > 1) {
      setCurrentPageNum((p) => p - 1);
      setMobileDrawerOpen(false);
    }
  };

  const isHindi = documentMeta?.language === "HINDI";
  const progressPercent =
    pageData?.totalPages && pageData.totalPages > 0
      ? Math.round((currentPageNum / pageData.totalPages) * 100)
      : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] bg-slate-50 overflow-hidden">
      {/* 1. TOP MASTER HEADER */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-5">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            href="/practice/ncert"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Back to NCERT chapters"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-slate-900 sm:text-sm">
                {documentMeta
                  ? `${documentMeta.subjectName} · Ch ${documentMeta.chapterNumber}: ${
                      isHindi && documentMeta.chapterTitleHindi
                        ? documentMeta.chapterTitleHindi
                        : documentMeta.chapterTitle
                    }`
                  : "NCERT Chapter Reader"}
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                  isHindi
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}
              >
                {isHindi ? "हिंदी" : "English"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              {documentMeta?.className} · Official NCERT Textbook Source
            </p>
          </div>
        </div>

        {/* Page progress and pagination controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Page {currentPageNum} of {pageData?.totalPages || 1}
            </span>
            <div className="hidden md:block w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <button
              type="button"
              disabled={currentPageNum <= 1}
              onClick={handleGoToPrevPage}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Previous page"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <button
              type="button"
              disabled={currentPageNum >= totalPages}
              onClick={handleGoToNextPage}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Next page"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN SPLIT WORKSPACE (50% NCERT Reader, 50% Practice Area on Desktop) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ================= LEFT PANEL: NCERT READER ================= */}
        <div className="flex-1 lg:w-1/2 flex flex-col border-r border-slate-200 bg-slate-900 overflow-hidden">
          <NcertOriginalPageViewer
            documentId={documentId}
            fileUrl={pageData?.fileUrl}
            pageNumber={currentPageNum}
            totalPages={totalPages}
            onPageChange={(newPage) => {
              if (newPage >= 1 && newPage <= totalPages) {
                setCurrentPageNum(newPage);
                setMobileDrawerOpen(false);
              }
            }}
          />

          {/* Mobile bottom sticky action bar (shows only on mobile screens < lg) */}
          <div className="lg:hidden shrink-0 border-t border-slate-200 bg-white p-3 flex gap-2">
            <button
              type="button"
              disabled={skippingPage || generatingQuestions}
              onClick={handleSkipPage}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Skip Page
            </button>
            <button
              type="button"
              disabled={generatingQuestions}
              onClick={() => {
                if (viewState === "READING") {
                  handleStartPractice();
                } else {
                  setMobileDrawerOpen(true);
                }
              }}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 flex items-center justify-center gap-1.5"
            >
              <span>{viewState === "READING" ? "Start Practice (Next)" : "View Questions"}</span>
              <span className="material-symbols-outlined text-base">arrow_upward</span>
            </button>
          </div>
        </div>

        {/* ================= RIGHT PANEL: PRACTICE WORKSPACE (Desktop & Mobile Drawer) ================= */}
        <div
          className={`lg:w-1/2 flex flex-col bg-slate-50/50 overflow-hidden ${
            mobileDrawerOpen
              ? "fixed inset-0 z-50 bg-white flex"
              : "hidden lg:flex"
          }`}
        >
          {/* Header of Practice Panel */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <span className="material-symbols-outlined text-base text-emerald-600">quiz</span>
              <span>
                {viewState === "READING"
                  ? `Page ${currentPageNum} Practice Area`
                  : viewState === "PRACTICE"
                  ? `Page ${currentPageNum} Questions (${questions.length} Items)`
                  : `Page ${currentPageNum} Attempt Result`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {attemptCount > 1 && (
                <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  Attempt #{attemptCount}
                </span>
              )}

              {/* Close button on mobile drawer */}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="lg:hidden flex h-7 w-7 items-center justify-center rounded hover:bg-slate-100 text-slate-600"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          </div>

          {/* Panel Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* ---------------- STATE 1: READING MODE ---------------- */}
            {viewState === "READING" && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-inner">
                  <span className="material-symbols-outlined text-3xl">auto_stories</span>
                </div>

                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-lg font-bold text-slate-900">
                    Read NCERT Page {currentPageNum}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    First read the textbook page on the left carefully. When you are ready, click{" "}
                    <strong>"Next / Start Practice"</strong> to solve page-locked questions.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm pt-2">
                  <button
                    type="button"
                    disabled={skippingPage || generatingQuestions}
                    onClick={handleSkipPage}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-3 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                  >
                    {skippingPage ? "Skipping..." : "Skip Page"}
                  </button>

                  <button
                    type="button"
                    disabled={generatingQuestions}
                    onClick={handleStartPractice}
                    className="flex-1 rounded-xl bg-emerald-600 py-3 px-4 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    {generatingQuestions ? (
                      <>
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Preparing Questions...</span>
                      </>
                    ) : (
                      <>
                        <span>Start Practice (Next)</span>
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ---------------- STATE 2: PRACTICE / SOLVING MODE ---------------- */}
            {viewState === "PRACTICE" && (
              <div className="space-y-5 pb-6">
                <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
                  <span className="text-xs font-semibold text-slate-700">
                    Answer all questions based strictly on Page {currentPageNum}:
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {Object.keys(selectedAnswers).length} / {questions.length} Answered
                  </span>
                </div>

                {/* Questions List */}
                <div className="space-y-4">
                  {questions.map((q, qIndex) => {
                    const selected = selectedAnswers[q.id];
                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 mt-0.5">
                            {qIndex + 1}
                          </span>
                          <div className="space-y-1 flex-1">
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {q.questionType.replace(/_/g, " ")}
                            </span>
                            <div className="text-sm font-medium text-slate-900 leading-snug">
                              <MathText text={q.question} />
                            </div>
                          </div>
                        </div>

                        {/* Atomic Guru Question Extras (Assertion/Reason, Statements, Columns, Diagrams) */}
                        <PracticeQuestionExtras item={q} />

                        {/* Options */}
                        <div className="space-y-2 pt-1">
                          {q.options.map((opt) => {
                            const isChosen = selected === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleSelectOption(q.id, opt.id)}
                                className={`w-full flex items-center gap-3 rounded-lg border p-2.5 text-left text-xs transition-all ${
                                  isChosen
                                    ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 font-semibold ring-1 ring-emerald-600"
                                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                    isChosen
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {opt.id}
                                </span>
                                <span className="flex-1">
                                  <MathText text={opt.text} />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Submit Action */}
                <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 p-3 rounded-xl shadow-lg flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    Page {currentPageNum} Practice
                  </div>
                  <button
                    type="button"
                    disabled={submittingAnswers}
                    onClick={handleSubmitAttempt}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {submittingAnswers ? (
                      <>
                        <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Evaluating...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Attempt</span>
                        <span className="material-symbols-outlined text-base">check</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ---------------- STATE 3: RESULT / SCORECARD MODE ---------------- */}
            {viewState === "RESULT" && lastResult && (
              <div className="space-y-5 pb-6">
                {/* Scorecard Hero */}
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      <span className="material-symbols-outlined text-sm">military_tech</span>
                      Attempt #{attemptCount} Completed
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Page {currentPageNum}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white border border-emerald-100 p-2.5">
                      <p className="text-[11px] font-semibold text-slate-500">Score</p>
                      <p className="text-xl font-extrabold text-emerald-700">+{lastResult.score}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-emerald-100 p-2.5">
                      <p className="text-[11px] font-semibold text-slate-500">Accuracy</p>
                      <p className="text-xl font-extrabold text-indigo-700">{lastResult.accuracy}%</p>
                    </div>
                    <div className="rounded-xl bg-white border border-emerald-100 p-2.5">
                      <p className="text-[11px] font-semibold text-slate-500">Correct</p>
                      <p className="text-xl font-extrabold text-emerald-600">
                        {lastResult.reviews.filter((r) => r.isCorrect).length} / {lastResult.reviews.length}
                      </p>
                    </div>
                  </div>

                  {/* Actions after attempt: REATTEMPT vs NEXT PAGE */}
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                    {canReattempt ? (
                      <button
                        type="button"
                        disabled={reattempting}
                        onClick={handleReattempt}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white py-2.5 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50/50 shadow-sm transition-all"
                      >
                        {reattempting ? (
                          <>
                            <span className="h-3 w-3 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin" />
                            <span>Generating New Questions...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base">restart_alt</span>
                            <span>Reattempt New Question ({remainingReattempts} left)</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex-1 rounded-xl bg-slate-100 p-2 text-center text-[11px] text-slate-500">
                        Maximum 3 reattempts reached for this page.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleGoToNextPage}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all"
                    >
                      <span>Next Page</span>
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>
                  </div>
                </div>

                {/* Detailed Review with NCERT Source References */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    NCERT Verified Solutions &amp; Page References
                  </h4>

                  {lastResult.reviews.map((r, rIdx) => (
                    <div
                      key={r.id}
                      className={`rounded-xl border p-4 shadow-sm space-y-3.5 ${
                        r.isCorrect
                          ? "border-emerald-200 bg-emerald-50/20"
                          : "border-rose-200 bg-rose-50/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <span className="text-xs font-bold text-slate-800">
                            Q{rIdx + 1}.
                          </span>
                          <div className="text-xs font-bold text-slate-800 flex-1">
                            <MathText text={r.question} />
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            r.isCorrect
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {r.isCorrect ? "Correct (+4)" : "Incorrect (-1)"}
                        </span>
                      </div>

                      {/* Atomic Guru Question Extras (Assertion/Reason, Statements, Columns, Diagrams) */}
                      <PracticeQuestionExtras item={r} />

                      {/* Options review */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                        {r.options.map((opt) => {
                          const isSelected = r.selectedOption === opt.id;
                          const isRight = r.correctAnswer === opt.id;
                          return (
                            <div
                              key={opt.id}
                              className={`flex items-center gap-2 rounded-lg border p-2 ${
                                isRight
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold"
                                  : isSelected
                                  ? "border-rose-400 bg-rose-50 text-rose-950"
                                  : "border-slate-100 bg-white text-slate-600"
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                  isRight
                                    ? "bg-emerald-600 text-white"
                                    : isSelected
                                    ? "bg-rose-600 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {opt.id}
                              </span>
                              <div className="flex-1 leading-snug">
                                <MathText text={opt.text} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* NCERT Exact Quote / Proof */}
                      {r.sourceTextReference && (
                        <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 p-2.5 text-xs text-amber-900">
                          <p className="font-bold flex items-center gap-1 text-[11px] text-amber-950 mb-0.5">
                            <span className="material-symbols-outlined text-sm">verified</span>
                            <span>NCERT Page {currentPageNum} Quote (Proof):</span>
                          </p>
                          <p className="italic">“{r.sourceTextReference}”</p>
                        </div>
                      )}

                      {/* Atomic Guru 4-Part Structured Solution Box */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5 text-xs">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5 font-bold uppercase tracking-wider text-slate-800">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          <span>Detailed NCERT Solution &amp; Concept</span>
                        </div>

                        {/* 1. Explain Question */}
                        {r.explainQuestion && (
                          <div className="rounded-lg border border-blue-100 bg-white p-2.5">
                            <p className="mb-0.5 font-bold text-blue-600">
                              🔍 EXPLAIN QUESTION:
                            </p>
                            <div className="text-slate-700 leading-relaxed">
                              <MathText text={r.explainQuestion} />
                            </div>
                          </div>
                        )}

                        {/* 2. Concept */}
                        {r.concept && (
                          <div className="rounded-lg border border-blue-100 bg-white p-2.5">
                            <p className="mb-0.5 font-bold text-blue-600">
                              💡 CONCEPT:
                            </p>
                            <div className="text-slate-700 leading-relaxed">
                              <MathText text={r.concept} />
                            </div>
                          </div>
                        )}

                        {/* 3. Step-by-Step Solution */}
                        <div className="rounded-lg border border-amber-100 bg-white p-2.5">
                          <p className="mb-0.5 font-bold text-amber-600">
                            📝 STEP-BY-STEP SOLUTION:
                          </p>
                          <div className="whitespace-pre-line text-slate-700 leading-relaxed">
                            <MathText text={r.solution || r.explanation || "Refer to NCERT textbook principles."} />
                          </div>
                        </div>

                        {/* 4. Final Answer */}
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5">
                          <p className="mb-0.5 font-bold text-emerald-800">
                            🎯 FINAL ANSWER:
                          </p>
                          <div className="font-semibold text-emerald-950">
                            <MathText text={r.finalAnswer || `Option (${r.correctAnswer}) is the correct answer.`} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
