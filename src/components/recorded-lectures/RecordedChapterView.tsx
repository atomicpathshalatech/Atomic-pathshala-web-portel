"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { StorageBanner } from "./RecordedLecturesManager";
import { formatBytes } from "./VideoUploadPanel";
import { premiereState } from "@/lib/recorded-lectures/premiere";
import { ChapterViewersPanel } from "./ChapterViewersPanel";

type LectureRow = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  order: number;
  language: string;
  teacher: string;
  uploadStatus: string | null;
  sizeBytes: number;
  durationSec: number | null;
  lectureNumber: number | null;
  archived: boolean;
  summary: "NONE" | "PUBLISHED" | "OUTDATED";
  /** Its live-schedule slot, if scheduled. */
  scheduled?: { startsAt: string; endsAt: string } | null;
};
type ChapterData = {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  subject: { id: string; title: string };
  course: string;
  batches: { id: string; name: string }[];
  lectures: LectureRow[];
};

const VIDEO_STATE: Record<string, { text: string; cls: string }> = {
  PENDING: { text: "No video yet", cls: "text-slate-500" },
  UPLOADING: { text: "Upload unfinished", cls: "text-amber-700 dark:text-amber-300" },
  VERIFYING: { text: "Verifying", cls: "text-blue-700 dark:text-blue-300" },
  READY: { text: "Video ready", cls: "text-emerald-700 dark:text-emerald-300" },
  FAILED: { text: "Upload failed", cls: "text-rose-700 dark:text-rose-300" },
  ABORTED: { text: "Upload cancelled", cls: "text-slate-500" },
};

