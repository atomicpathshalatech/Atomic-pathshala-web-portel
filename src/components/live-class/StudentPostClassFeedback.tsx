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

  return (
    <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 bg-[#121420] text-white rounded-3xl border border-slate-800 shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/30">
          <span className="material-symbols-outlined text-3xl">school</span>
        </div>
        <h2 className="text-2xl font-black text-white">Class Ended</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          The teacher has concluded this live teaching session for <span className="text-blue-300 font-semibold">{sessionTitle}</span>.
        </p>
      </div>

      {submitted ? (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-3">
          <span className="material-symbols-outlined text-emerald-400 text-3xl">sentiment_very_satisfied</span>
          <h3 className="text-sm font-bold text-emerald-300">Feedback Submitted!</h3>
          <p className="text-xs text-slate-400">
            Your learning feedback has been recorded. Class Notes and the lecture recording will be available in your batch roadmap once processed.
          </p>
          <Link
            href="/schedule"
            className="inline-block mt-3 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30"
          >
            Return to Schedule
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              How was today&apos;s class with {teacherName || "Educator"}?
            </h3>
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-950/60 border border-rose-500/40 rounded-xl p-3">
              {error}
            </div>
          )}

          {/* 1. Concept Understanding */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Concept Understanding</label>
            {/* 4 across is ~70px per cell on a 360px phone, which clips
                "Crystal Clear". Two rows of two below sm. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "POOR", label: "Difficult" },
                { key: "AVERAGE", label: "Okay" },
                { key: "GOOD", label: "Good" },
                { key: "EXCELLENT", label: "Crystal Clear" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setUnderstandingLevel(opt.key as any)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                    understandingLevel === opt.key
                      ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30"
                      : "bg-[#181a28] border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Doubt Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Were your doubts addressed?</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "NONE", label: "No Doubts" },
                { key: "ALL_RESOLVED", label: "All Resolved" },
                { key: "SOME_UNRESOLVED", label: "Some Left" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDoubtStatus(opt.key as any)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                    doubtStatus === opt.key
                      ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30"
                      : "bg-[#181a28] border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Star Rating & Thumbs */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#181a28] border border-slate-800">
            <span className="text-xs font-semibold text-slate-300">Overall Satisfaction</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 text-2xl text-amber-400 active:scale-95 transition-transform touch-manipulation cursor-pointer"
                  title={`${star} star${star > 1 ? "s" : ""}`}
                >
                  <span className="material-symbols-outlined pointer-events-none select-none text-2xl">
                    {star <= rating ? "star" : "star_border"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Optional Comment */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Any feedback or note for the teacher? (Optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell your educator what helped most or what you'd like more practice on..."
              className="w-full h-20 bg-[#181a28] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/schedule"
              className="text-xs text-slate-400 hover:text-white transition underline underline-offset-4"
            >
              Skip
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Learning Review"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
