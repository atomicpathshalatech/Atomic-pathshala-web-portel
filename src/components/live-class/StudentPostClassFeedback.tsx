"use client";

import { useState } from "react";
import Link from "next/link";

interface StudentPostClassFeedbackProps {
  sessionId: string;
  sessionTitle: string;
  teacherName?: string | null;
}

export function StudentPostClassFeedback({
  sessionId,
  sessionTitle,
  teacherName,
}: StudentPostClassFeedbackProps) {
  const [understandingLevel, setUnderstandingLevel] = useState<"POOR" | "AVERAGE" | "GOOD" | "EXCELLENT">("GOOD");
  const [contentHelpfulness, setContentHelpfulness] = useState<"NOT_HELPFUL" | "SOMEWHAT" | "HELPFUL" | "VERY_HELPFUL">("VERY_HELPFUL");
  const [doubtStatus, setDoubtStatus] = useState<"NONE" | "ALL_RESOLVED" | "SOME_UNRESOLVED">("ALL_RESOLVED");
  const [liked, setLiked] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/whiteboard/sessions/${sessionId}/feedback/student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          understandingLevel,
          contentHelpfulness,
          doubtStatus,
          liked,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else {
        setError(json.error || "Could not submit learning feedback.");
      }
    } catch {
      setError("Something went wrong. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  const chip = (active: boolean) =>
    `py-1.5 px-2 rounded-lg text-[11px] font-semibold transition ${
      active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className="w-full max-w-sm mx-auto my-6 p-4 bg-white text-slate-900 rounded-2xl shadow-[0_2px_12px_rgba(15,23,42,0.08)] space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[22px]">task_alt</span>
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Class Ended · Thank you!</h2>
          <p className="text-[11px] text-slate-500 truncate">{sessionTitle}</p>
        </div>
      </div>

      {submitted ? (
        <div className="rounded-xl bg-emerald-50 p-3 text-center space-y-2">
          <p className="text-xs font-semibold text-emerald-700">Feedback submitted</p>
          <p className="text-[11px] text-slate-500">Notes and the recording will appear in your batch.</p>
          <Link href="/schedule" className="inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold">
            Back to Schedule
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-[11px] font-semibold text-slate-600">How was the class with {teacherName || "your teacher"}?</p>

          {error && <div className="text-[11px] text-rose-600 bg-rose-50 rounded-lg p-2">{error}</div>}

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600">Rating</span>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-0.5 text-amber-400 active:scale-95 transition-transform touch-manipulation"
                  title={`${star} star${star > 1 ? "s" : ""}`}
                >
                  <span className="material-symbols-outlined pointer-events-none select-none text-[22px]">
                    {star <= rating ? "star" : "star_border"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-slate-600">Understanding</span>
            <div className="grid grid-cols-4 gap-1">
              {[
                { key: "POOR", label: "Difficult" },
                { key: "AVERAGE", label: "Okay" },
                { key: "GOOD", label: "Good" },
                { key: "EXCELLENT", label: "Clear" },
              ].map((opt) => (
                <button key={opt.key} type="button" onClick={() => setUnderstandingLevel(opt.key as any)} className={chip(understandingLevel === opt.key)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-slate-600">Doubts</span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { key: "NONE", label: "No doubts" },
                { key: "ALL_RESOLVED", label: "Resolved" },
                { key: "SOME_UNRESOLVED", label: "Some left" },
              ].map((opt) => (
                <button key={opt.key} type="button" onClick={() => setDoubtStatus(opt.key as any)} className={chip(doubtStatus === opt.key)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Note for the teacher (optional)"
            className="w-full h-14 bg-slate-50 rounded-lg p-2 text-[11px] text-slate-900 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />

          <div className="flex items-center justify-between">
            <Link href="/schedule" className="text-[11px] text-slate-500 hover:text-slate-900">
              Skip
            </Link>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
