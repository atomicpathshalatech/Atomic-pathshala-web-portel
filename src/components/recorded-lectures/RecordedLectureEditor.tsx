"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AboutSummaryPanel } from "./AboutSummaryPanel";
import { LectureAiPanel } from "./LectureAiPanel";
import { StorageBanner } from "./RecordedLecturesManager";
import { VideoUploadPanel, formatBytes } from "./VideoUploadPanel";
import { uploadThumbnail } from "./RecordedLectureCreateForm";

type Lecture = {
  id: string;
  title: string;
  language: string;
  status: "DRAFT" | "PUBLISHED";
  order: number;
  teacher: { id: string; name: string };
  chapter: { id: string; title: string };
  subject: { id: string; title: string };
  batch: { id: string; name: string } | null;
  media: {
    uploadStatus: string;
    uploadError: string | null;
    originalFileName: string | null;
    mimeType: string;
    sizeBytes: number;
    durationSec: number | null;
    hasThumbnail: boolean;
    uploadOpen: boolean;
    verifiedAt: string | null;
    lectureNumber: number | null;
    tags: string[];
    additionalNotes: string | null;
    publishedAt: string | null;
    archivedAt: string | null;
  };
  about: { content: string; revision: number; updatedAt: string | null };
  summaries: any[];
};

const field = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm";
const labelText = "text-xs font-bold text-slate-500 uppercase tracking-wide";

