"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SummaryView } from "./SummaryView";
import { SummaryLanguageTabs } from "./SummaryLanguageTabs";
import { HandwrittenNotes } from "./HandwrittenNotes";

type Part = { content: string; reviewed: boolean } | null;
type Progress = { done: number; total: number; note: string | null };

/**
 * The lecture summary on the student's watch page. The teacher's published
 * summaries (tabs per language), or "Get summary": the AI reads the lecture
 * video (speech + board + dictation) and makes a summary and class notes.
 * The first time takes a while (the AI reads the whole video); the panel
 * shows the progress and keeps asking until it is ready.
 */
export function StudentSummaryPanel({
  lectureId,
  published,
  hasPublishedNotes = false,
}: {
  lectureId: string;
  published: { language: string; content: string }[];
  hasPublishedNotes?: boolean;
}) {
  const [summary, setSummary] = useState<Part>(null);
  const [notes, setNotes] = useState<Part>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPublished = published.length > 0;

  const ask = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/recorded-lectures/${lectureId}/summary`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setProgress(null);
        setError(typeof json.error === "string" ? json.error : "The summary could not be made right now. Try again in a minute.");
        return;
      }
      setSummary(json.data.summary ?? null);
      setNotes(json.data.notes ?? null);
      if (json.data.state === "PROCESSING") {
        setProgress(json.data.progress);
        // The AI is still reading the video: ask again shortly.
        timer.current = setTimeout(() => void ask(), 20000);
      } else {
        setProgress(null);
      }
    } catch {
      setError("Network problem. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [lectureId]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const working = busy || progress !== null;
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null;
  const showNotes = notes && !hasPublishedNotes;

  return (
    <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">summarize</span>
          Lecture Summary
        </h2>
        {!summary && !hasPublished && (
          <button
            type="button"
            onClick={() => void ask()}
            disabled={working}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold px-4 py-2"
          >
            <span className={`material-symbols-outlined text-base ${working ? "animate-spin" : ""}`}>{working ? "progress_activity" : "auto_awesome"}</span>
            {working ? "Making summary…" : "Get summary"}
          </button>
        )}
      </div>

      {progress && !summary && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 px-3 py-3 space-y-2">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            AI is watching the lecture{pct !== null ? ` — ${pct}%` : ""}. The first time takes about 10–20 minutes; you can keep watching meanwhile.
          </p>
          <div className="h-2 rounded-full bg-blue-100 dark:bg-blue-900 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct ?? 5}%` }} />
          </div>
        </div>
      )}

      {hasPublished ? (
        <SummaryLanguageTabs summaries={published} />
      ) : summary ? (
        <>
          {!summary.reviewed && (
            <p className="text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 rounded-lg px-3 py-2">
              AI summary from the lecture video — not yet checked by the teacher.
            </p>
          )}
          <SummaryView markdown={summary.content} />
        </>
      ) : !progress ? (
        <p className="text-sm text-slate-500">Press “Get summary” — the AI reads this lecture (what the teacher said and wrote on the board) and gives the key points and class notes.</p>
      ) : null}

      {showNotes && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">stylus_note</span>
            Class Notes
          </h3>
          {!notes.reviewed && <p className="text-xs text-amber-700 dark:text-amber-300">From the board and dictation by AI — not yet checked by the teacher.</p>}
          <HandwrittenNotes markdown={notes.content} />
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  );
}
