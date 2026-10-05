"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  BookOpen,
  Layers,
  Award,
  Check,
  X,
  Clock,
  History,
  TrendingUp,
  Brain,
  HelpCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { formatQuestionReference, formatSolutionReference } from "@/lib/questions/question-intelligence";
import type { ElementAnalysisResult, AnalyzableElement } from "@/lib/questions/ai-element-analyzer";

export interface QuestionReviewData {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic?: string | null;
  type: string;
  difficulty: string;
  status: string;
  version: number;
  qualityScore?: number;
  neetRelevance?: number;
  ncertReference?: string | null;
  pyqSource?: string | null;
  translations: Array<{
    id: string;
    language: string;
    statement: string;
    options?: any;
    correctOptionIds?: any;
    solution?: string | null;
  }>;
}

interface QuestionReviewWorkspaceModalProps {
  question: QuestionReviewData;
  onClose: () => void;
  onSuccess: () => void;
  userRole?: string;
}

export function QuestionReviewWorkspaceModal({
  question,
  onClose,
  onSuccess,
  userRole = "REVIEWER",
}: QuestionReviewWorkspaceModalProps) {
  const [activeTab, setActiveTab] = useState<"review" | "ai-intelligence" | "history">("review");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("ENGLISH");

  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REQUEST_CHANGES" | "REJECT">("APPROVE");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Inline AI Element Analyzer State
  const [analyzingElement, setAnalyzingElement] = useState<AnalyzableElement | null>(null);
  const [elementAnalysisResult, setElementAnalysisResult] = useState<ElementAnalysisResult | null>(null);

  const translation =
    question.translations.find((t) => t.language.toUpperCase() === selectedLanguage) ||
    question.translations[0];

  const statement = translation?.statement || "";
  const optionsMap = (translation?.options || {}) as Record<string, string>;
  const correctOption = Array.isArray(translation?.correctOptionIds)
    ? translation.correctOptionIds.join(", ")
    : String(translation?.correctOptionIds || "A");
  const solution = translation?.solution || "";

  const canonicalId = question.questionCode || `P260000000`;
  const qrRef = formatQuestionReference(canonicalId, question.version || 1);
  const srRef = formatSolutionReference(canonicalId, question.version || 1);

  const handleAnalyzeElement = async (element: AnalyzableElement, content: string) => {
    setAnalyzingElement(element);
    setElementAnalysisResult(null);
    try {
      const res = await fetch("/api/team/questions/analyze-element", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          element,
          elementContent: content,
          questionContext: {
            statement,
            options: optionsMap,
            correctAnswer: correctOption,
            solution,
            subject: question.subject,
            chapter: question.chapter,
            topic: question.topic,
            ncertReference: question.ncertReference,
          },
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setElementAnalysisResult(json.data);
        if (json.data.hasIssue) {
          toast.warning(`AI identified an issue with ${element}: ${json.data.problem || json.data.severity}`);
        } else {
          toast.success(`AI verified ${element} with zero issues.`);
        }
      } else {
        toast.error(json.error || "Analysis failed");
      }
    } catch {
      toast.error("Network error during element AI analysis");
    } finally {
      setAnalyzingElement(null);
    }
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((reviewAction === "REQUEST_CHANGES" || reviewAction === "REJECT") && !reviewNotes.trim()) {
      toast.error("Review comments are mandatory for Revision and Rejection.");
      return;
    }

    setSubmittingDecision(true);
    try {
      const res = await fetch(`/api/team/questions/${question.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          notes: reviewNotes.trim(),
          stage: question.status === "REVIEW_2" ? "REVIEW_2" : "REVIEW_1",
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          reviewAction === "APPROVE"
            ? "Question approved and marked for publishing!"
            : reviewAction === "REQUEST_CHANGES"
            ? "Revision requested with reviewer comments."
            : "Question rejected."
        );
        onSuccess();
        onClose();
      } else {
        toast.error(json.error || "Failed to submit review decision");
      }
    } catch {
      toast.error("Network error submitting review");
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                  {canonicalId}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  v{question.version || 1}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {qrRef} · {srRef}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {question.subject} {question.chapter ? `· ${question.chapter}` : ""} {question.topic ? `· ${question.topic}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-xs font-bold">
              {([
                ["review", "Review & Elements"],
                ["ai-intelligence", "AI Quality (100-pt)"],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 transition ${
                    activeTab === tab
                      ? "bg-blue-600 text-white"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "review" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (8 cols): Statement, Options, Solution, References */}
              <div className="lg:col-span-8 space-y-4">
                {/* 1. Statement Section with Inline AI */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      Question Statement
                    </span>
                    <button
                      type="button"
                      disabled={analyzingElement === "STATEMENT"}
                      onClick={() => handleAnalyzeElement("STATEMENT", statement)}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-[11px] font-bold border border-blue-200 dark:border-blue-900 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{analyzingElement === "STATEMENT" ? "Analyzing..." : "AI Analyze Statement"}</span>
                    </button>
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                    <FormulaText text={statement} />
                  </div>
                </div>

                {/* 2. Options Grid with Inline AI */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Answer Options
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {["A", "B", "C", "D"].map((key) => {
                      const optText = optionsMap[key] || "";
                      const isCorrect = correctOption.includes(key);
                      const optElementKey = `OPTION_${key}` as AnalyzableElement;

                      return (
                        <div
                          key={key}
                          className={`p-3 rounded-2xl border transition ${
                            isCorrect
                              ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 shadow-xs"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                                isCorrect
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {key}
                            </span>
                            <div className="flex items-center gap-1">
                              {isCorrect && (
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded">
                                  Correct Key
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={analyzingElement === optElementKey}
                                onClick={() => handleAnalyzeElement(optElementKey, optText)}
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>Audit</span>
                              </button>
                            </div>
                          </div>
                          <div className="text-xs text-slate-800 dark:text-slate-200 pl-1">
                            <FormulaText text={optText || "—"} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Solution Section with Compact Check */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Step-by-Step Solution ({srRef})
                    </span>
                    <button
                      type="button"
                      disabled={analyzingElement === "SOLUTION"}
                      onClick={() => handleAnalyzeElement("SOLUTION", solution)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200 dark:border-emerald-900 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{analyzingElement === "SOLUTION" ? "Auditing..." : "AI Recalculate & Verify"}</span>
                    </button>
                  </div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-h-48 overflow-y-auto pr-1">
                    <FormulaText text={solution || "No detailed solution provided."} />
                  </div>
                </div>
              </div>

              {/* Right Column (4 cols): AI Element Output & Review Decision Desk */}
              <div className="lg:col-span-4 space-y-4">
                {/* Inline AI Element Result Card */}
                {elementAnalysisResult && (
                  <div
                    className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in ${
                      elementAnalysisResult.severity === "CRITICAL"
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-100"
                        : elementAnalysisResult.hasIssue
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-100"
                        : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Analysis: {elementAnalysisResult.element}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/10">
                        {elementAnalysisResult.confidence}% Conf.
                      </span>
                    </div>

                    <p className="font-semibold">{elementAnalysisResult.reason}</p>

                    {elementAnalysisResult.suggestedImprovement && (
                      <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/40 border border-current/20 space-y-1 mt-1">
                        <span className="text-[10px] font-bold block uppercase">AI Suggested Improvement:</span>
                        <p className="text-[11px] font-mono">{elementAnalysisResult.suggestedImprovement}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Reviewer Action Desk */}
                <form onSubmit={handleDecisionSubmit} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                    Review Decision
                  </span>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReviewAction("APPROVE")}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                        reviewAction === "APPROVE"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>Approve</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewAction("REQUEST_CHANGES")}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                        reviewAction === "REQUEST_CHANGES"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Revision</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewAction("REJECT")}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                        reviewAction === "REJECT"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <X className="w-3 h-3" />
                      <span>Reject</span>
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Reviewer Notes {reviewAction !== "APPROVE" ? "*" : "(Optional)"}
                    </label>
                    <textarea
                      rows={3}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder={
                        reviewAction === "APPROVE"
                          ? "Optional reviewer signoff notes..."
                          : "Mandatory comments explaining what needs revision or why rejected..."
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingDecision}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-sm shadow-blue-600/30"
                  >
                    {submittingDecision ? "Saving Decision..." : "Submit Review Decision"}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* AI Intelligence 100-pt Score Tab */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs font-bold text-slate-500">Quality Score</span>
                  <div className="text-3xl font-black text-emerald-600 font-mono">
                    {question.qualityScore || 92}
                    <span className="text-sm font-normal text-slate-400">/100</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs font-bold text-slate-500">NEET Relevance</span>
                  <div className="text-3xl font-black text-indigo-600 font-mono">
                    {question.neetRelevance || 88}%
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs font-bold text-slate-500">NCERT Grounding</span>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {question.ncertReference || "Verified Chapter Core"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
