"use client";

import { useState } from "react";
import { SummaryView } from "./SummaryView";
import { SummaryLanguageTabs } from "./SummaryLanguageTabs";

/**
 * The lecture summary on the student's watch page: the teacher's published
 * summaries (one per language, tabs), or a "Get summary" button that asks for one (an AI summary of the
 * teacher's notes, marked as not yet checked by the teacher).
 */
export function StudentSummaryPanel({ lectureId, published }: { lectureId: string; published: { language: string; content: string }[] }) {
  const [content, setContent] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const hasPublished = published.length > 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSummary = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/recorded-lectures/${lectureId}/summary`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(typeof json.error === "string" ? json.error : "The summary could not be made right now. Try again in a minute.");
        return;
      }
      setContent(json.data.content);
      setReviewed(Boolean(json.data.reviewed));
    } catch {
      setError("Network problem. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">summarize</span>
          Lecture Summary
        </h2>
        {!content && !hasPublished && (
          <button
            type="button"
            onClick={getSummary}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold px-4 py-2"
          >
            <span className={`material-symbols-outlined text-base ${busy ? "animate-spin" : ""}`}>{busy ? "progress_activity" : "auto_awesome"}</span>
            {busy ? "Making summary…" : "Get summary"}
          </button>
        )}
      </div>
      {hasPublished ? (
        <SummaryLanguageTabs summaries={published} />
      ) : content ? (
        <>
          {!reviewed && (
            <p className="text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 rounded-lg px-3 py-2">
              AI summary from the teacher&apos;s notes — not yet checked by the teacher.
            </p>
          )}
          <SummaryView markdown={content} />
        </>
      ) : (
        <p className="text-sm text-slate-500">Press “Get summary” for the key points of this lecture.</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  );
}
