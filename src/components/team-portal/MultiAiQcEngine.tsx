"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileCheck,
  Flame,
  HelpCircle,
  Loader2,
  Lock,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { FormulaText } from "@/components/test-portal/FormulaText";
import { CompleteReviewPayload, QualityStatus, ReviewDecision } from "@/lib/ai-provider/types";

interface MultiAiQcEngineProps {
  canApply?: boolean;
}

const STATUS_BADGE_STYLE: Record<QualityStatus, { label: string; tone: string; icon: any }> = {
  APPROVED_BY_ALL: { label: "Approved by All Models", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  APPROVED_AFTER_VERIFICATION: { label: "Approved After Verification", tone: "bg-teal-500/10 text-teal-600 border-teal-500/30", icon: CheckCircle2 },
  REJECTED_BY_GEMINI: { label: "Rejected by Gemini", tone: "bg-rose-500/10 text-rose-600 border-rose-500/30", icon: XCircle },
  REJECTED_BY_OPENAI: { label: "Rejected by OpenAI", tone: "bg-rose-500/10 text-rose-600 border-rose-500/30", icon: XCircle },
  REJECTED_BY_CLAUDE: { label: "Rejected by Claude", tone: "bg-rose-500/10 text-rose-600 border-rose-500/30", icon: XCircle },
  NCERT_MISMATCH: { label: "NCERT Mismatch", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: AlertTriangle },
  ANSWER_KEY_MISMATCH: { label: "Answer Key Mismatch", tone: "bg-red-500/10 text-red-600 border-red-500/30", icon: ShieldAlert },
  SOLUTION_ERROR: { label: "Solution Calculation Error", tone: "bg-red-500/10 text-red-600 border-red-500/30", icon: AlertTriangle },
  SCIENTIFIC_ERROR: { label: "Scientific/Chemical Error", tone: "bg-red-600/15 text-red-700 border-red-500/40", icon: Flame },
  TOPIC_MISMATCH: { label: "Topic/Syllabus Mismatch", tone: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: HelpCircle },
  SOURCE_UNVERIFIED: { label: "Source Unverified", tone: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30", icon: BookOpen },
  MANUAL_REVIEW_REQUIRED: { label: "Manual Review Required", tone: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Scale },
  API_FAILURE: { label: "Provider Service Error", tone: "bg-purple-500/10 text-purple-600 border-purple-500/30", icon: Cpu },
};

export function MultiAiQcEngine({ canApply = true }: MultiAiQcEngineProps) {
  // Input fields for Grounded Question Generation or Manual Audit
  const [mode, setMode] = useState<"GENERATE" | "AUDIT">("GENERATE");
  const [subject, setSubject] = useState("PHYSICS");
  const [classLevel, setClassLevel] = useState("CLASS_11");
  const [chapter, setChapter] = useState("Kinematics");
  const [topic, setTopic] = useState("Motion in a Straight Line");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD" | "ULTRA">("MEDIUM");
  const [questionType, setQuestionType] = useState<"SINGLE_CORRECT" | "ASSERTION_REASON" | "STATEMENT" | "MATCH">("SINGLE_CORRECT");
  const [customInstructions, setCustomInstructions] = useState("");

  // Manual statement inputs (when mode is AUDIT)
  const [manualStatement, setManualStatement] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [storedAnswer, setStoredAnswer] = useState("A");
  const [manualSolution, setManualSolution] = useState("");

  // Loading & Results
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<CompleteReviewPayload | null>(null);

  // Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<string>("APPROVED_BY_FACULTY");
  const [overrideReason, setOverrideReason] = useState("");
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const handleRunAudit = async () => {
    setLoading(true);
    try {
      let res;
      if (mode === "GENERATE") {
        res = await fetch("/api/team/qc/generate-grounded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            classLevel,
            chapter,
            topic,
            difficulty,
            questionType,
            customInstructions,
          }),
        });
      } else {
        res = await fetch("/api/team/qc/multi-model/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshot: {
              statement: manualStatement,
              options: { A: optA, B: optB, C: optC, D: optD },
              storedAnswer: [storedAnswer],
              solution: manualSolution,
              subject,
              chapter,
              topic,
              difficulty,
              type: questionType,
            },
          }),
        });
      }

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to execute multi-model audit");
      }

      setPayload(body.data);
      toast.success("Multi-Model Intelligence audit complete");
    } catch (err: any) {
      toast.error(err.message || "Audit execution failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyOverride = async () => {
    if (!payload?.auditId) {
      toast.error("No active audit ID to record override on");
      return;
    }
    if (overrideReason.trim().length < 5) {
      toast.error("Override reason must be at least 5 characters long");
      return;
    }

    setSubmittingOverride(true);
    try {
      const res = await fetch("/api/team/qc/multi-model/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: payload.auditId,
          overrideStatus,
          overrideReason,
        }),
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to submit override");
      }

      toast.success("Faculty override recorded with audit justification");
      setShowOverrideModal(false);
      // Update local payload status
      if (payload) {
        setPayload({
          ...payload,
          finalDecision: {
            ...payload.finalDecision,
            finalStatus: overrideStatus as any,
          },
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Override failed");
    } finally {
      setSubmittingOverride(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Configuration Header & Controls */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-3.5 h-3.5" /> 3-Model AI QC Pipeline
              </span>
              <span className="text-xs text-slate-500">Gemini L1 + OpenAI L2 + Claude L3</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              Multi-AI Question Intelligence & Verification Engine
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Source-grounded generation, independent 3-model verification, deterministic KaTeX/chemical validators, and consensus decisioning.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start">
            <button
              onClick={() => setMode("GENERATE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === "GENERATE"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Source-Grounded Gen
            </button>
            <button
              onClick={() => setMode("AUDIT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === "AUDIT"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Audit Existing Question
            </button>
          </div>
        </div>

        {/* Form Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-800 dark:text-slate-100"
            >
              <option value="PHYSICS">Physics</option>
              <option value="CHEMISTRY">Chemistry</option>
              <option value="BOTANY">Botany</option>
              <option value="ZOOLOGY">Zoology</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Class</label>
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-800 dark:text-slate-100"
            >
              <option value="CLASS_11">Class 11</option>
              <option value="CLASS_12">Class 12</option>
              <option value="DROPPER">Dropper / Target</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chapter</label>
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Electrochemistry"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Nernst Equation & EMF"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {mode === "AUDIT" && (
          <div className="space-y-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Question Statement</label>
              <textarea
                rows={3}
                value={manualStatement}
                onChange={(e) => setManualStatement(e.target.value)}
                placeholder="Enter question text with KaTeX formulas (e.g. For $Fe^{3+} + e^- \rightarrow Fe^{2+}$, ...)"
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Option A</label>
                <input
                  type="text"
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Option B</label>
                <input
                  type="text"
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Option C</label>
                <input
                  type="text"
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Option D</label>
                <input
                  type="text"
                  value={optD}
                  onChange={(e) => setOptD(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Answer Key</label>
                <select
                  value={storedAnswer}
                  onChange={(e) => setStoredAnswer(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-bold"
                >
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  <option value="C">Option C</option>
                  <option value="D">Option D</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Step-by-Step Solution</label>
                <input
                  type="text"
                  value={manualSolution}
                  onChange={(e) => setManualSolution(e.target.value)}
                  placeholder="Solution steps with KaTeX formulas..."
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {mode === "GENERATE" && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Custom Pedagogical Instructions (Optional)</label>
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Focus on assertion-reasoning NEET 2024 pattern, or tricky charge balances"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-800 dark:text-slate-100"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleRunAudit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing Multi-Model Audit...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {mode === "GENERATE" ? "Generate & Run 3-Model QC" : "Run Independent 3-Model QC"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 SEPARATE PANELS DISPLAY (Mandatory Requirement) */}
      {payload && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Three Separate Independent Reviews + One Consolidated Decision
            </h3>
            {canApply && (
              <button
                onClick={() => setShowOverrideModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-all"
              >
                <Lock className="w-3.5 h-3.5" /> Faculty / Admin Override
              </button>
            )}
          </div>

          {/* 3 Review Panels (A, B, C) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PANEL A — GEMINI REVIEW */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Panel A: Gemini Review
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      payload.geminiReview.decision === "APPROVE"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    }`}
                  >
                    {payload.geminiReview.decision}
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Independently Solved:</span>
                    <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      Option {payload.geminiReview.solvedAnswer || "N/A"}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-500">
                      (Matches Stored: {payload.geminiReview.answerMatches ? "Yes" : "No"})
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Scientific Validity:</span>
                    <span className={payload.geminiReview.isScientificallyCorrect ? "text-emerald-600" : "text-rose-600"}>
                      {payload.geminiReview.isScientificallyCorrect ? "Verified scientifically" : "Scientific errors detected"}
                    </span>
                  </div>

                  {payload.geminiReview.scientificErrors.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                      <span className="font-bold block mb-1">Errors Detected:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {payload.geminiReview.scientificErrors.map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {payload.geminiReview.suggestedQuestion && (
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-200">
                      <span className="font-bold block mb-1">Suggested Question Correction:</span>
                      <FormulaText text={payload.geminiReview.suggestedQuestion} />
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">NCERT Evidence:</span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      {payload.geminiReview.ncertAlignment?.explanation || "Checked against standard syllabus"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Model: {payload.geminiReview.model}</span>
                <span>Confidence: {Math.round(payload.geminiReview.confidenceScore * 100)}%</span>
              </div>
            </div>

            {/* PANEL B — OPENAI REVIEW */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Panel B: OpenAI Review
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      payload.openaiReview.decision === "APPROVE"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    }`}
                  >
                    {payload.openaiReview.decision}
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Independently Solved:</span>
                    <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      Option {payload.openaiReview.solvedAnswer || "N/A"}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-500">
                      (Matches Stored: {payload.openaiReview.answerMatches ? "Yes" : "No"})
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Scientific & Math Validity:</span>
                    <span className={payload.openaiReview.isScientificallyCorrect ? "text-emerald-600" : "text-rose-600"}>
                      {payload.openaiReview.isScientificallyCorrect
                        ? "Valid and mathematically sound"
                        : "Discrepancy identified"}
                    </span>
                  </div>

                  {payload.openaiReview.scientificErrors.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                      <span className="font-bold block mb-1">OpenAI Errors Detected:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {payload.openaiReview.scientificErrors.map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {payload.openaiReview.suggestedQuestion && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                      <span className="font-bold block mb-1">Proposed Correction:</span>
                      <FormulaText text={payload.openaiReview.suggestedQuestion} />
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">NCERT Evidence:</span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      {payload.openaiReview.ncertAlignment?.explanation || "Evidence evaluated"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Model: {payload.openaiReview.model}</span>
                <span>Confidence: {Math.round(payload.openaiReview.confidenceScore * 100)}%</span>
              </div>
            </div>

            {/* PANEL C — CLAUDE REVIEW */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Panel C: Claude Review
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      payload.claudeReview.decision === "APPROVE"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    }`}
                  >
                    {payload.claudeReview.decision}
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Independently Solved:</span>
                    <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      Option {payload.claudeReview.solvedAnswer || "N/A"}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-500">
                      (Matches Stored: {payload.claudeReview.answerMatches ? "Yes" : "No"})
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Ambiguity & Multi-Option Check:</span>
                    <span
                      className={
                        payload.claudeReview.ambiguityDetected || payload.claudeReview.multipleCorrectOptionsDetected
                          ? "text-amber-600 font-bold"
                          : "text-emerald-600"
                      }
                    >
                      {payload.claudeReview.ambiguityDetected
                        ? "Ambiguity detected in phrasing"
                        : payload.claudeReview.multipleCorrectOptionsDetected
                        ? "Multiple plausible options"
                        : "Unambiguous single-correct question"}
                    </span>
                  </div>

                  {payload.claudeReview.scientificErrors.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                      <span className="font-bold block mb-1">Claude Errors Detected:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {payload.claudeReview.scientificErrors.map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {payload.claudeReview.suggestedQuestion && (
                    <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-800 dark:text-orange-200">
                      <span className="font-bold block mb-1">Proposed Correction:</span>
                      <FormulaText text={payload.claudeReview.suggestedQuestion} />
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">NCERT Alignment:</span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                      {payload.claudeReview.ncertAlignment?.explanation || "Checked for NCERT conformity"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Model: {payload.claudeReview.model}</span>
                <span>Confidence: {Math.round(payload.claudeReview.confidenceScore * 100)}%</span>
              </div>
            </div>
          </div>

          {/* PANEL D — FINAL CONSOLIDATED QUALITY DECISION */}
          <div className="rounded-2xl border-2 border-indigo-500/30 bg-white dark:bg-slate-900 p-6 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Panel D: Final Quality Decision & Consensus
                </span>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  Authoritative Consensus Verdict
                </h4>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-3">
                {(() => {
                  const meta = STATUS_BADGE_STYLE[payload.finalDecision.finalStatus] || {
                    label: payload.finalDecision.finalStatus,
                    tone: "bg-slate-100 text-slate-700 border-slate-300",
                    icon: HelpCircle,
                  };
                  const Icon = meta.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wide ${meta.tone}`}
                    >
                      <Icon className="w-4 h-4" /> {meta.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Disagreements Banner (NEVER HIDDEN) */}
            {payload.finalDecision.disagreements.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" /> Model Disagreements Detected (Requires Review)
                </div>
                <ul className="mt-2 list-disc list-inside space-y-1 text-xs">
                  {payload.finalDecision.disagreements.map((d, idx) => (
                    <li key={idx} className="font-semibold">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mathematical & Chemical Deterministic Validators */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Math Check */}
              <div
                className={`p-3.5 rounded-xl border text-xs ${
                  payload.mathValidation.valid
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
                    : "border-rose-500/20 bg-rose-500/5 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>KaTeX & Math Validator:</span>
                  <span>{payload.mathValidation.valid ? "PASSED" : "FAILED"}</span>
                </div>
                {!payload.mathValidation.valid && (
                  <ul className="mt-1 list-disc list-inside text-[11px] space-y-0.5 text-rose-700 dark:text-rose-300">
                    {payload.mathValidation.syntaxErrors.map((e, idx) => (
                      <li key={idx}>Syntax: {e}</li>
                    ))}
                    {payload.mathValidation.arithmeticErrors.map((e, idx) => (
                      <li key={idx}>Arithmetic: {e}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Chem Check */}
              <div
                className={`p-3.5 rounded-xl border text-xs ${
                  payload.chemValidation.valid
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
                    : "border-rose-500/20 bg-rose-500/5 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Chemical & Charge Validator:</span>
                  <span>{payload.chemValidation.valid ? "PASSED" : "FAILED"}</span>
                </div>
                {!payload.chemValidation.valid && (
                  <ul className="mt-1 list-disc list-inside text-[11px] space-y-0.5 text-rose-700 dark:text-rose-300">
                    {payload.chemValidation.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                    {payload.chemValidation.ionDiscrepancies.map((e, idx) => (
                      <li key={idx}>Charge Imbalance: {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Final Question Output */}
            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Final Question Statement:
                </span>
                <div className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed">
                  <FormulaText text={payload.finalDecision.finalQuestion} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                  {Object.entries(payload.finalDecision.finalOptions).map(([key, optText]) => (
                    <div
                      key={key}
                      className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                        payload.finalDecision.finalAnswerKey.includes(key)
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 font-semibold"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="font-bold">{key}.</span>
                      <FormulaText text={optText} />
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Authoritative Answer Key:</span>
                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
                    {payload.finalDecision.finalAnswerKey.join(", ")}
                  </span>
                </div>

                {payload.finalDecision.finalSolution && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-slate-500 block mb-1">Detailed Solution:</span>
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                      <FormulaText text={payload.finalDecision.finalSolution} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" /> Faculty / Admin Consensus Override
            </h3>
            <p className="text-xs text-slate-500">
              Resolve disagreements or approve manually. A detailed academic justification is mandatory for audit compliance.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Override Status</label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-bold"
              >
                <option value="APPROVED_BY_FACULTY">APPROVED_BY_FACULTY (Human Verified)</option>
                <option value="APPROVED_AFTER_VERIFICATION">APPROVED_AFTER_VERIFICATION</option>
                <option value="REJECTED_BY_FACULTY">REJECTED_BY_FACULTY (Defective Question)</option>
                <option value="MANUAL_REVIEW_REQUIRED">MANUAL_REVIEW_REQUIRED (Hold)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mandatory Academic Reason
              </label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="State why this override was performed and quote relevant textbook page or principle..."
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyOverride}
                disabled={submittingOverride}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
              >
                {submittingOverride ? "Recording Override..." : "Confirm Override"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
