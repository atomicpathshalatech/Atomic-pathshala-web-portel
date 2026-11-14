"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  EyeOff,
  Image as ImageIcon,
  BookOpen,
  FileQuestion,
} from "lucide-react";

interface QuestionAuditModalProps {
  testId: string;
  questionAudit: any;
  onClose: () => void;
  onActionComplete: () => void;
}

export function QuestionAuditModal({
  testId,
  questionAudit,
  onClose,
  onActionComplete,
}: QuestionAuditModalProps) {
  const [loading, setLoading] = useState(false);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [showIgnoreInput, setShowIgnoreInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!questionAudit) return null;

  const q = questionAudit.question || {};
  const en = q.translations?.find((t: any) => t.language === "ENGLISH") || q.translations?.[0] || {};
  const hi = q.translations?.find((t: any) => t.language === "HINDI");

  const options = (en.options as Record<string, string>) || {};
  const correctOptionIds = Array.isArray(en.correctOptionIds) ? en.correctOptionIds : [];
  const issues = Array.isArray(questionAudit.issues) ? questionAudit.issues : [];

  async function handleMarkVerified() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/team/tests/${testId}/audit/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MARK_VERIFIED",
          questionAuditId: questionAudit.id,
          reason: "Manually verified by academic team",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to verify question");
      onActionComplete();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleIgnoreIssue() {
    if (!ignoreReason.trim()) {
      setError("Please provide a reason to ignore this issue.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/team/tests/${testId}/audit/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "IGNORE_ISSUE",
          questionAuditId: questionAudit.id,
          reason: ignoreReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to ignore issue");
      onActionComplete();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const severityBadgeClass = {
    CRITICAL: "bg-red-100 text-red-800 border-red-300",
    HIGH: "bg-amber-100 text-amber-800 border-amber-300",
    MEDIUM: "bg-orange-100 text-orange-800 border-orange-300",
    LOW: "bg-slate-100 text-slate-700 border-slate-300",
    PASSED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  }[questionAudit.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASSED"] || "bg-slate-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-sm">
              Q{questionAudit.questionNumber}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-base">
                  {q.questionCode || questionAudit.questionId}
                </h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${severityBadgeClass}`}>
                  {questionAudit.severity}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  {questionAudit.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {questionAudit.subject} • {questionAudit.chapter} • Section: {questionAudit.sectionName || "General"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Audit Issues Banner */}
          {issues.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Quality Audit Findings:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-xs text-amber-900">
                {issues.map((iss: string, idx: number) => (
                  <li key={idx} className="leading-relaxed">
                    {iss}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Question Statement */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileQuestion className="w-3.5 h-3.5" />
              Question Statement
            </h4>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm leading-relaxed whitespace-pre-line font-medium">
              {en.statement || <span className="italic text-slate-400">No English statement available</span>}
            </div>
            {hi?.statement && (
              <div className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                <span className="text-[10px] font-semibold text-slate-400 block mb-1">Hindi Translation:</span>
                {hi.statement}
              </div>
            )}
          </div>

          {/* Diagram / Visual Asset */}
          {(questionAudit.diagramRequired || q.imageUrl || q.referenceImageUrl) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Diagram / Visual Asset
                </h4>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                    questionAudit.diagramStatus === "OK"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  Status: {questionAudit.diagramStatus}
                </span>
              </div>

              {q.imageUrl || q.referenceImageUrl ? (
                <div className="p-2 border border-slate-200 rounded-xl bg-slate-50 flex justify-center max-h-64 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={q.imageUrl || q.referenceImageUrl}
                    alt="Question Diagram"
                    className="max-h-60 object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Question text references a diagram or circuit, but no image file is attached.</span>
                </div>
              )}
            </div>
          )}

          {/* Options */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Options & Key Alignment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(options).map(([optKey, optVal]) => {
                const isCorrect =
                  correctOptionIds.includes(optKey) ||
                  String(questionAudit.answerNotes || "").includes(`Option (${optKey})`);

                return (
                  <div
                    key={optKey}
                    className={`p-3 rounded-xl border flex items-start gap-2.5 transition-colors ${
                      isCorrect
                        ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                        isCorrect
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-700 border border-slate-300"
                      }`}
                    >
                      {optKey.toUpperCase()}
                    </span>
                    <div className="flex-1 text-xs text-slate-800 pt-0.5">
                      <span>{optVal}</span>
                      {isCorrect && (
                        <span className="block mt-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                          ✓ Correct Answer Key
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Solution & Explanation */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Step-by-Step Solution & NCERT Alignment
            </h4>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs leading-relaxed whitespace-pre-line">
              {en.solution || q.solution || (
                <span className="italic text-slate-400">No step-by-step solution provided.</span>
              )}
            </div>
            {questionAudit.ncertReference && (
              <p className="text-[11px] text-slate-500 font-medium">
                Reference: <span className="text-blue-600">{questionAudit.ncertReference}</span>
              </p>
            )}
          </div>

          {/* Ignore input form if open */}
          {showIgnoreInput && (
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Reason for Ignoring Quality Issue:
              </label>
              <textarea
                value={ignoreReason}
                onChange={(e) => setIgnoreReason(e.target.value)}
                placeholder="e.g. Diagram not strictly required by NCERT syllabus / verified alternative phrasing..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20 bg-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIgnoreInput(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleIgnoreIssue}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 disabled:opacity-50"
                >
                  Confirm & Ignore
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <a
              href={`/team/questions?search=${q.questionCode || questionAudit.questionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Question Bank
            </a>
          </div>

          <div className="flex items-center gap-2">
            {!showIgnoreInput && questionAudit.status !== "IGNORED" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowIgnoreInput(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Ignore Issue
              </button>
            )}

            {questionAudit.status !== "VERIFIED" && (
              <button
                type="button"
                disabled={loading}
                onClick={handleMarkVerified}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Mark as Verified
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
