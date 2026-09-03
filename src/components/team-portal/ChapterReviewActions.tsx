"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";

type Decision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

const DECISION_LABEL: Record<Decision, string> = {
  APPROVE: "Approved & Published",
  REJECT: "Rejected",
  REQUEST_CHANGES: "Changes Requested",
};

export function ChapterReviewActions({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<Decision | null>(null);

  async function decide(action: Decision) {
    if (action !== "APPROVE" && !comment.trim()) {
      toast.error("Please add a comment explaining what needs to change before rejecting or requesting changes.");
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
      toast.success(`Chapter has been ${DECISION_LABEL[action]}! Ready for Batch Import.`);
      setComment("");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-3xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Admin Verification Desk (Under Review)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase">
                Action Required
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Review lectures, DPPs, and tests roadmap. Approving makes this chapter ready for live batch timetable import.
            </p>
          </div>
        </div>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Review feedback note (optional for Approve, required for Request Changes / Reject)..."
        rows={2}
        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => decide("APPROVE")}
          disabled={submitting !== null}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition disabled:opacity-60"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{submitting === "APPROVE" ? "Approving..." : "Approve & Publish Chapter"}</span>
        </button>

        <button
          type="button"
          onClick={() => decide("REQUEST_CHANGES")}
          disabled={submitting !== null}
          className="px-4 py-2.5 rounded-xl text-xs font-bold border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-1.5 transition disabled:opacity-60"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{submitting === "REQUEST_CHANGES" ? "Sending..." : "Request Changes"}</span>
        </button>

        <button
          type="button"
          onClick={() => decide("REJECT")}
          disabled={submitting !== null}
          className="px-4 py-2.5 rounded-xl text-xs font-bold border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 transition disabled:opacity-60"
        >
          <XCircle className="w-4 h-4" />
          <span>{submitting === "REJECT" ? "Rejecting..." : "Reject"}</span>
        </button>
      </div>
    </div>
  );
}
