"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, X, Flag, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export const REPORT_REASONS = [
  { id: "WRONG_ANSWER", label: "Answer is wrong", description: "The marked correct option or answer key is incorrect" },
  { id: "INCORRECT_QUESTION", label: "Question is incorrect", description: "Question statement is incomplete, invalid or contains errors" },
  { id: "WRONG_SOLUTION", label: "Explanation is wrong", description: "The step-by-step solution or formula explanation has errors" },
  { id: "WRONG_OPTION", label: "Options are incorrect", description: "Options are duplicated, missing or all incorrect" },
  { id: "LANGUAGE_ISSUE", label: "Hindi/English translation is incorrect", description: "Translation mismatch or grammatical ambiguity" },
  { id: "OTHER", label: "Other issue", description: "Any other problem with this question" },
] as const;

export interface QuestionMetadataForReport {
  statement?: string;
  options?: any;
  correctAnswer?: string;
  solution?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  source?: string;
  language?: string;
}

interface ReportQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  questionMeta?: QuestionMetadataForReport;
  testId?: string;
  onReportSuccess?: () => void;
}

export function ReportQuestionModal({
  isOpen,
  onClose,
  questionId,
  questionMeta,
  testId,
  onReportSuccess,
}: ReportQuestionModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("WRONG_ANSWER");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      toast.error("Please select a reason for reporting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(questionId)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: testId || undefined,
          reasonTags: [selectedReason],
          comment: comment.trim() || undefined,
          questionMeta: questionMeta || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.alreadyReported || json.code === "ALREADY_REPORTED") {
          setAlreadyReported(true);
          toast.info("You have already reported this question.");
          return;
        }
        throw new Error(json.error || "Failed to submit report. Please try again.");
      }

      if (json.data?.alreadyReported) {
        setAlreadyReported(true);
        toast.info("You have already reported this question.");
        return;
      }

      setSubmittedSuccess(true);
      toast.success("Thank you! Your report has been submitted for faculty review.");
      if (onReportSuccess) onReportSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 p-0 sm:p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Report this question</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Think the answer or explanation is incorrect? Tell us so our faculty can review it.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* State: Already Reported */}
        {alreadyReported ? (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold">Report Already Received</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              You&apos;ve already reported this question. Thank you — it has been sent for faculty review. We are currently verifying the answer key and explanation.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : submittedSuccess ? (
          <div className="py-6 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold">Report Submitted Successfully</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Our academic faculty and subject experts will verify this question. If an error is found, the answer key and solution will be updated immediately.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Reason Radio Grid */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Select Reason
              </label>
              <div className="space-y-1.5">
                {REPORT_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason.id;
                  return (
                    <label
                      key={reason.id}
                      className={`flex items-start gap-3 rounded-xl border p-2.5 cursor-pointer transition-all ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/10 dark:border-amber-500/80"
                          : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={reason.id}
                        checked={isSelected}
                        onChange={() => setSelectedReason(reason.id)}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {reason.label}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {reason.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Optional Comment */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Tell us what seems wrong <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Example: The correct answer should be Option B because..."
                rows={3}
                maxLength={2000}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-amber-600/20 hover:brightness-110 active:scale-95 disabled:opacity-50 transition"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Flag className="h-3.5 w-3.5" />
                    Submit Report
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
