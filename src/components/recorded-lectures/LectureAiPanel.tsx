"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type AiJob = {
  status: "QUEUED" | "TRANSFERRING" | "AI_PREPARING" | "TRANSCRIBING" | "TRANSLATING" | "VOICING" | "READY" | "FAILED";
  stepNote: string | null;
  percent: number;
  error: string | null;
  retryAt: string | null;
  sourceLanguage: string;
  windowsDone: number;
  windowsTotal: number;
  segments: number;
  boardNotes: number;
  dictatedNotes: number;
  durationSec: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  transcriptReady: boolean;
};

/**
 * The lecture's AI pass: reads the video for what the teacher writes on the
 * board, dictates and says. Class notes, a video summary and subtitles are
 * made from it. The teacher's voice is never changed. Runs in the
 * background; this panel only shows progress (polled every 10 s).
 */
export function LectureAiPanel({
  lectureId,
  canStart,
  videoReady,
  onTranscriptReady,
}: {
  lectureId: string;
  canStart: boolean;
  videoReady: boolean;
  onTranscriptReady: (ready: boolean) => void;
}) {
  const [job, setJob] = useState<AiJob | null | undefined>(undefined);
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}/ai`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) return;
      const next = json.data.job as AiJob | null;
      setJob(next);
      onTranscriptReady(Boolean(next?.transcriptReady));
      if (timer.current) clearTimeout(timer.current);
      if (next && next.status !== "READY" && next.status !== "FAILED") timer.current = setTimeout(() => void load(), 10_000);
    } catch {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 20_000);
    }
  }, [lectureId, onTranscriptReady]);

  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const start = async () => {
    if (job && !confirm(job.status === "READY" ? "Read the video again? Existing notes and summaries stay; new ones can be made when it finishes." : "Restart the AI processing from the beginning?")) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}/ai`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(typeof json.error === "string" ? json.error : "Could not start.");
      toast.success("AI processing started. It runs in the background — you can leave this page.");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const running = job && job.status !== "READY" && job.status !== "FAILED";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">translate</span>
            Read the video with AI (board + dictation)
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            The AI (Gemini) watches the lecture and writes down everything on the board and everything the teacher dictates. Then you can create class notes
            (handwritten copy) and a summary from it, and students get subtitles. The teacher&apos;s voice is not changed. A 1-hour lecture takes roughly 10–20 minutes.
          </p>
        </div>
        {canStart && (
          <button
            type="button"
            disabled={starting || !videoReady || job === undefined}
            onClick={start}
            title={videoReady ? undefined : "Upload the video first"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-3 py-1.5"
          >
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            {starting ? "Starting…" : !job ? "Process with AI" : running ? "Restart" : job.status === "FAILED" ? "Try again" : "Process again"}
          </button>
        )}
      </div>

      {job === undefined ? null : !job ? (
        <p className="text-sm text-slate-500">{videoReady ? "Not processed yet." : "Upload the video first."}</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-bold text-slate-800 dark:text-slate-100">
              {job.status === "READY" ? "Ready — create the notes and summary below" : job.status === "FAILED" ? "Failed" : job.stepNote || "Working…"}
            </span>
            {running && <span className="text-xs text-slate-500">{job.percent}%</span>}
          </div>
          {running && (
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={job.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.max(3, job.percent)}%` }} />
            </div>
          )}
          {job.error && <p className={`text-xs ${job.status === "FAILED" ? "text-rose-600" : "text-amber-700 dark:text-amber-300"}`}>{job.error}</p>}
          {job.retryAt && running && (
            <p className="text-xs text-slate-500">
              Waiting for AI quota — continues by itself at {new Date(job.retryAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}.
            </p>
          )}
          <ul className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
            {job.windowsTotal > 0 && (
              <li className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                Parts read: {job.windowsDone}/{job.windowsTotal}
              </li>
            )}
            <li className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">Board writing: {job.boardNotes}</li>
            <li className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">Dictated points: {job.dictatedNotes}</li>
            <li className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">Spoken lines: {job.segments}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
