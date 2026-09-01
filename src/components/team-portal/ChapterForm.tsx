"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { chapterSchema, type ChapterInput } from "@/lib/validation/chapter";

type SubjectOption = { id: string; title: string; courseTitle: string };

export function ChapterForm({ subjects }: { subjects: SubjectOption[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChapterInput>({
    resolver: zodResolver(chapterSchema),
    defaultValues: { order: 0 },
  });

  async function onSubmit(values: ChapterInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/team/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not create the chapter. Please check the fields.");
        return;
      }

      router.push(`/team/chapters/${body.data.chapter.id}`);
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-gutter" noValidate>
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
        <div>
          <label className={labelClass}>Chapter Title</label>
          <input className={inputClass} placeholder="Chemical Kinetics & Reaction Rates" {...register("title")} />
          {errors.title && <p className={errorClass}>{errors.title.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Subject</label>
          <select className={inputClass} {...register("subjectId")}>
            <option value="">Select subject...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.courseTitle})
              </option>
            ))}
          </select>
          {errors.subjectId && <p className={errorClass}>{errors.subjectId.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Display Order</label>
          <input type="number" className={inputClass} {...register("order", { valueAsNumber: true })} />
        </div>
      </div>

      <div className="glass-card p-stack-md rounded-xl">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-md shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create Chapter →"}
        </button>
      </div>
    </form>
  );
}

const labelClass = "block text-label-sm font-label-md text-on-surface-variant mb-1.5";
const errorClass = "text-label-sm font-label-sm text-error mt-1";
const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";
