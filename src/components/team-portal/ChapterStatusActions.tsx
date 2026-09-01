"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { nextValidStates, type ChapterStatusValue } from "@/lib/chapters/state-machine";

const STATUS_LABELS: Record<ChapterStatusValue, string> = {
  DRAFT: "Draft",
  LECTURES_IN_PROGRESS: "Lectures In Progress",
  LECTURES_COMPLETE: "Lectures Complete",
  TESTS_PENDING: "Tests Pending",
  READY_TO_PUBLISH: "Ready to Publish",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function ChapterStatusActions({ chapterId, status }: { chapterId: string; status: ChapterStatusValue }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<ChapterStatusValue | null>(null);

  async function transition(next: ChapterStatusValue) {
    setSubmitting(next);
    try {
      const res = await fetch(`/api/team/chapters/${chapterId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not update the chapter's status.");
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

  const options = nextValidStates(status);
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
            next === "PUBLISHED"
              ? "bg-primary text-on-primary shadow"
              : next === "ARCHIVED"
              ? "border border-error/40 text-error hover:bg-error-container/10"
              : "border border-outline-variant hover:bg-surface-container-lowest"
          }`}
        >
          {submitting === next ? "Updating..." : `Move to ${STATUS_LABELS[next]}`}
        </button>
      ))}
    </div>
  );
}