function duration(sec: number | null) {
  if (!sec) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function RecordedLectureEditor({ lectureId }: { lectureId: string }) {
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [storage, setStorage] = useState<any>();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; thumbnailUrl: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [transcriptReady, setTranscriptReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not load the lecture.");
      setLecture(json.data.lecture);
      setCanManage(json.data.canManage);
      setStorage(json.data.storage);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [lectureId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (action: "publish" | "unpublish" | "archive" | "restore") => {
    setBusy(action);
    try {
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not change the status.");
      setLecture(json.data.lecture);
      toast.success({ publish: "Published — students can watch it now.", unpublish: "Unpublished — hidden from students.", archive: "Archived.", restore: "Restored as a draft." }[action]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openPreview = async () => {
    setBusy("preview");
    try {
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}/preview`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Preview unavailable.");
      setPreview({ url: json.data.url, thumbnailUrl: json.data.thumbnailUrl });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <p role="alert" className="text-sm text-rose-600">{error}</p>;
  if (!lecture) return <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse max-w-5xl" />;

  const m = lecture.media;
  const ready = m.uploadStatus === "READY";

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-2">
        <Link href={`/team/recorded-lectures/chapters/${lecture.chapter.id}`} className="text-xs font-bold text-blue-600 hover:underline">
          ← {lecture.chapter.title}
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white break-words">
              {m.lectureNumber ? `Lecture ${String(m.lectureNumber).padStart(2, "0")} · ` : ""}
              {lecture.title}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {[lecture.batch?.name, lecture.subject.title, lecture.chapter.title, lecture.teacher.name, lecture.language].filter(Boolean).join(" › ")}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <span
                className={`self-center rounded-full px-2.5 py-1 text-xs font-bold ${m.archivedAt ? "bg-slate-200 text-slate-600" : lecture.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
              >
                {m.archivedAt ? "Archived" : lecture.status === "PUBLISHED" ? "Published" : "Draft"}
              </span>
              {!m.archivedAt && lecture.status === "DRAFT" && (
                <button type="button" disabled={!ready || Boolean(busy)} title={ready ? undefined : "Upload and verify the video first"} onClick={() => setStatus("publish")} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold px-3 py-1.5">
                  Publish
                </button>
              )}
              {!m.archivedAt && lecture.status === "PUBLISHED" && (
                <button type="button" disabled={Boolean(busy)} onClick={() => setStatus("unpublish")} className="rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-bold px-3 py-1.5">
                  Unpublish
                </button>
              )}
              {!m.archivedAt ? (
                <button type="button" disabled={Boolean(busy)} onClick={() => setStatus("archive")} className="rounded-lg border border-rose-300 text-rose-700 dark:text-rose-300 text-sm font-bold px-3 py-1.5">
                  Archive
                </button>
              ) : (
                <button type="button" disabled={Boolean(busy)} onClick={() => setStatus("restore")} className="rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-bold px-3 py-1.5">
                  Restore
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {canManage && <StorageBanner storage={storage} />}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-xl">movie</span>
          Video
        </h2>
        {ready ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {m.originalFileName} · {formatBytes(m.sizeBytes)}
              {duration(m.durationSec) ? ` · ${duration(m.durationSec)}` : ""} · verified{" "}
              {m.verifiedAt ? new Date(m.verifiedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}
            </p>
            {preview ? (
              <video src={preview.url} poster={preview.thumbnailUrl ?? undefined} controls controlsList="nodownload" playsInline className="w-full max-h-[60vh] rounded-xl bg-black" onContextMenu={(e) => e.preventDefault()} />
            ) : (
              <button type="button" onClick={openPreview} disabled={busy === "preview"} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-bold px-3 py-1.5">
                <span className="material-symbols-outlined text-base">play_circle</span>
                {busy === "preview" ? "Loading…" : "Preview video"}
              </button>
            )}
            {canManage && (
              <label className="block text-xs">
                <span className={labelText}>{m.hasThumbnail ? "Replace thumbnail" : "Add thumbnail"}</span>
                <input
                  id="rl-edit-thumb"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      await uploadThumbnail(lectureId, f);
                      toast.success("Thumbnail saved.");
                      void load();
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                  className="mt-1 block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 dark:file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-bold"
                />
              </label>
            )}
          </>
        ) : canManage ? (
          <>
            {m.uploadError && <p className="text-sm text-rose-600">{m.uploadError}</p>}
            {m.uploadStatus === "VERIFYING" ? (
              <p className="text-sm text-slate-500">The upload is being verified. Reload in a minute.</p>
            ) : (
              <VideoUploadPanel lectureId={lectureId} resumeHint={m.uploadStatus === "UPLOADING" && m.uploadOpen} onDone={load} />
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">The video has not been uploaded yet.</p>
        )}
      </section>

      {canManage && <DetailsForm lecture={lecture} onSaved={setLecture} />}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <LectureAiPanel lectureId={lectureId} canStart={canManage} videoReady={m.uploadStatus === "READY"} onTranscriptReady={setTranscriptReady} />
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <AboutSummaryPanel
          lecture={lecture}
          transcriptReady={transcriptReady}
          onLecture={(next) => setLecture((cur) => ({ ...(cur as Lecture), ...next }))}
        />
      </section>
    </div>
  );
}

function DetailsForm({ lecture, onSaved }: { lecture: Lecture; onSaved: (l: Lecture) => void }) {
  const [options, setOptions] = useState<any>(null);
  const [teacherId, setTeacherId] = useState(lecture.teacher.id);
  const [title, setTitle] = useState(lecture.title);
  const [language, setLanguage] = useState(lecture.language);
  const [lectureNumber, setLectureNumber] = useState(lecture.media.lectureNumber ? String(lecture.media.lectureNumber) : "");
  const [order, setOrder] = useState(String(lecture.order));
  const [tags, setTags] = useState(lecture.media.tags.join(", "));
  const [notes, setNotes] = useState(lecture.media.additionalNotes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/team/recorded-lectures/options?chapterId=${encodeURIComponent(lecture.chapter.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.success && setOptions(j.data))
      .catch(() => null);
  }, [lecture.chapter.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/team/recorded-lectures/${lecture.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          language,
          teacherId,
          lectureNumber: lectureNumber ? Number(lectureNumber) : null,
          sequenceNumber: order ? Number(order) : null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          additionalNotes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not save.");
      onSaved(json.data.lecture);
      toast.success("Details saved.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
      <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span className="material-symbols-outlined text-blue-600 text-xl">tune</span>
        Details
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelText}>Title</span>
          <input id="rl-edit-title" required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block">
          <span className={labelText}>Teacher</span>
          <select id="rl-edit-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={`${field} mt-1`}>
            {options?.teachers?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelText}>Language</span>
          <select id="rl-edit-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className={`${field} mt-1`}>
            <option>Hindi</option>
            <option>English</option>
            <option>Bilingual</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelText}>Lecture no.</span>
            <input id="rl-edit-number" type="number" min={1} value={lectureNumber} onChange={(e) => setLectureNumber(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block">
            <span className={labelText}>Order</span>
            <input id="rl-edit-order" type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} className={`${field} mt-1`} />
          </label>
        </div>
        <label className="block">
          <span className={labelText}>Tags</span>
          <input id="rl-edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelText}>Additional notes (staff only)</span>
          <textarea id="rl-edit-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2">
          {saving ? "Saving…" : "Save details"}
        </button>
      </div>
    </form>
  );
}
