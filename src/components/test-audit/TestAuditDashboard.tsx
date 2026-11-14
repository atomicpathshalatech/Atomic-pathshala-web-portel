"use client";

import React, { useState, useMemo } from "react";
import {
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Printer,
  ChevronRight,
  Filter,
  Sparkles,
  Award,
} from "lucide-react";
import { AuditMetricsGrid } from "./AuditMetricsGrid";
import { QuestionAuditModal } from "./QuestionAuditModal";

interface TestAuditDashboardProps {
  testId: string;
  initialData: {
    audited: boolean;
    test: any;
    report: any;
  };
}

export function TestAuditDashboard({ testId, initialData }: TestAuditDashboardProps) {
  const [data, setData] = useState(initialData);
  const [running, setRunning] = useState(false);
  const [selectedQuestionAudit, setSelectedQuestionAudit] = useState<any | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [metricFilter, setMetricFilter] = useState<string | null>(null);

  const report = data.report;
  const metrics = report?.metrics;
  const questionAudits: any[] = report?.questionAudits || [];

  async function handleRunAudit() {
    try {
      setRunning(true);
      const res = await fetch(`/api/team/tests/${testId}/audit`, {
        method: "POST",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error?.message || "Audit failed to run.");

      // Refresh data
      const refreshRes = await fetch(`/api/team/tests/${testId}/audit`);
      const refreshedJson = await refreshRes.json();
      if (refreshedJson.data) {
        setData(refreshedJson.data);
      }
    } catch (err: any) {
      alert(`Error running audit: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  // Handle metric click filter
  function handleSelectMetric(key: string | null) {
    setMetricFilter(key);
    if (!key || key === "ALL") {
      setSeverityFilter("ALL");
      return;
    }
    if (key === "CRITICAL") setSeverityFilter("CRITICAL");
    else if (key === "DIFF_EASY") setSeverityFilter("ALL");
    else if (key === "DIFF_MODERATE") setSeverityFilter("ALL");
    else if (key === "DIFF_DIFFICULT") setSeverityFilter("ALL");
    else if (key === "DIFF_VERY_DIFFICULT") setSeverityFilter("ALL");
    else setSeverityFilter("ALL");
  }

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questionAudits.filter((qa) => {
      // Metric filter logic
      if (metricFilter === "EXACT_ID" && qa.duplicateType !== "EXACT_ID") return false;
      if (metricFilter === "EXACT_CONTENT" && qa.duplicateType !== "EXACT_CONTENT") return false;
      if (metricFilter === "NEAR_DUPLICATE" && qa.duplicateType !== "NEAR_DUPLICATE") return false;
      if (metricFilter === "CONCEPT_REPETITION" && qa.duplicateType !== "CONCEPTUAL") return false;
      if (metricFilter === "ANSWER_CONFLICT" && qa.answerValid) return false;
      if (metricFilter === "MISSING_DIAGRAM" && qa.diagramStatus !== "MISSING") return false;
      if (metricFilter === "DIFF_EASY" && qa.difficulty !== "EASY") return false;
      if (metricFilter === "DIFF_MODERATE" && qa.difficulty !== "MODERATE") return false;
      if (metricFilter === "DIFF_DIFFICULT" && qa.difficulty !== "DIFFICULT") return false;
      if (metricFilter === "DIFF_VERY_DIFFICULT" && qa.difficulty !== "VERY_DIFFICULT") return false;

      // Subject Filter
      if (subjectFilter !== "ALL") {
        const s = (qa.subject || "").toLowerCase();
        if (subjectFilter === "PHYSICS" && !s.includes("phys")) return false;
        if (subjectFilter === "CHEMISTRY" && !s.includes("chem")) return false;
        if (subjectFilter === "BIOLOGY" && !s.includes("bio") && !s.includes("bot") && !s.includes("zoo")) return false;
      }

      // Severity Filter
      if (severityFilter !== "ALL" && qa.severity !== severityFilter) return false;

      // Status Filter
      if (statusFilter !== "ALL" && qa.status !== statusFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const code = (qa.question?.questionCode || qa.questionId || "").toLowerCase();
        const chapter = (qa.chapter || "").toLowerCase();
        const statement = (qa.question?.translations?.[0]?.statement || "").toLowerCase();
        const number = `q${qa.questionNumber}`;
        if (!code.includes(query) && !chapter.includes(query) && !statement.includes(query) && !number.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [questionAudits, metricFilter, subjectFilter, severityFilter, statusFilter, searchQuery]);

  const score = report?.overallScore ?? 0;
  const scoreColor =
    score >= 85
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : score >= 65
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            {/* Score Ring / Gauge */}
            <div className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 ${scoreColor} shadow-inner shrink-0`}>
              <span className="text-3xl font-extrabold tracking-tight">{score}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                Quality Score
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {data.test?.name || data.test?.title || "Test Quality Audit"}
                </h1>
                {report?.status === "OUTDATED" ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Audit Outdated (Questions Modified)
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Audit Active • v{report?.reportVersion || 1}
                  </span>
                )}
                {report?.neetAlignment && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    {report.neetAlignment.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1">
                Engine: {report?.engineVersion || "1.0.0"} • Last Audited:{" "}
                {report ? new Date(report.createdAt).toLocaleString() : "Never"}
              </p>

              {/* Deductions Breakdown */}
              {report?.scoreBreakdown?.deductions?.length > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500">Deductions:</span>
                  {report.scoreBreakdown.deductions.map((d: any, idx: number) => (
                    <span
                      key={idx}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200"
                    >
                      -{d.penalty} pts ({d.reason})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              disabled={running}
              onClick={handleRunAudit}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
              {running ? "Auditing Test..." : "Re-run Quality Audit"}
            </button>

            <a
              href={`/api/team/tests/${testId}/audit/export?format=csv`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </a>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </button>
          </div>
        </div>
      </div>

      {/* 14 Metrics Grid */}
      {metrics && (
        <AuditMetricsGrid
          metrics={metrics}
          activeFilter={metricFilter}
          onSelectFilter={handleSelectMetric}
        />
      )}

      {/* Question Table & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Q#, code, chapter, or text..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Subject Tabs */}
            <div className="flex items-center bg-slate-200/60 p-0.5 rounded-xl text-xs font-medium text-slate-600">
              {["ALL", "PHYSICS", "CHEMISTRY", "BIOLOGY"].map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSubjectFilter(sub)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    subjectFilter === sub
                      ? "bg-white text-slate-900 shadow-sm font-semibold"
                      : "hover:text-slate-900"
                  }`}
                >
                  {sub === "ALL" ? "All Subjects" : sub.charAt(0) + sub.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Severity Dropdown */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Only</option>
              <option value="MEDIUM">Medium Only</option>
              <option value="LOW">Low Only</option>
              <option value="PASSED">Passed Only</option>
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="ALL">All Review Statuses</option>
              <option value="FLAGGED">Flagged</option>
              <option value="AUDITED">Audited</option>
              <option value="VERIFIED">Verified</option>
              <option value="IGNORED">Ignored</option>
            </select>

            {/* Reset Filters */}
            {(searchQuery || subjectFilter !== "ALL" || severityFilter !== "ALL" || statusFilter !== "ALL" || metricFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSubjectFilter("ALL");
                  setSeverityFilter("ALL");
                  setStatusFilter("ALL");
                  setMetricFilter(null);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Question Audit Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Q#</th>
                <th className="py-3 px-3">Code / ID</th>
                <th className="py-3 px-3">Subject & Chapter</th>
                <th className="py-3 px-3">Difficulty</th>
                <th className="py-3 px-3">Answer Key</th>
                <th className="py-3 px-3">Diagram</th>
                <th className="py-3 px-3">Duplicate Check</th>
                <th className="py-3 px-3">Quality Score</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No questions match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((qa) => {
                  const q = qa.question || {};
                  const severityBadgeClass = {
                    CRITICAL: "bg-red-100 text-red-800 border-red-300",
                    HIGH: "bg-amber-100 text-amber-800 border-amber-300",
                    MEDIUM: "bg-orange-100 text-orange-800 border-orange-300",
                    LOW: "bg-slate-100 text-slate-700 border-slate-300",
                    PASSED: "bg-emerald-100 text-emerald-800 border-emerald-300",
                  }[qa.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASSED"] || "bg-slate-100";

                  return (
                    <tr
                      key={qa.id}
                      onClick={() => setSelectedQuestionAudit(qa)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        Q{qa.questionNumber}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-700">
                        {q.questionCode || qa.questionId.slice(0, 10)}
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <span className="font-semibold text-slate-800 block truncate">
                          {qa.subject}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate">
                          {qa.chapter}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md font-medium text-[11px] bg-slate-100 text-slate-700">
                          {qa.difficulty}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {qa.answerValid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Conflict
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            qa.diagramStatus === "OK"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : qa.diagramStatus === "MISSING"
                              ? "bg-red-50 text-red-700 border-red-200 font-bold"
                              : "bg-slate-50 text-slate-500 border-slate-200"
                          }`}
                        >
                          {qa.diagramStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {qa.duplicateType === "NONE" ? (
                          <span className="text-slate-400 text-[11px]">Unique</span>
                        ) : (
                          <span className="text-amber-700 font-semibold text-[11px] block">
                            {qa.duplicateType.replace("_", " ")}
                            {qa.similarityScore ? ` (${Math.round(qa.similarityScore * 100)}%)` : ""}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {qa.qualityScore}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${severityBadgeClass}`}>
                          {qa.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-medium text-slate-600">
                          {qa.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuestionAudit(qa);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Showing {filteredQuestions.length} of {questionAudits.length} questions
          </span>
          <span className="text-[11px] text-slate-400">
            Click on any question row to view full details, diagram preview, and review actions.
          </span>
        </div>
      </div>

      {/* Question Detail Modal */}
      {selectedQuestionAudit && (
        <QuestionAuditModal
          testId={testId}
          questionAudit={selectedQuestionAudit}
          onClose={() => setSelectedQuestionAudit(null)}
          onActionComplete={async () => {
            const refreshRes = await fetch(`/api/team/tests/${testId}/audit`);
            const refreshedJson = await refreshRes.json();
            if (refreshedJson.data) setData(refreshedJson.data);
          }}
        />
      )}
    </div>
  );
}
