"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, XCircle, ShieldCheck, MessageSquare, Clock } from "lucide-react";

type Decision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

const DECISION_LABEL: Record<Decision, string> = {
  APPROVE: "Approved & Published",
  REJECT: "Rejected",
  REQUEST_CHANGES: "Sent Back to Authoring / Draft",
};

export function ChapterReviewActions({
  chapterId,
  currentStatus,
}: {
  chapterId: string;
  currentStatus?: string;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<Decision | null>(null);

  async function decide(action: Decision) {
    if (action !== "APPROVE" && !comment.trim()) {
      toast.error(
        action === "REQUEST_CHANGES"
          ? "Please provide a revision note explaining what the faculty needs to update."
          : "Please provide a mandatory reason for rejecting this chapter."
      );
      return;
    }

    setSubmitting(action);
    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not record the review decision.");
        return;
      }
      toast.success(`Chapter successfully ${DECISION_LABEL[action]}! Audit log recorded.`);
      setComment("");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  const isApprovedOrPublished = currentStatus === "APPROVED" || currentStatus === "PUBLISHED";
  const isRejected = currentStatus === "REJECTED";
  const isChangesRequested = currentStatus === "CHANGES_REQUESTED";

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#101322] to-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Admin Governance &amp; Verification Desk</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold uppercase">
                {currentStatus?.replaceAll("_", " ") || "Under Review"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Admin controls: Approve for live batch timetable import, Send Back for revisions, or Reject. All decisions are fully audit-logged &amp; traceable.
            </p>
          </div>
        </div>
      </div>

      {/* Comment Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
          <span>Reviewer Feedback Note / Rejection Reason:</span>
          <span className="text-[11px] text-slate-400 font-normal">
            (Required for Send Back / Reject)
          </span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="e.g. Please add 2 more numerical questions in DPP 1 and verify Lecture 3 duration..."
          rows={2}
          className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* Approve & Publish Button */}
        {!isApprovedOrPublished && (
          <button
            type="button"
            onClick={() => decide("APPROVE")}
            disabled={submitting !== null}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting === "APPROVE" ? "Approving..." : "Approve & Publish Chapter"}</span>
          </button>
        )}

        {/* Send Back to Authoring / Draft Button */}
        <button
          type="button"
          onClick={() => decide("REQUEST_CHANGES")}
          disabled={submitting !== null}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 flex items-center gap-2 transition disabled:opacity-50"
          title="Send back to authoring/draft so faculty can make updates"
        >
          <RotateCcw className="w-4 h-4" />
          <span>
            {submitting === "REQUEST_CHANGES"
              ? "Sending Back..."
              : isApprovedOrPublished
              ? "Revert & Send Back to Authoring"
              : "Send Back to Authoring (Revision)"}
          </span>
        </button>

        {/* Reject Chapter Button */}
        {!isRejected && (
          <button
            type="button"
            onClick={() => decide("REJECT")}
            disabled={submitting !== null}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 flex items-center gap-2 transition disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            <span>{submitting === "REJECT" ? "Rejecting..." : "Reject Chapter"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
