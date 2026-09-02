"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { nextValidStates, REVIEW_MANAGED_STATES, type ChapterStatusValue } from "@/lib/chapters/state-machine";

const STATUS_LABELS: Record<ChapterStatusValue, string> = {
  DRAFT: "Draft",
  LECTURES_IN_PROGRESS: "Lectures In Progress",
  LECTURES_COMPLETE: "Lectures Complete",
  TESTS_PENDING: "Tests Pending",
  READY_TO_PUBLISH: "Ready to Publish",
  SUBMITTED: "Submitted for Review",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CHANGES_REQUESTED: "Changes Requested",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function ChapterStatusActions({ chapterId, status }: { chapterId: string; status: ChapterStatusValue }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<ChapterStatusValue | null>(null);

  async function transition(next: ChapterStatusValue) {
    setSubmitting(next);
    try {
      // SUBMITTED is entered only through the dedicated readiness-checked
      // endpoint (see @/lib/chapters/state-machine's REVIEW_MANAGED_STATES)
      // — the generic /status route rejects it outright.
      const endpoint =
        next === "SUBMITTED"
          ? `/api/team/chapters/${chapterId}/submit`
          : `/api/team/chapters/${chapterId}/status`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: next === "SUBMITTED" ? undefined : JSON.stringify({ status: next }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        if (body.code === "CHAPTER_NOT_READY" && Array.isArray(body.details?.missing)) {
          toast.error(`Not ready yet — missing: ${body.details.missing.join(", ")}`);
        } else {
          toast.error(body.error ?? "Could not update the chapter's status.");
        }
        return;
      }
      toast.success(`Chapter moved to ${STATUS_LABELS[next]}.`);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  // UNDER_REVIEW/APPROVED/REJECTED/CHANGES_REQUESTED require a reviewer
  // permission and (for reject/request-changes) a mandatory comment —
  // those live in <ChapterReviewActions>, not as a plain button here.
  // SUBMITTED is kept (its click is special-cased above to hit /submit).
  const options = nextValidStates(status).filter(
    (s) => s === "SUBMITTED" || !REVIEW_MANAGED_STATES.includes(s)
  );
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((next) => (
        <button
          key={next}
          type="button"
          onClick={() => transition(next)}
          disabled={submitting !== null}
          className={`px-4 py-2 rounded-lg font-label-sm text-label-sm transition-all disabled:opacity-60 ${
            next === "PUBLISHED" || next === "SUBMITTED"
              ? "bg-primary text-on-primary shadow"
              : next === "ARCHIVED"
              ? "border border-error/40 text-error hover:bg-error-container/10"
              : "border border-outline-variant hover:bg-surface-container-lowest"
          }`}
        >
          {submitting === next
            ? "Updating..."
            : next === "SUBMITTED"
            ? "Submit for Review"
            : `Move to ${STATUS_LABELS[next]}`}
        </button>
      ))}
    </div>
  );
}
