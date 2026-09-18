"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  Flag,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";

export interface StudentReportItem {
  id: string;
  reasonTags: string;
  comment: string | null;
  screenshotUrl: string | null;
  status: string;
  teacherNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reportedBy: { id: string; name: string | null; email: string };
  claimedBy: { id: string; name: string | null; email: string } | null;
}

export interface ReportedQuestionData {
  questionId: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  subTopic: string | null;
  difficulty: string;
  type: string;
  category: string | null;
  sourceLabel: string;
  solution: string | null;
  status: string;
  overallStatus: "OPEN" | "UNDER_REVIEW" | "CORRECTED" | "REJECTED";
  version: number;
  translations: Array<{
    id: string;
    language: string;
    statement: string;
    options: any;
    correctOptionIds: any;
    solution: string | null;
  }>;
  totalReports: number;
  uniqueStudents: number;
  reasonCounts: Record<string, number>;
  firstReportedAt: string;
  lastReportedAt: string;
  reports: StudentReportItem[];
}

const REASON_LABELS: Record<string, string> = {
  WRONG_ANSWER: "Answer is wrong",
  INCORRECT_QUESTION: "Question is incorrect",
  WRONG_SOLUTION: "Explanation is wrong",
  WRONG_OPTION: "Options are incorrect",
  LANGUAGE_ISSUE: "Translation issue",
  IMAGE_MISSING: "Image missing",
  TYPO: "Typo / Formatting",
  OUT_OF_SYLLABUS: "Out of syllabus",
  DUPLICATE_QUESTION: "Duplicate question",
  OTHER: "Other",
};

