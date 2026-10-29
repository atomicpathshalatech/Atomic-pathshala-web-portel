"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { StorageBanner } from "./RecordedLecturesManager";
import { VideoUploadPanel, formatBytes } from "./VideoUploadPanel";
import { parseIstLocal } from "@/lib/recorded-lectures/premiere";

type Teacher = { id: string; name: string; inBatch: boolean; subjectMatch?: boolean };
type ChapterInfo = { id: string; title: string; subject: { title: string }; course: string; batches: { id: string; name: string }[]; lectures: unknown[] };

const field = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm";
const labelText = "text-xs font-bold text-slate-500 uppercase tracking-wide";

/** Uploads a thumbnail image to the lecture (optional). */
export async function uploadThumbnail(lectureId: string, file: File) {
  const post = async (body: unknown) => {
    const res = await fetch(`/api/team/recorded-lectures/${lectureId}/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || "Thumbnail upload failed.");
    return json.data;
  };
  const { key, url } = await post({ action: "thumbnail", type: file.type, size: file.size });
  const put = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("Thumbnail upload failed.");
  await post({ action: "thumbnail-done", key });
}

/**
 * Adds a lecture inside a chapter: the chapter (and so its subject and
 * batches) is already chosen — only the lecture's own details and video.
 */
export function RecordedLectureCreateForm({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const [chapter, setChapter] = useState<ChapterInfo | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [storage, setStorage] = useState<{ ready: boolean; problems: string[]; maxBytes: number } | undefined>();
  const [teacherId, setTeacherId] = useState("");
  const [title, setTitle] = useState("");
  const [lectureNumber, setLectureNumber] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [about, setAbout] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  // draft | publish when verified | schedule: plays live at a date and time (publishes it for that time).
  const [release, setRelease] = useState<"draft" | "publish" | "schedule">("draft");
  const [scheduleAt, setScheduleAt] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [requestId] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`).replace(/[^a-zA-Z0-9_-]/g, ""));
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/team/recorded-lectures/chapters/${chapterId}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/team/recorded-lectures/options?chapterId=${encodeURIComponent(chapterId)}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([c, o]) => {
        if (!c.success) throw new Error(c.error || "Chapter not found.");
        if (!o.success) throw new Error(o.error || "Could not load the form.");
        setChapter(c.data.chapter);
        // Next lecture number: after the chapter's existing lectures.
        setLectureNumber(String((c.data.chapter.lectures?.length ?? 0) + 1));
        setTeachers(o.data.teachers);
        setStorage(o.data.storage);
      })
      .catch((err) => setError((err as Error).message));
  }, [chapterId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!video) return setError("Choose the recorded video file.");
    if (storage && video.size > storage.maxBytes) return setError(`The video is ${formatBytes(video.size)}; the limit is ${formatBytes(storage.maxBytes)}.`);
    if (release === "schedule") {
      const at = parseIstLocal(scheduleAt);
      if (!at) return setError("Choose the date and time the lecture plays.");
      if (at.getTime() <= Date.now()) return setError("Choose a date and time that has not passed yet.");
      if (!chapter?.batches.length) return setError("This chapter is not in any batch yet, so the lecture cannot be scheduled. Add the chapter to a batch first.");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/team/recorded-lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          title,
          chapterId,
          teacherId,
          language,
          about,
          lectureNumber: lectureNumber ? Number(lectureNumber) : null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          additionalNotes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const issues = json.issues ? Object.values(json.issues).flat().join(" ") : "";
        throw new Error([json.error, issues].filter(Boolean).join(" — ") || "Could not save the lecture.");
      }
      setLectureId(json.data.lectureId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const afterUpload = async () => {
    if (!lectureId) return;
    if (thumb) await uploadThumbnail(lectureId, thumb).catch((err) => toast.error(`Video saved; thumbnail failed: ${(err as Error).message}`));
    if (release === "schedule") {
      // Into the chapter's batches' live schedule at the chosen time (this also publishes it for that time).
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: scheduleAt }) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) toast.success(`Uploaded and scheduled for ${new Date(parseIstLocal(scheduleAt)!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.`);
      else toast.error(`Uploaded, but scheduling failed: ${json.error || "try again"} — set the time on the lecture page.`);
      router.push(`/team/recorded-lectures/${lectureId}`);
      return;
    }
    if (release === "publish") {
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) toast.success("Uploaded, verified and published.");
      else toast.error(json.error || "Uploaded, but publishing failed — publish it from the lecture page.");
    } else {
      toast.success("Uploaded and verified. The lecture is a draft until you publish it.");
    }
    router.push(`/team/recorded-lectures/chapters/${chapterId}`);
  };

  if (error && !chapter) return <p role="alert" className="text-sm text-rose-600">{error}</p>;
  if (!chapter) return <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse max-w-4xl" />;

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <Link href={`/team/recorded-lectures/chapters/${chapterId}`} className="text-xs font-bold text-blue-600 hover:underline">
          ← {chapter.title}
        </Link>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">Add lecture</h1>
        <p className="text-sm text-slate-500 mt-1">
          {chapter.course} › {chapter.subject.title} › <b>{chapter.title}</b>
          {chapter.batches.length ? ` · seen by ${chapter.batches.map((b) => b.name).join(", ")}` : " · not in any batch yet"}
        </p>
      </header>

      <StorageBanner storage={storage} />
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      {lectureId ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h2 className="font-bold text-slate-900 dark:text-white">Uploading “{title}”</h2>
          <p className="text-xs text-slate-500">Keep this tab open until it finishes. If it stops, open the lecture in the chapter and choose the same file to resume.</p>
          <VideoUploadPanel lectureId={lectureId} initialFile={video} autoStart onDone={afterUpload} />
        </section>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={!storage?.ready || saving} className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <label className="block sm:col-span-2">
              <span className={labelText}>Lecture title *</span>
              <input id="rl-new-title" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`e.g. ${chapter.title} — Lecture ${lectureNumber || "01"}`} className={`${field} mt-1`} />
            </label>
            <label className="block">
              <span className={labelText}>Teacher *</span>
              <select id="rl-new-teacher" required value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.inBatch ? " — teaches this batch" : t.subjectMatch ? ` — ${chapter.subject.title}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelText}>Lecture no.</span>
                <input id="rl-new-number" type="number" min={1} value={lectureNumber} onChange={(e) => setLectureNumber(e.target.value)} className={`${field} mt-1`} />
              </label>
              <label className="block">
                <span className={labelText}>Language *</span>
                <select id="rl-new-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className={`${field} mt-1`}>
                  <option>Hindi</option>
                  <option>English</option>
                  <option>Bilingual</option>
                </select>
              </label>
            </div>
            <label className="block sm:col-span-2">
              <span className={labelText}>About this lecture *</span>
              <textarea id="rl-new-about" required rows={6} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What was taught: topics, concepts, formulas ($...$), examples, exam points, homework. The lecture summary is made from this." className={`${field} mt-1 font-mono`} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelText}>Recorded video *</span>
              <input id="rl-new-video" required type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white file:text-xs file:font-bold" />
              {video && <span className="text-xs text-slate-500">{video.name} · {formatBytes(video.size)}</span>}
            </label>
            <label className="block">
              <span className={labelText}>Thumbnail (optional)</span>
              <input id="rl-new-thumb" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setThumb(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 dark:file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-bold" />
            </label>
            <label className="block">
              <span className={labelText}>Tags</span>
              <input id="rl-new-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma separated" className={`${field} mt-1`} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelText}>Additional notes (staff only)</span>
              <textarea id="rl-new-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} mt-1`} />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className={labelText}>Publication *</legend>
              <div className="mt-2 flex flex-col sm:flex-row gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="rl-publish" checked={release === "draft"} onChange={() => setRelease("draft")} /> Save as draft
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="rl-publish" checked={release === "publish"} onChange={() => setRelease("publish")} /> Publish when the upload is verified
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="rl-publish" checked={release === "schedule"} onChange={() => setRelease("schedule")} /> Schedule date &amp; time
                </label>
              </div>
              {release === "schedule" && (
                <div className="mt-3 space-y-1">
                  <label className="block max-w-xs">
                    <span className={labelText}>Plays live on (India time) *</span>
                    <input id="rl-new-schedule" type="datetime-local" required value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <p className="text-xs text-slate-500">
                    It goes into the live schedule of {chapter.batches.length ? chapter.batches.map((b) => b.name).join(", ") : "the chapter's batches"} and plays like a live
                    class at that time; students cannot play it before. Keep this tab open until the upload finishes.
                  </p>
                </div>
              )}
            </fieldset>
          </fieldset>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !storage?.ready} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5">
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              {saving ? "Saving…" : "Save and upload video"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
