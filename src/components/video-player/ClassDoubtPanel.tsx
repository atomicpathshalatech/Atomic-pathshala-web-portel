"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { VoiceRecorder } from "@/components/doubt/VoiceRecorder";
import { VoicePlayer } from "@/components/doubt/VoicePlayer";
import { SUBJECT_OPTIONS } from "@/lib/validation/doubt";

type MyClassDoubt = {
  id: string;
  body: string;
  status: "OPEN" | "RESOLVED" | "FLAGGED";
  createdAt: string;
  videoTimestampSec: number | null;
  batchScheduleId: string | null;
  attachmentUrl: string | null;
  studentVoiceUrl: string | null;
};

const STATUS_CHIP: Record<MyClassDoubt["status"], { label: string; className: string }> = {
  OPEN: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  RESOLVED: { label: "Answered", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  FLAGGED: { label: "In review", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function matchSubject(subject?: string | null): (typeof SUBJECT_OPTIONS)[number] | undefined {
  const s = (subject || "").toLowerCase();
  if (!s) return undefined;
  if (s.includes("phys")) return "Physics";
  if (s.includes("chem")) return "Chemistry";
  if (s.includes("bio") || s.includes("bot") || s.includes("zoo")) return "Biology";
  if (s.includes("math")) return "Mathematics";
  return undefined;
}

/**
 * "Ask a doubt" for a recorded class: text, a photo and/or a voice note,
 * tagged with the class and the moment in the video. Goes into the same
 * Doubt inbox the Doubt Desk already resolves — no separate queue.
 */
export function ClassDoubtPanel({
  classId,
  subject,
  getCurrentTime,
}: {
  /** BatchSchedule id of the recorded class; "" for a plain lecture. */
  classId: string;
  subject?: string | null;
  getCurrentTime: () => number;
}) {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [voice, setVoice] = useState<{ url: string; durationSec: number } | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [attachTime, setAttachTime] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [myDoubts, setMyDoubts] = useState<MyClassDoubt[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMyDoubts = useCallback(async () => {
    if (!classId) return;
    try {
      const res = await fetch("/api/doubts");
      const json = await res.json();
      if (!res.ok || !json.success) return;
      setMyDoubts(
        (json.data.doubts as MyClassDoubt[]).filter((d) => d.batchScheduleId === classId)
      );
    } catch {
      // The list is a convenience; the form still works without it.
    }
  }, [classId]);

  useEffect(() => {
    loadMyDoubts();
  }, [loadMyDoubts]);

  async function handleImagePicked(file: File | undefined) {
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("attachment", file);
      const res = await fetch("/api/doubts/attachment", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not upload the photo.");
      setImageUrl(json.data.url);
    } catch (err: any) {
      toast.error(err?.message || "Could not upload the photo.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const trimmed = text.trim();
  const canSubmit = !submitting && !uploadingImage && (trimmed.length >= 10 || Boolean(imageUrl) || Boolean(voice));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      if (trimmed.length > 0 && trimmed.length < 10) toast.error("Please write at least 10 characters, or add a photo / voice note.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          subject: matchSubject(subject),
          attachmentUrl: imageUrl || undefined,
          studentVoiceUrl: voice?.url,
          studentVoiceDurationSec: voice ? Math.min(600, Math.max(1, Math.round(voice.durationSec))) : undefined,
          batchScheduleId: classId || undefined,
          videoTimestampSec: attachTime ? Math.floor(getCurrentTime()) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not send your doubt.");
      toast.success("Doubt sent! Your teacher will answer it soon.");
      setText("");
      setImageUrl(null);
      setVoice(null);
      setShowRecorder(false);
      loadMyDoubts();
    } catch (err: any) {
      toast.error(err?.message || "Could not send your doubt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder="Type your doubt from this class… (or send a photo / voice note)"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 resize-none"
        />

        {imageUrl && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element -- uploaded to external object storage */}
            <img src={imageUrl} alt="Doubt photo" className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700" />
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center"
              aria-label="Remove photo"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {voice && (
          <div className="flex items-start gap-2">
            <VoicePlayer url={voice.url} durationSec={voice.durationSec} title="Your voice note" className="flex-1" />
            <button
              type="button"
              onClick={() => setVoice(null)}
              className="mt-2 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 flex items-center justify-center shrink-0"
              aria-label="Remove voice note"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        )}

        {showRecorder && !voice && (
          <VoiceRecorder
            title="Record your doubt"
            subtitle="Speak your question (max 10 min)"
            attachLabel="Attach voice note"
            successMessage="Voice note attached"
            onRecorded={(r) => {
              setVoice(r);
              setShowRecorder(false);
            }}
            onCancel={() => setShowRecorder(false)}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleImagePicked(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage || Boolean(imageUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">{uploadingImage ? "progress_activity" : "add_photo_alternate"}</span>
            {uploadingImage ? "Uploading…" : "Photo"}
          </button>
          <button
            type="button"
            onClick={() => setShowRecorder(true)}
            disabled={showRecorder || Boolean(voice)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">mic</span>
            Voice
          </button>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={attachTime}
              onChange={(e) => setAttachTime(e.target.checked)}
              className="accent-blue-600"
            />
            Tag current video time
          </label>
          <button
            type="submit"
            disabled={!canSubmit}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">send</span>
            {submitting ? "Sending…" : "Send Doubt"}
          </button>
        </div>
      </form>

      {myDoubts && myDoubts.length > 0 && (
        <div className="flex flex-col gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Your doubts from this class
          </h4>
          {myDoubts.map((d) => {
            const chip = STATUS_CHIP[d.status] ?? STATUS_CHIP.OPEN;
            return (
              <Link
                key={d.id}
                href={`/doubts/${d.id}`}
                className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition"
              >
                <div className="min-w-0 flex flex-col gap-1">
                  <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2">{d.body}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-2">
                    {d.videoTimestampSec != null && <span>@ {formatClock(d.videoTimestampSec)}</span>}
                    {d.attachmentUrl && <span className="material-symbols-outlined text-xs">photo</span>}
                    {d.studentVoiceUrl && <span className="material-symbols-outlined text-xs">mic</span>}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${chip.className}`}>{chip.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