export function QuestionReportsWorkspace({
  canResolve,
  currentUserId,
}: {
  canResolve: boolean;
  currentUserId: string;
}) {
  const [questions, setQuestions] = useState<ReportedQuestionData[]>([]);
  const [metrics, setMetrics] = useState({
    totalQuestionsReported: 0,
    unresolvedQuestions: 0,
    totalReportsAllTime: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("most_reported");
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);

  // Edit / Fix Question Modal state
  const [editingQuestion, setEditingQuestion] = useState<ReportedQuestionData | null>(null);
  const [editStatement, setEditStatement] = useState("");
  const [editOptions, setEditOptions] = useState<Array<{ id: string; text: string }>>([]);
  const [editCorrectAnswer, setEditCorrectAnswer] = useState("A");
  const [editSolution, setEditSolution] = useState("");
  const [editTeacherNotes, setEditTeacherNotes] = useState("");
  const [savingFix, setSavingFix] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (sortOrder) params.set("sort", sortOrder);

      const res = await fetch(`/api/team/questions/reports?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setQuestions(json.data.reportedQuestions || []);
        if (json.data.metrics) setMetrics(json.data.metrics);
      } else {
        toast.error(json.error || "Failed to load reports");
      }
    } catch (err) {
      toast.error("Failed to fetch reported questions.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, searchQuery, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenFixModal = (q: ReportedQuestionData) => {
    const translation = q.translations[0];
    setEditingQuestion(q);
    setEditStatement(translation?.statement || "");

    let opts: Array<{ id: string; text: string }> = [];
    if (Array.isArray(translation?.options)) {
      opts = translation.options.map((opt: any, idx: number) => {
        if (typeof opt === "object" && opt !== null) {
          return { id: opt.id || String.fromCharCode(65 + idx), text: opt.text || "" };
        }
        return { id: String.fromCharCode(65 + idx), text: String(opt) };
      });
    } else if (typeof translation?.options === "object" && translation?.options !== null) {
      opts = Object.entries(translation.options).map(([k, v]) => ({ id: k, text: String(v) }));
    }
    if (opts.length === 0) {
      opts = [
        { id: "A", text: "" },
        { id: "B", text: "" },
        { id: "C", text: "" },
        { id: "D", text: "" },
      ];
    }
    setEditOptions(opts);

    const corr = Array.isArray(translation?.correctOptionIds) && translation?.correctOptionIds[0]
      ? translation.correctOptionIds[0]
      : "A";
    setEditCorrectAnswer(corr);
    setEditSolution(translation?.solution || q.solution || "");
    setEditTeacherNotes(`Corrected following review of ${q.totalReports} student report(s).`);
  };

  const handleSaveFix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    setSavingFix(true);
    try {
      const res = await fetch(`/api/team/questions/${editingQuestion.questionId}/resolve-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "FIX_QUESTION",
          teacherNotes: editTeacherNotes.trim(),
          fixData: {
            statement: editStatement.trim(),
            options: editOptions,
            correctAnswer: editCorrectAnswer,
            solution: editSolution.trim(),
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save question fix.");
      }

      toast.success("Question successfully corrected in Question Bank and reports resolved!");
      setEditingQuestion(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to fix question.");
    } finally {
      setSavingFix(false);
    }
  };

  const handleAction = async (questionId: string, action: "UPDATE_STATUS" | "REJECT_ALL", status?: string, notes?: string) => {
    setActionBusyId(questionId);
    try {
      const res = await fetch(`/api/team/questions/${questionId}/resolve-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          status,
          teacherNotes: notes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Action failed.");
      }

      toast.success(json.data?.message || "Report status updated.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update report status.");
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
              ISSUE TRIAGE & REVIEW LAYER
            </span>
            <span className="text-xs text-slate-400">Single Source of Truth: Canonical Question Bank</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1 flex items-center gap-2">
            <Flag className="h-6 w-6 text-amber-500" />
            Reported Questions Review Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review student-flagged AI & Question Bank questions, verify errors, and correct original questions in place with version history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Reported Questions</span>
            <Flag className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">
            {metrics.totalQuestionsReported}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Unique Question Bank records</div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-300 font-medium">Needs Faculty Review</span>
            <AlertCircle className="h-4 w-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1.5">
            {metrics.unresolvedQuestions}
          </div>
          <div className="text-[11px] text-amber-300/80 mt-0.5">Pending verification / resolution</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Student Reports</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">
            {metrics.totalReportsAllTime}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">All-time student feedback submissions</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            {[
              { id: "ALL", label: "All Status" },
              { id: "OPEN", label: "Open (Needs Review)" },
              { id: "UNDER_REVIEW", label: "Under Review" },
              { id: "CORRECTED", label: "Corrected" },
              { id: "REJECTED", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  statusFilter === tab.id
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 outline-none"
          >
            <option value="ALL">All Sources</option>
            <option value="NCERT">NCERT Practice</option>
            <option value="GURU">Atomic Guru</option>
            <option value="AI">AI Generated</option>
            <option value="PYQ">Previous Year (PYQ)</option>
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 outline-none"
          >
            <option value="most_reported">Sort: Most Reported</option>
            <option value="recently_reported">Sort: Recently Reported</option>
            <option value="oldest">Sort: Oldest First</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Question ID, statement, topic..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition focus:border-amber-500"
          />
        </div>
      </div>

      {/* Reported Questions List */}
      {loading ? (
        <div className="p-12 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          <span>Loading reported questions...</span>
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-2">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">No Reported Questions Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {statusFilter !== "ALL" || searchQuery
              ? "No questions match your current filter criteria."
              : "Great job! All student-reported questions have been reviewed and resolved."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const translation = q.translations[0];
            const isCommentsExpanded = expandedCommentsId === q.questionId;
            const isBusy = actionBusyId === q.questionId;

            // Correct option key
            const correctKey = Array.isArray(translation?.correctOptionIds) && translation?.correctOptionIds[0]
              ? String(translation.correctOptionIds[0])
              : "A";

            // Options normalization
            let optsList: Array<{ id: string; text: string }> = [];
            if (Array.isArray(translation?.options)) {
              optsList = translation.options.map((opt: any, idx: number) => {
                if (typeof opt === "object" && opt !== null) {
                  return { id: opt.id || String.fromCharCode(65 + idx), text: opt.text || "" };
                }
                return { id: String.fromCharCode(65 + idx), text: String(opt) };
              });
            } else if (typeof translation?.options === "object" && translation?.options !== null) {
              optsList = Object.entries(translation.options).map(([k, v]) => ({ id: k, text: String(v) }));
            }

            return (
              <div
                key={q.questionId}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg space-y-4 hover:border-slate-700 transition"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-xs font-bold text-blue-400">
                      {q.subject}
                    </span>
                    {q.chapter && (
                      <span className="rounded-lg bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                        {q.chapter}
                      </span>
                    )}
                    {q.topic && (
                      <span className="rounded-lg bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-400">
                        {q.topic}
                      </span>
                    )}
                    <span className="rounded-lg bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[11px] font-bold text-purple-300">
                      {q.sourceLabel}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      ID: {q.questionCode || q.questionId}
                    </span>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        q.overallStatus === "CORRECTED"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : q.overallStatus === "UNDER_REVIEW"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : q.overallStatus === "REJECTED"
                              ? "bg-slate-800 text-slate-400 border border-slate-700"
                              : "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {q.overallStatus === "CORRECTED" && <CheckCircle2 className="h-3 w-3" />}
                      {q.overallStatus === "UNDER_REVIEW" && <Clock className="h-3 w-3" />}
                      {q.overallStatus === "OPEN" && <AlertCircle className="h-3 w-3" />}
                      {q.overallStatus === "CORRECTED"
                        ? "CORRECTED"
                        : q.overallStatus === "UNDER_REVIEW"
                          ? "UNDER REVIEW"
                          : q.overallStatus === "REJECTED"
                            ? "REJECTED"
                            : "OPEN (NEEDS REVIEW)"}
                    </span>
                  </div>
                </div>

                {/* Question Statement */}
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-100 leading-relaxed">
                    <FormulaText text={translation?.statement || "No statement text"} />
                  </div>

                  {/* Options Grid */}
                  {optsList.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {optsList.map((opt) => {
                        const isMarkedCorrect = opt.id.toUpperCase() === correctKey.toUpperCase();
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-start gap-2 rounded-xl p-2.5 border transition ${
                              isMarkedCorrect
                                ? "bg-emerald-950/40 border-emerald-500 text-emerald-200 font-bold"
                                : "bg-slate-950/60 border-slate-800/80 text-slate-300"
                            }`}
                          >
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                                isMarkedCorrect
                                  ? "bg-emerald-500 text-slate-950"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {opt.id}
                            </span>
                            <div className="flex-1">
                              <FormulaText text={opt.text} />
                            </div>
                            {isMarkedCorrect && (
                              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                                Marked Key
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Solution Preview */}
                  {(translation?.solution || q.solution) && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300 space-y-1">
                      <span className="font-bold text-amber-400 text-[11px] block">
                        Current Explanation & Solution:
                      </span>
                      <FormulaText text={translation?.solution || q.solution || ""} />
                    </div>
                  )}
                </div>

                {/* Report Statistics & Reason Breakdown Banner */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                        <Flag className="h-3.5 w-3.5" />
                        {q.totalReports} {q.totalReports === 1 ? "Report" : "Reports"} from {q.uniqueStudents} {q.uniqueStudents === 1 ? "Student" : "Students"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Latest: {new Date(q.lastReportedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Reasons Breakdown Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {Object.entries(q.reasonCounts).map(([reasonKey, count]) => (
                      <span
                        key={reasonKey}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-900 border border-slate-800 px-2 py-0.5 text-[11px] text-slate-300 font-medium"
                      >
                        <span>{REASON_LABELS[reasonKey] || reasonKey}:</span>
                        <span className="font-bold text-amber-400">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Student Comments Drawer (Collapsible) */}
                {isCommentsExpanded && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 animate-in fade-in duration-150">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-amber-400" />
                      Individual Student Submissions ({q.reports.length})
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {q.reports.map((rep) => (
                        <div
                          key={rep.id}
                          className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-300">
                              {rep.reportedBy?.name || rep.reportedBy?.email || "Student"}
                            </span>
                            <span className="text-slate-500">
                              {new Date(rep.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-amber-400/90 font-medium">
                            Reason: {rep.reasonTags.split(",").map((r) => REASON_LABELS[r.trim()] || r).join(", ")}
                          </div>
                          {rep.comment && (
                            <div className="text-slate-200 bg-slate-950 p-2 rounded text-[11px] italic">
                              &ldquo;{rep.comment}&rdquo;
                            </div>
                          )}
                          {rep.teacherNotes && (
                            <div className="text-emerald-400 text-[10px] pt-0.5">
                              Faculty note: {rep.teacherNotes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCommentsId(isCommentsExpanded ? null : q.questionId)
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white transition"
                  >
                    {isCommentsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {isCommentsExpanded ? "Hide Student Reports" : `View Student Reports (${q.reports.length})`}
                  </button>

                  {canResolve && (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Mark Under Review */}
                      {q.overallStatus === "OPEN" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(q.questionId, "UPDATE_STATUS", "UNDER_REVIEW")}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition disabled:opacity-50"
                        >
                          Mark Under Review
                        </button>
                      )}

                      {/* Reject Report (Question is correct as stated) */}
                      {q.overallStatus !== "REJECTED" && q.overallStatus !== "CORRECTED" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(q.questionId, "REJECT_ALL")}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-400 hover:text-white transition disabled:opacity-50"
                        >
                          Reject Reports (Valid Question)
                        </button>
                      )}

                      {/* Fix Question in Place */}
                      <button
                        type="button"
                        onClick={() => handleOpenFixModal(q)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:brightness-110 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 active:scale-95 transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Fix Question & Answer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fix / Edit Question Modal */}
      {editingQuestion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setEditingQuestion(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Fix Question & Answer Key</h3>
                  <p className="text-xs text-slate-400">
                    Updates the canonical Question Bank record in place and records a QuestionVersion snapshot.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFix} className="space-y-4 text-xs">
              {/* Question Statement */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Question Statement
                </label>
                <textarea
                  value={editStatement}
                  onChange={(e) => setEditStatement(e.target.value)}
                  rows={4}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Options & Correct Key Selector */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Options & Correct Answer
                </label>
                <div className="space-y-2">
                  {editOptions.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditCorrectAnswer(opt.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold font-mono transition ${
                          editCorrectAnswer.toUpperCase() === opt.id.toUpperCase()
                            ? "bg-emerald-500 text-slate-950 shadow-sm"
                            : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                        }`}
                        title="Click to set as correct option"
                      >
                        {opt.id} {editCorrectAnswer.toUpperCase() === opt.id.toUpperCase() ? "✓" : ""}
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const newOpts = [...editOptions];
                          if (newOpts[idx]) newOpts[idx].text = e.target.value;
                          setEditOptions(newOpts);
                        }}
                        placeholder={`Option ${opt.id} text...`}
                        className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-600 outline-none focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Solution / Explanation */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Step-by-Step Explanation / Solution
                </label>
                <textarea
                  value={editSolution}
                  onChange={(e) => setEditSolution(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Faculty Audit Note */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Faculty Audit Note
                </label>
                <input
                  type="text"
                  value={editTeacherNotes}
                  onChange={(e) => setEditTeacherNotes(e.target.value)}
                  placeholder="Reason for correction (recorded in audit log)..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-600 outline-none focus:border-amber-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  disabled={savingFix}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFix}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 hover:brightness-110 active:scale-95 disabled:opacity-50 transition"
                >
                  {savingFix ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving In-Place Fix...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Save & Correct Question
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
