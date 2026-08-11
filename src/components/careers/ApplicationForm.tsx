"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  teacherApplicationSchema,
  type TeacherApplicationInput,
  SUBJECT_EXPERTISE_OPTIONS,
} from "@/lib/validation/teacher";

export function ApplicationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TeacherApplicationInput>({ resolver: zodResolver(teacherApplicationSchema) });

  async function onSubmit(values: TeacherApplicationInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/careers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not submit your application. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-16 h-16 bg-tertiary-container/10 rounded-full flex items-center justify-center mx-auto text-tertiary">
          <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
            check_circle
          </span>
        </div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Application Received</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Thank you for applying to teach at Atomic Pathshala. Our academic team will review your
          application and reach out if it's a good fit.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 md:p-10 max-w-2xl mx-auto space-y-6">
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full Name" error={errors.fullName?.message}>
            <input className={inputClass} {...register("fullName")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input type="email" className={inputClass} {...register("email")} />
          </Field>
          <Field label="Phone (optional)" error={errors.phone?.message}>
            <input className={inputClass} {...register("phone")} />
          </Field>
          <Field label="Years of Teaching Experience" error={errors.experienceYears?.message}>
            <input type="number" min={0} className={inputClass} {...register("experienceYears")} />
          </Field>
        </div>

        <Field label="Core Subject" error={errors.subject?.message}>
          <select className={inputClass} defaultValue="" {...register("subject")}>
            <option value="" disabled>
              Select subject
            </option>
            {SUBJECT_EXPERTISE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tell us about your teaching background" error={errors.bio?.message}>
          <textarea
            rows={4}
            placeholder="Teaching philosophy, major achievements, student results..."
            className={inputClass}
            {...register("bio")}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Resume link (optional)" error={errors.resumeUrl?.message}>
            <input placeholder="https://..." className={inputClass} {...register("resumeUrl")} />
          </Field>
          <Field label="Portfolio / teaching video link (optional)" error={errors.portfolioUrl?.message}>
            <input placeholder="https://..." className={inputClass} {...register("portfolioUrl")} />
          </Field>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-on-primary font-label-md text-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-label-md text-label-md text-on-surface">{label}</label>
      {children}
      {error && <p className="text-label-sm font-label-sm text-error">{error}</p>}
    </div>
  );
}
