"use client";

import { useRef, useState } from "react";
import { SUBJECT_OPTIONS } from "@/lib/validation/doubt";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Submits into the existing Doubt inbox (/api/doubts) with classroomSessionId
 * set — reuses the same model/queue/team Doubt Desk as every other doubt in
 * the app, per "reuse the existing doubt system, do not duplicate it."
 */
export function DoubtPanel({ classroomSessionId }: { classroomSessionId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) return setError("Please choose a JPG, PNG or WEBP image.");
    if (file.size > MAX_ATTACHMENT_BYTES) return setError("Image is too large — keep it under 5MB.");

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("attachment", file);
      const res = await fetch("/api/doubts/attachment", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) return setError(json.error ?? "Could not upload this image.");
      setAttachmentUrl(json.data.url);
    } catch {
      setError("Something went wrong uploading the image.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (body.trim().length < 10) return setError("Describe your doubt in at least 10 characters.");
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject || undefined,
          body,
          attachmentUrl: attachmentUrl ?? undefined,
          classroomSessionId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return setError(json.error ?? "Could not submit your doubt.");
      setSuccess(true);
      setBody("");
      setAttachmentUrl(null);
      setTimeout(() => setSuccess(false), 6000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      {success && (
        <div className="rounded-xl bg-emerald-900/20 border border-emerald-700/40 px-3 py-2 text-xs text-emerald-300">
          Doubt submitted — a subject expert will get back to you soon.
        </div>
      )}
      {error && <div className="rounded-xl bg-rose-900/20 border border-rose-700/40 px-3 py-2 text-xs text-rose-300">{error}</div>}

      <select
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full rounded-xl border border-[#2d2e3b] bg-[#10131b] text-white px-3 py-2 text-sm outline-none"
      >
        <option value="">Not sure / general</option>
        {SUBJECT_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <textarea
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Describe what you're stuck on..."
        className="w-full rounded-xl border border-[#2d2e3b] bg-[#10131b] text-white placeholder:text-gray-500 px-3 py-2 text-sm outline-none resize-none"
      />

      {attachmentUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- external object storage URL */}
          <img src={attachmentUrl} alt="Attached" className="w-16 h-16 rounded-lg object-cover border border-[#2d2e3b]" />
          <button type="button" onClick={() => setAttachmentUrl(null)} className="text-xs text-rose-400">
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[#2d2e3b] text-gray-400 hover:text-white text-xs transition disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-base">{uploading ? "progress_activity" : "add_photo_alternate"}</span>
          {uploading ? "Uploading..." : "Add photo"}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAttachmentChange} className="hidden" />

      <button
        type="button"
        onClick={submit}
        disabled={submitting || uploading}
        className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 transition"
      >
        {submitting ? "Submitting..." : "Submit Doubt"}
      </button>
    </div>
  );
}
