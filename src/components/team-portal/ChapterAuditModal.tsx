"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  X,
  Brain,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  Layers,
  Award,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  getMasterNcertChapters,
  type MasterNcertChapter,
} from "@/lib/academic/master-ncert-catalog";
import type { ChapterAuditSummary, ChapterAuditItemResult } from "@/lib/questions/chapter-audit-engine";
import { QuestionReviewWorkspaceModal } from "./QuestionReviewWorkspaceModal";

interface ChapterAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSubject?: string;
  initialChapter?: string;
  subject?: string;
  chapter?: string;
}

export function ChapterAuditModal({
  isOpen,
  onClose,
  initialSubject = "Physics",
  initialChapter = "",
  subject,
  chapter,
}: ChapterAuditModalProps) {
  const effectiveSubject = subject || initialSubject || "Physics";
  const effectiveChapter = chapter || initialChapter || "";
  const [selectedSubject, setSelectedSubject] = useState(effectiveSubject);
  const [selectedChapter, setSelectedChapter] = useState(effectiveChapter);
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<ChapterAuditSummary | null>(null);
  const [selectedReviewQuestion, setSelectedReviewQuestion] = useState<any | null>(null);
  const [loadingQuestionId, setLoadingQuestionId] = useState<string | null>(null);

  // Available chapters for selected subject
  const availableChapters: MasterNcertChapter[] = getMasterNcertChapters(selectedSubject);

  useEffect(() => {
    if (initialSubject) setSelectedSubject(initialSubject);
    if (initialChapter) setSelectedChapter(initialChapter);
  }, [initialSubject, initialChapter]);

  // Set default chapter when subject changes if current chapter doesn't match
  useEffect(() => {
    if (availableChapters.length > 0 && !availableChapters.some((c) => c.title === selectedChapter)) {
      if (initialChapter && initialSubject === selectedSubject) {
        setSelectedChapter(initialChapter);
      } else {
        setSelectedChapter(availableChapters[0]?.title || "");
      }
    }
  }, [selectedSubject, availableChapters, selectedChapter, initialChapter, initialSubject]);

  const handleRunAudit = async () => {
    if (!selectedSubject || !selectedChapter) {
      toast.error("Please select a subject and chapter to audit.");
      return;
    }

    setLoading(true);
    setAuditData(null);
    try {
      const res = await fetch("/api/team/questions/audit-chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selectedSubject,
          chapter: selectedChapter,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAuditData(json.data);
        toast.success(`Audit completed for ${json.data.totalQuestions} questions!`);
      } else {
        toast.error(json.error || "Failed to audit chapter questions");
      }
    } catch {
      toast.error("Network error executing chapter AI audit");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = async (qSummary: ChapterAuditItemResult) => {
    setLoadingQuestionId(qSummary.questionId);
    try {
      const res = await fetch(`/api/team/questions/${qSummary.questionId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedReviewQuestion(json.data);
      } else {
        toast.error("Failed to load question details for review");
      }
    } catch {
      toast.error("Error connecting to server for question review");
    } finally {
      setLoadingQuestionId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span>100% Chapter AI Question Audit &amp; Intelligence</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Unbounded Command
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comprehensive AI verification of all questions in a chapter for NEET/JEE scientific accuracy, answer keys, solutions, and cognitive depth.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Control Bar: Select Subject & Chapter */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                >
                  <option value="Physics">Physics (P26)</option>
                  <option value="Chemistry">Chemistry (C25)</option>
                  <option value="Biology">Biology (B24)</option>
                  <option value="Mathematics">Mathematics (M23)</option>
                </select>
              </div>

              <div className="flex-1 sm:w-72">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Chapter
                </label>
                <select
                  value={selectedChapter}
                  onChange={(e) => setSelectedChapter(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500 truncate"
                >
                  {availableChapters.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.title} (Class {c.classNumber})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-full sm:w-auto pt-2 sm:pt-0">
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={loading || !selectedChapter}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Auditing 100% of Questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Run Full Chapter AI Audit</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Audit Results Viewport */}
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {loading && !auditData && (
              <div className="p-12 text-center space-y-4">
                <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                    Auditing Chapter Question Repository...
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    AI is scanning 100% of questions in {selectedChapter}, verifying scientific accuracy, checking answer key consistency, and calculating NEET/JEE quality scores.
                  </p>
                </div>
              </div>
            )}

            {!loading && !auditData && (
              <div className="p-12 text-center rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 space-y-3">
                <Brain className="w-12 h-12 text-blue-500/40 mx-auto" />
                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">
                  Ready to audit {selectedChapter || "selected chapter"}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click the <strong>&quot;Run Full Chapter AI Audit&quot;</strong> button above to run deep AI verification across all questions without limits.
                </p>
              </div>
            )}

            {auditData && (
              <div className="space-y-6">
                {/* 1. Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                      Total Questions
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {auditData.totalQuestions}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                      100% Audited
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                      Average Quality
                    </span>
                    <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                      {auditData.averageQualityScore}/100
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 block">
                      NEET / JEE Benchmarked
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                      NEET Relevance
                    </span>
                    <div className="text-2xl font-black text-blue-700 dark:text-blue-300">
                      {auditData.averageNeetRelevance}%
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5 block">
                      NCERT Alignment
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                      Flagged Discrepancies
                    </span>
                    <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
                      {auditData.criticalErrorCount}
                    </div>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 block">
                      Review &amp; Fix Below
                    </span>
                  </div>
                </div>

                {/* 2. Questions Scored & Evaluated List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span>Question-by-Question AI Evaluation ({auditData.items.length})</span>
                    </h4>
                    <span className="text-xs text-slate-500 font-medium">
                      Click &quot;Review &amp; Fix&quot; to inspect AI diagnosis or apply corrections
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                    {auditData.items.map((item: ChapterAuditItemResult) => (
                      <div
                        key={item.questionId}
                        className={`p-3.5 rounded-2xl border transition ${
                          item.hasCriticalIssue
                            ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60"
                            : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {item.canonicalId}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                Score: {item.qualityScore}/100
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                Depth: {item.cognitiveLevel}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {item.difficulty}
                              </span>
                              {item.hasCriticalIssue && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Needs Attention</span>
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                              {item.statementSnippet}
                            </p>

                            {item.criticalIssues.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {item.criticalIssues.map((flag: string, fIdx: number) => (
                                  <span
                                    key={fIdx}
                                    className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-md"
                                  >
                                    ⚠️ {flag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenReview(item)}
                              disabled={loadingQuestionId === item.questionId}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {loadingQuestionId === item.questionId ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3 text-amber-300" />
                              )}
                              <span>Review &amp; Fix</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Workspace Modal */}
      {selectedReviewQuestion && (
        <QuestionReviewWorkspaceModal
          question={selectedReviewQuestion}
          onClose={() => setSelectedReviewQuestion(null)}
          onSuccess={() => {
            setSelectedReviewQuestion(null);
            handleRunAudit();
          }}
        />
      )}
    </>
  );
}
