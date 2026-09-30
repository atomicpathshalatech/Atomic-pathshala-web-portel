"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadFileToR2 } from "@/lib/storage/upload-client";
import { parseYouTubeVideoId } from "@/lib/youtube/video-link";
import { formatISTDate, formatISTTime, parseISTDateTimeInput, toISTDateTimeLocal } from "@/lib/date-utils";

type ChapterOption = { id: string; title: string; subject: string; status: string; visibleToStudents: boolean };
type TeacherOption = { id: string; name: string; subject: string | null };
type Added = { title: string; startsAt: string; chapter: string; hasNotes: boolean };

const inputClass =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest py-2.5 px-3.5 text-body-sm outline-none focus:ring-2 focus:ring-primary/30";
const DURATIONS = [45, 60, 90, 120];

/**
 * "Add past class": a class that already happened (on YouTube) goes into the
 * batch on its real date — YouTube video + notes PDF in its chapter, and a
 * completed entry in the timetable. Nobody is notified.
 */
export function PastClassForm({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const router = useRouter();
  const [chapters, setChapters] = useState<ChapterOption[] | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [chapterId, setChapterId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [language, setLanguage] = useState<"Hinglish" | "Hindi" | "English">("Hinglish");
  const [pdf, setPdf] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // A PDF already uploaded for this file (a failed save must not upload it twice).
  const uploadedRef = useRef<{ file: File; assetId: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added[]>([]);

  useEffect(() => {
    fetch(`/api/team/batches/${batchId}/past-classes`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) throw new Error(j.error || "Could not load chapters.");
        setChapters(j.data.chapters);
        setTeachers(j.data.teachers);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load chapters."));
  }, [batchId]);

  const videoId = useMemo(() => (youtubeUrl.trim() ? parseYouTubeVideoId(youtubeUrl) : null), [youtubeUrl]);
  const chapter = chapters?.find((c) => c.id === chapterId) ?? null;
  const subjects = useMemo(() => Array.from(new Set((chapters ?? []).map((c) => c.subject))), [chapters]);
  const maxDate = toISTDateTimeLocal(new Date());

  // A teacher who teaches the chapter's subject is the likely one.
  useEffect(() => {
    if (!chapter || teacherId) return;
    const match = teachers.find((t) => t.subject && t.subject.toLowerCase() === chapter.subject.toLowerCase());
    if (match) setTeacherId(match.id);
  }, [chapter, teacherId, teachers]);

  async function save() {
    setError(null);
    if (!startsAt) return setError("Pick the date and time the class happened.");
    if (!chapterId) return setError("Choose the chapter.");
    if (!teacherId) return setError("Choose the teacher.");
    if (title.trim().length < 2) return setError("Write the class title.");
    if (!videoId) return setError("Paste a YouTube video link.");
    if (pdf && pdf.type !== "application/pdf" && !pdf.name.toLowerCase().endsWith(".pdf")) return setError("Notes must be a PDF file.");

    setSaving(true);
    try {
      let notesFileAssetId: string | undefined;
      if (pdf) {
        if (uploadedRef.current?.file === pdf) {
          notesFileAssetId = uploadedRef.current.assetId;
        } else {
          setProgress(0);
          const up = await uploadFileToR2(pdf, {
            prefix: "notes",
            fileType: "NOTES",
            subPath: "class-notes",
            entityId: batchId,
            visibility: "PROTECTED",
            onProgress: setProgress,
          });
          uploadedRef.current = { file: pdf, assetId: up.fileAssetId };
          notesFileAssetId = up.fileAssetId;
        }
      }

      const res = await fetch(`/api/team/batches/${batchId}/past-classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId,
          teacherId,
          title: title.trim(),
          startsAt: parseISTDateTimeInput(startsAt).toISOString(),
          durationMin,
          youtubeUrl,
          notesFileAssetId,
          language,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Could not save the class.");

      setAdded((prev) => [
        { title: title.trim(), startsAt: parseISTDateTimeInput(startsAt).toISOString(), chapter: chapter?.title ?? "", hasNotes: Boolean(notesFileAssetId) },
        ...prev,
      ]);
      // Ready for the next class: same chapter/teacher/duration, next day, same time.
      const next = new Date(parseISTDateTimeInput(startsAt).getTime() + 24 * 60 * 60_000);
      setStartsAt(next.getTime() <= Date.now() ? toISTDateTimeLocal(next) : "");
      setTitle("");
      setYoutubeUrl("");
      setPdf(null);
      uploadedRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the class.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  return (
    <div className="border border-outline-variant/30 bg-surface-container-high/20 rounded-3xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-3">
        <div>
          <h4 className="font-bold text-sm text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-base">history</span>
            Add Past Class (recorded on YouTube)
          </h4>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Goes into the timetable on its real date as Completed, and into its chapter with the video and notes. Students are not notified.
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-high" title="Close">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {loadError && <p className="text-xs text-error font-semibold">{loadError}</p>}
      {!chapters && !loadError && <p className="text-xs text-on-surface-variant">Loading chapters…</p>}

      {chapters && (
        <>
          {chapters.length === 0 && (
            <p className="text-xs text-error">
              This batch has no chapters yet. Create the chapter under Team → Chapters (and assign it to this batch) first.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Class date &amp; time (IST) *</label>
              <input type="datetime-local" className={inputClass} max={maxDate} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Duration *</label>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationMin(d)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                      durationMin === d ? "bg-primary text-on-primary" : "bg-surface-container-lowest border border-outline-variant/30 text-on-surface"
                    }`}
                  >
                    {d} min
                  </button>
                ))}
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={durationMin}
                  onChange={(e) => setDurationMin(Math.max(10, Math.min(600, Number(e.target.value) || 60)))}
                  className={`${inputClass} !w-24`}
                  title="Minutes"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Chapter *</label>
              <select className={inputClass} value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                <option value="">Choose chapter…</option>
                {subjects.map((s) => (
                  <optgroup key={s} label={s}>
                    {chapters
                      .filter((c) => c.subject === s)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                          {c.visibleToStudents ? "" : ` (${c.status.replace(/_/g, " ").toLowerCase()})`}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {chapter && !chapter.visibleToStudents && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  This chapter isn&apos;t published yet, so students won&apos;t see its classes until it is approved/published.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Teacher *</label>
              <select className={inputClass} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Choose teacher…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.subject ? ` — ${t.subject}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-on-surface">Class title *</label>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={chapter ? `e.g. ${chapter.title} — Lecture 3` : "e.g. Cell: The Unit of Life — Lecture 3"}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-on-surface">YouTube video link *</label>
              <div className="flex gap-3 items-start">
                <input
                  className={inputClass}
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtu.be/…  or  https://www.youtube.com/watch?v=…  or  /live/…"
                />
                {videoId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                    alt="Video thumbnail"
                    className="w-28 aspect-video rounded-lg object-cover border border-outline-variant/30 shrink-0"
                  />
                )}
              </div>
              {youtubeUrl.trim() && !videoId && <p className="text-[11px] text-error">That doesn&apos;t look like a YouTube video link.</p>}
              <p className="text-[11px] text-on-surface-variant">
                Keep the video Unlisted with &quot;Allow embedding&quot; on — it plays inside the app, not on YouTube.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Class notes PDF (optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-on-surface file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:text-on-primary"
              />
              <p className="text-[11px] text-on-surface-variant">Saved in this batch under Materials → Class Notes → {chapter?.subject ?? "Subject"}.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface">Language</label>
              <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
                <option>Hinglish</option>
                <option>Hindi</option>
                <option>English</option>
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-error font-semibold">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || chapters.length === 0}
              className="px-5 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">{saving ? "progress_activity" : "save"}</span>
              {saving ? (progress !== null && progress < 100 ? `Uploading PDF ${progress}%` : "Saving…") : "Save past class"}
            </button>
            <span className="text-[11px] text-on-surface-variant">After saving, the form is ready for the next day&apos;s class.</span>
          </div>

          {added.length > 0 && (
            <div className="border-t border-outline-variant/20 pt-3 space-y-1.5">
              <p className="text-xs font-bold text-on-surface">Added now ({added.length})</p>
              <ul className="space-y-1">
                {added.map((a, i) => (
                  <li key={i} className="text-xs text-on-surface-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
                    <span className="font-semibold text-on-surface">{a.title}</span>
                    <span>
                      · {formatISTDate(a.startsAt)} {formatISTTime(a.startsAt)} · {a.chapter}
                      {a.hasNotes ? " · notes PDF" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
