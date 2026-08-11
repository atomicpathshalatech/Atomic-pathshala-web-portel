"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { doubtCreateSchema, type DoubtCreateInput, SUBJECT_OPTIONS } from "@/lib/validation/doubt";

export function DoubtForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DoubtCreateInput>({ resolver: zodResolver(doubtCreateSchema) });

  async function onSubmit(values: DoubtCreateInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not submit your doubt. Please try again.");
        return;
      }
      reset();
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

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Doubt"}
        </button>
      </form>
    </div>
  );
}
