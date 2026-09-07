"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "WRONG_ANSWER", label: "Wrong Answer" },
  { value: "INCORRECT_QUESTION", label: "Incorrect Question" },
  { value: "IMAGE_MISSING", label: "Image Missing" },
  { value: "TYPO", label: "Typo" },
  { value: "WRONG_OPTION", label: "Wrong Option" },
  { value: "WRONG_SOLUTION", label: "Wrong Solution" },
  { value: "LANGUAGE_ISSUE", label: "Language Issue" },
  { value: "OUT_OF_SYLLABUS", label: "Question Out of Syllabus" },
  { value: "DUPLICATE_QUESTION", label: "Duplicate Question" },
  { value: "OTHER", label: "Other" },
];

const DIFFICULTY_CLASS: Record<string, string> = {
  EASY: "bg-primary-container text-on-primary",
  MEDIUM: "bg-secondary-container text-on-secondary-container",
  HARD: "bg-error/10 text-error",
};

export function BookmarkCard({
  questionId,
  subject,
  chapter,
  topic,
  difficulty,
  statement,
}: {
  questionId: string;
  subject: string;
  chapter: string | null;
  topic: string | null;
  difficulty: string;
  statement: string | null;
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "sent" | "error">("idle");

  async function handleUnsave() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/bookmarks/${questionId}`, { method: "DELETE" });
      if (res.ok) {
        setRemoved(true);
        router.refresh();
      }
    } finally {
      setRemoving(false);
    }
  }

  function toggleReason(value: string) {
    setSelectedReasons((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleReportSubmit() {
    if (selectedReasons.length === 0) return;
    setSubmitting(true);
    setReportStatus("idle");
    try {
      const res = await fetch(`/api/questions/${questionId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonTags: selectedReasons, comment }),
      });
      setReportStatus(res.ok ? "sent" : "error");
      if (res.ok) {
        setSelectedReasons([]);
        setComment("");
      }
    } catch {
      setReportStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (removed) return null;

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-label-sm text-on-surface-variant shrink-0">{subject}</span>
          {chapter && <span className="text-label-sm text-on-surface-variant shrink-0">· {chapter}</span>}
          {topic && <span className="text-label-sm text-on-surface-variant shrink-0">· {topic}</span>}
        </div>
        <span
          className={`shrink-0 text-label-sm font-semibold px-2.5 py-1 rounded-full ${
            DIFFICULTY_CLASS[difficulty] ?? "bg-surface-container text-on-surface-variant"
          }`}
        >
          {difficulty}
        </span>
      </div>

      {statement && <p className="font-body-md text-body-md text-on-surface line-clamp-3">{statement}</p>}

      <div className="flex items-center gap-4 mt-1">
        <button
          type="button"
          onClick={handleUnsave}
          disabled={removing}
          className="text-label-sm font-semibold text-error hover:underline disabled:opacity-50"
        >
          {removing ? "Removing…" : "Remove bookmark"}
        </button>
        <button
          type="button"
          onClick={() => setReportOpen((v) => !v)}
          className="text-label-sm font-semibold text-on-surface-variant hover:underline"
        >
          {reportOpen ? "Cancel report" : "Report an issue"}
        </button>
      </div>

      {reportOpen && (
        <div className="mt-2 border-t border-outline-variant/40 pt-3 flex flex-col gap-2">
          {reportStatus === "sent" ? (
            <p className="text-label-sm text-primary font-semibold">
              Thanks — your report was submitted to the review team.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {REASON_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleReason(opt.value)}
                    className={`text-label-sm px-2.5 py-1 rounded-full border transition-colors ${
                      selectedReasons.includes(opt.value)
                        ? "bg-primary text-on-primary border-primary"
                        : "border-outline-variant text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note (optional)"
                rows={2}
                className="w-full text-body-sm rounded-lg border border-outline-variant bg-surface p-2 text-on-surface"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReportSubmit}
                  disabled={submitting || selectedReasons.length === 0}
                  className="text-label-sm font-semibold px-3 py-1.5 rounded-full bg-primary text-on-primary disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit report"}
                </button>
                {reportStatus === "error" && (
                  <span className="text-label-sm text-error">Something went wrong. Try again.</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