function minutes(sec: number | null) {
  if (!sec) return null;
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/** One chapter: the batches it is in and its recorded lectures, in order. */
export function RecordedChapterView({ chapterId }: { chapterId: string }) {
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [allBatches, setAllBatches] = useState<{ id: string; name: string }[]>([]);
  const [storage, setStorage] = useState<any>();
  const [error, setError] = useState<string | null>(null);
  const [addBatch, setAddBatch] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/recorded-lectures/chapters/${chapterId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not load the chapter.");
      setChapter(json.data.chapter);
      setTitle(json.data.chapter.title);
      setAllBatches(json.data.allBatches);
      setStorage(json.data.storage);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [chapterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeBatch = async (batchId: string, action: "add" | "remove") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/team/recorded-lectures/chapters/${chapterId}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not change the batches.");
      toast.success(action === "add" ? "Chapter added to the batch." : "Chapter removed from the batch.");
      setAddBatch("");
      setConfirmRemove(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveTitle = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/team/recorded-lectures/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not rename the chapter.");
      setEditingTitle(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p role="alert" className="text-sm text-rose-600">{error}</p>;
  if (!chapter) return <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse max-w-5xl" />;

  const notIn = allBatches.filter((b) => !chapter.batches.some((x) => x.id === b.id));
  const active = chapter.lectures.filter((l) => !l.archived);
  const archived = chapter.lectures.filter((l) => l.archived);

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-2">
        <Link href="/team/recorded-lectures" className="text-xs font-bold text-blue-600 hover:underline">
          ← All chapters
        </Link>
        <p className="text-xs font-bold text-blue-600">
          {chapter.course} › {chapter.subject.title}
          {chapter.code ? <span className="text-slate-400 font-mono"> · {chapter.code}</span> : null}
        </p>
        {editingTitle ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1">
              <span className="sr-only">Chapter name</span>
              <input id="rc-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-lg font-bold" />
            </label>
            <button type="button" disabled={busy || title.trim().length < 2} onClick={saveTitle} className="rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-2 disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={() => { setEditingTitle(false); setTitle(chapter.title); }} className="rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-bold px-4 py-2">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white break-words">{chapter.title}</h1>
            <button type="button" onClick={() => setEditingTitle(true)} aria-label="Rename chapter" className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
          </div>
        )}
      </header>

      <StorageBanner storage={storage} />

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-xl">groups</span>
          Batches
        </h2>
        <p className="text-xs text-slate-500">Students of these batches see this chapter and its published lectures.</p>
        <div className="flex flex-wrap gap-2">
          {chapter.batches.length === 0 && (
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Not in any batch yet — add one so students can see it.</span>
          )}
          {chapter.batches.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 pl-3 pr-1 py-1 text-xs font-bold">
              {b.name}
              {confirmRemove === b.id ? (
                <>
                  <button type="button" disabled={busy} onClick={() => changeBatch(b.id, "remove")} className="rounded-full bg-rose-600 text-white px-2 py-0.5">
                    Remove
                  </button>
                  <button type="button" onClick={() => setConfirmRemove(null)} className="rounded-full px-2 py-0.5 text-slate-500">
                    Keep
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmRemove(b.id)} aria-label={`Remove from ${b.name}`} className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </span>
          ))}
        </div>
        {confirmRemove && (
          <p className="text-xs text-rose-600">Students of that batch will no longer see this chapter (its lectures, DPPs and tests).</p>
        )}
        {notIn.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1">
              <span className="sr-only">Add to batch</span>
              <select id="rc-add-batch" value={addBatch} onChange={(e) => setAddBatch(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm">
                <option value="">Add to a batch…</option>
                {notIn.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={!addBatch || busy} onClick={() => changeBatch(addBatch, "add")} className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2">
              Add
            </button>
          </div>
        )}
      </section>

      {chapter.batches.length > 0 && <ChapterViewersPanel chapterId={chapter.id} batches={chapter.batches} />}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">video_library</span>
            Lectures <span className="text-sm font-mono text-slate-400">{active.length}</span>
          </h2>
          <Link
            href={`/team/recorded-lectures/new?chapterId=${chapter.id}`}
            aria-disabled={storage && !storage.ready}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white ${storage && !storage.ready ? "bg-slate-400 pointer-events-none" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            <span className="material-symbols-outlined text-base">video_call</span>
            Add lecture
          </Link>
        </div>

        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
            No lectures in this chapter yet. Press “Add lecture” to upload the first one.
          </div>
        ) : (
          <ol className="space-y-2">
            {active.map((l, i) => (
              <LectureItem key={l.id} l={l} index={i + 1} />
            ))}
          </ol>
        )}

        {archived.length > 0 && (
          <details className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
            <summary className="cursor-pointer text-sm font-bold text-slate-500">Archived ({archived.length})</summary>
            <ol className="space-y-2 mt-2">
              {archived.map((l, i) => (
                <LectureItem key={l.id} l={l} index={i + 1} />
              ))}
            </ol>
          </details>
        )}
      </section>
    </div>
  );
}

function LectureItem({ l, index }: { l: LectureRow; index: number }) {
  const v = VIDEO_STATE[l.uploadStatus ?? "PENDING"] ?? VIDEO_STATE.PENDING!;
  return (
    <li>
      <Link
        href={`/team/recorded-lectures/${l.id}`}
        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 hover:border-blue-300 dark:hover:border-blue-700 transition"
      >
        <span className="hidden sm:flex w-9 h-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-sm font-black">
          {String(l.lectureNumber ?? index).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 dark:text-white truncate">{l.title}</p>
          <p className="text-xs text-slate-500 truncate">
            {l.teacher} · {l.language}
            {minutes(l.durationSec) ? ` · ${minutes(l.durationSec)}` : ""}
            {l.sizeBytes ? ` · ${formatBytes(l.sizeBytes)}` : ""}
          </p>
          {l.scheduled && (
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">event</span>
              {premiereState(l.scheduled) === "LIVE" ? "Live now · " : premiereState(l.scheduled) === "ENDED" ? "Played on " : "Plays "}
              {new Date(l.scheduled.startsAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
          <span className={`font-semibold ${v.cls}`}>{v.text}</span>
          <span
            className={`rounded-full px-2 py-0.5 font-bold ${
              l.archived ? "bg-slate-200 text-slate-600 dark:bg-slate-800" : l.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {l.archived ? "Archived" : l.status === "PUBLISHED" ? "Published" : "Draft"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-bold ${
              l.summary === "PUBLISHED" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : l.summary === "OUTDATED" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
            }`}
          >
            {l.summary === "PUBLISHED" ? "Summary live" : l.summary === "OUTDATED" ? "Summary outdated" : "No summary"}
          </span>
        </div>
      </Link>
    </li>
  );
}
