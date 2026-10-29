"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { StorageBanner } from "./RecordedLecturesManager";
import { VideoUploadPanel, formatBytes } from "./VideoUploadPanel";

type Options = {
  storage: { ready: boolean; problems: string[]; maxBytes: number };
  batches: { id: string; name: string }[];
  subjects: { id: string; title: string; chapters: { id: string; title: string }[] }[];
  teachers: { id: string; name: string; subjects: string[]; inBatch: boolean }[];
};

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

export function RecordedLectureCreateForm() {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [batchId, setBatchId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [title, setTitle] = useState("");
  const [lectureNumber, setLectureNumber] = useState("");
  const [sequence, setSequence] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [about, setAbout] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [publishWhenReady, setPublishWhenReady] = useState(false);
  const [video, setVideo] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [requestId] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`).replace(/[^a-zA-Z0-9_-]/g, ""));
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sp = batchId ? `?batchId=${encodeURIComponent(batchId)}` : "";
    fetch(`/api/team/recorded-lectures/options${sp}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setOptions(j.data);
        else setError(j.error || "Could not load the form.");
      })
      .catch(() => setError("Could not load the form."));
  }, [batchId]);

  const chapters = useMemo(() => options?.subjects.find((s) => s.id === subjectId)?.chapters ?? [], [options, subjectId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!video) return setError("Choose the recorded video file.");
    if (options && video.size > options.storage.maxBytes) return setError(`The video is ${formatBytes(video.size)}; the limit is ${formatBytes(options.storage.maxBytes)}.`);
    setSaving(true);
    try {
      const res = await fetch("/api/team/recorded-lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          title,
          batchId,
          chapterId,
          teacherId,
          language,
          about,
          lectureNumber: lectureNumber ? Number(lectureNumber) : null,
          sequenceNumber: sequence ? Number(sequence) : null,
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
    if (publishWhenReady) {
      const res = await fetch(`/api/team/recorded-lectures/${lectureId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) toast.success("Uploaded, verified and published.");
      else toast.error(json.error || "Uploaded, but publishing failed — publish it from the lecture page.");
    } else {
      toast.success("Uploaded and verified. The lecture is a draft until you publish it.");
    }
    router.push(`/team/recorded-lectures/${lectureId}`);
  };

  if (!options && !error) return <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse max-w-4xl" />;

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <Link href="/team/recorded-lectures" className="text-xs font-bold text-blue-600 hover:underline">
          ← Recorded Lectures
        </Link>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">Upload recorded lecture</h1>
        <p className="text-sm text-slate-500 mt-1">The video goes to the recorded-lecture storage. Students see it only after it is uploaded, verified and published.</p>
      </header>

      <StorageBanner storage={options?.storage} />
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      {lectureId ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h2 className="font-bold text-slate-900 dark:text-white">Uploading “{title}”</h2>
          <p className="text-xs text-slate-500">Keep this tab open until it finishes. If the upload stops, choose the same file on the lecture page to resume.</p>
          <VideoUploadPanel lectureId={lectureId} initialFile={video} autoStart onDone={afterUpload} />
          <Link href={`/team/recorded-lectures/${lectureId}`} className="text-xs font-bold text-blue-600 hover:underline">
            Open the lecture page
          </Link>
        </section>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={!options?.storage.ready || saving} className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <label className="block">
              <span className={labelText}>Batch *</span>
              <select id="rl-new-batch" required value={batchId} onChange={(e) => { setBatchId(e.target.value); setSubjectId(""); setChapterId(""); }} className={`${field} mt-1`}>
                <option value="">Choose batch</option>
                {options?.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelText}>Subject *</span>
              <select id="rl-new-subject" required value={subjectId} disabled={!batchId} onChange={(e) => { setSubjectId(e.target.value); setChapterId(""); }} className={`${field} mt-1`}>
                <option value="">{batchId ? (options?.subjects.length ? "Choose subject" : "This batch has no chapters yet") : "Choose a batch first"}</option>
                {options?.subjects.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelText}>Chapter *</span>
              <select id="rl-new-chapter" required value={chapterId} disabled={!subjectId} onChange={(e) => setChapterId(e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose chapter</option>
                {chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelText}>Teacher *</span>
              <select id="rl-new-teacher" required value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose teacher</option>
                {options?.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.inBatch ? " (this batch)" : ""}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelText}>Lecture title *</span>
              <input id="rl-new-title" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chemical Bonding — Lecture 03: Fajan's Rule" className={`${field} mt-1`} />
            </label>
            <label className="block">
              <span className={labelText}>Lecture language *</span>
              <select id="rl-new-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className={`${field} mt-1`}>
                <option>Hindi</option>
                <option>English</option>
                <option>Bilingual</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelText}>Lecture no.</span>
                <input id="rl-new-number" type="number" min={1} value={lectureNumber} onChange={(e) => setLectureNumber(e.target.value)} className={`${field} mt-1`} />
              </label>
              <label className="block">
                <span className={labelText}>Order</span>
                <input id="rl-new-seq" type="number" min={0} value={sequence} onChange={(e) => setSequence(e.target.value)} placeholder="auto" className={`${field} mt-1`} />
              </label>
            </div>
            <label className="block sm:col-span-2">
              <span className={labelText}>About this lecture *</span>
              <textarea id="rl-new-about" required rows={6} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What was taught: topics, concepts, formulas ($...$), examples, exam points, homework. The lecture summary is made from this." className={`${field} mt-1 font-mono`} />
            </label>
            <label className="block">
              <span className={labelText}>Tags</span>
              <input id="rl-new-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma separated" className={`${field} mt-1`} />
            </label>
            <label className="block">
              <span className={labelText}>Thumbnail (optional)</span>
              <input id="rl-new-thumb" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setThumb(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 dark:file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-bold" />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelText}>Additional notes (staff only)</span>
              <textarea id="rl-new-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelText}>Recorded video *</span>
              <input id="rl-new-video" required type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white file:text-xs file:font-bold" />
              {video && <span className="text-xs text-slate-500">{video.name} · {formatBytes(video.size)}</span>}
            </label>
            <fieldset className="sm:col-span-2">
              <legend className={labelText}>Publication *</legend>
              <div className="mt-2 flex flex-col sm:flex-row gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="rl-publish" checked={!publishWhenReady} onChange={() => setPublishWhenReady(false)} /> Save as draft
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="rl-publish" checked={publishWhenReady} onChange={() => setPublishWhenReady(true)} /> Publish when the upload is verified
                </label>
              </div>
            </fieldset>
          </fieldset>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !options?.storage.ready} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5">
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              {saving ? "Saving…" : "Save and upload video"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
