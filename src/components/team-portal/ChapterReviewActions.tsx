"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Decision = "APPROVE" | "REJECT" | "REQUEST_CHANGES";

const DECISION_LABEL: Record<Decision, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  REQUEST_CHANGES: "Request Changes",
};

/**
 * Admin review panel for a chapter that is UNDER_REVIEW — Approve / Reject
 * / Request Changes, posting to POST .../review. Reject and Request
 * Changes require a comment (enforced again server-side by
 * chapterReviewDecisionSchema, this is just the matching UX); the API
 * additionally refuses the request if the reviewer is the chapter's own
 * creator, regardless of what this component renders.
 */
export function ChapterReviewActions({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<Decision | null>(null);

  async function decide(action: Decision) {
    if (action !== "APPROVE" && !comment.trim()) {
      toast.error("Add a comment explaining what needs to change before rejecting or requesting changes.");
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
      toast.success(`Chapter ${DECISION_LABEL[action].toLowerCase()}d.`);
      setComment("");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="glass-card p-stack-lg rounded-xl space-y-3 border border-primary/30">
      <h3 className="font-headline-md text-headline-md text-primary">Admin Review</h3>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Review comment (required for Reject / Request Changes)"
        rows={3}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => decide("APPROVE")}
          disabled={submitting !== null}
          className="px-4 py-2 rounded-lg font-label-sm text-label-sm bg-primary text-on-primary shadow disabled:opacity-60"
        >
          {submitting === "APPROVE" ? "Approving..." : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => decide("REQUEST_CHANGES")}
          disabled={submitting !== null}
          className="px-4 py-2 rounded-lg font-label-sm text-label-sm border border-outline-variant hover:bg-surface-container-lowest disabled:opacity-60"
        >
          {submitting === "REQUEST_CHANGES" ? "Sending..." : "Request Changes"}
        </button>
        <button
          type="button"
          onClick={() => decide("REJECT")}
          disabled={submitting !== null}
          className="px-4 py-2 rounded-lg font-label-sm text-label-sm border border-error/40 text-error hover:bg-error-container/10 disabled:opacity-60"
        >
          {submitting === "REJECT" ? "Rejecting..." : "Reject"}
        </button>
      </div>
    </div>
  );
}
