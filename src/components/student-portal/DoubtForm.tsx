"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { doubtCreateSchema, type DoubtCreateInput, SUBJECT_OPTIONS } from "@/lib/validation/doubt";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB, mirrors the API route's limit
const ALLOWED_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function DoubtForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DoubtCreateInput>({ resolver: zodResolver(doubtCreateSchema) });

  async function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setAttachmentError(null);
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      setAttachmentError("Please choose a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError("Image is too large — please keep it under 5MB.");
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("attachment", file);
      const res = await fetch("/api/doubts/attachment", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setAttachmentError(json.error ?? "Could not upload this image.");
        return;
      }
      setAttachmentUrl(json.data.url);
    } catch {
      setAttachmentError("Something went wrong. Please check your connection and try again.");
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function onSubmit(values: DoubtCreateInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, attachmentUrl: attachmentUrl ?? undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not submit your doubt. Please try again.");
        return;
      }
      reset();
      setAttachmentUrl(null);
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h2 className="font-headline-md text-headline-md text-on-surface">Ask a Doubt</h2>

      {success && (
        <div className="bg-tertiary-container/30 border border-tertiary/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-tertiary">
            Submitted! A subject expert will get back to you soon.
          </p>
        </div>
      )}
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Subject (optional)</label>
          <select
            className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            {...register("subject")}
          >
            <option value="">Not sure / general</option>
            {SUBJECT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Your doubt</label>
          <textarea
            rows={4}
            placeholder="Describe what you're stuck on — the more detail, the faster we can help."
            className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            {...register("body")}
          />
          {errors.body && <p className="text-label-sm font-label-sm text-error">{errors.body.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Attach a photo (optional)</label>
          <p className="text-label-sm text-on-surface-variant">
            A photo of the question or your notebook page often helps experts answer faster.
          </p>

          {attachmentUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- uploaded to external object storage, not a next.config image domain */}
              <img
                src={attachmentUrl}
                alt="Attached to your doubt"
                className="w-20 h-20 rounded-lg object-cover border border-outline-variant/40"
              />
              <button
                type="button"
                onClick={() => setAttachmentUrl(null)}
                className="text-label-md font-label-md text-error hover:opacity-80 transition-opacity"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploadingAttachment}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-outline-variant/60 text-on-surface-variant hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-lg">
                {uploadingAttachment ? "progress_activity" : "add_photo_alternate"}
              </span>
              {uploadingAttachment ? "Uploading..." : "Add photo"}
            </button>
          )}
          {attachmentError && <p className="text-label-sm font-label-sm text-error">{attachmentError}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAttachmentChange}
            className="hidden"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || uploadingAttachment}
          className="w-full sm:w-auto bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Doubt"}
        </button>
      </form>
    </div>
  );
}
