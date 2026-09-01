"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { seriesTestCreateSchema, type SeriesTestCreateInput } from "@/lib/validation/test-series";

/**
 * Inline "add a standalone test" form on a TestSeries detail page. Creates
 * a Test with testSeriesId set and no batchScheduleId, then routes into the
 * existing /team/tests/[id] page — its Section/Question builder is fully
 * generic and works unmodified for standalone tests.
 */
export function SeriesTestCreateForm({ testSeriesId }: { testSeriesId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SeriesTestCreateInput>({
    resolver: zodResolver(seriesTestCreateSchema),
    defaultValues: { durationMin: 60 },
  });

  async function onSubmit(values: SeriesTestCreateInput) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/test-series/${testSeriesId}/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not create the test.");
        return;
      }

      toast.success("Test created. Add sections and questions next.");
      reset();
      setOpen(false);
      router.push(`/team/tests/${body.data.test.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined">add_circle</span>
        Add Test
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="glass-card p-stack-lg rounded-xl space-y-stack-md"
      noValidate
    >
      <div>
        <label className={labelClass}>Test Title</label>
        <input className={inputClass} placeholder="Full Syllabus Test — 01" {...register("title")} />
        {errors.title && <p className={errorClass}>{errors.title.message}</p>}
      </div>
      <div>
        <label className={labelClass}>Duration (minutes)</label>
        <input type="number" className={inputClass} {...register("durationMin", { valueAsNumber: true })} />
        {errors.durationMin && <p className={errorClass}>{errors.durationMin.message}</p>}
      </div>
      <div>
        <label className={labelClass}>Instructions (optional)</label>
        <textarea className={`${inputClass} min-h-[80px]`} {...register("instructions")} />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create Test"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-5 py-2.5 rounded-xl border border-outline-variant font-label-md hover:bg-surface-container-lowest transition-all"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const labelClass = "block text-label-sm font-label-md text-on-surface-variant mb-1.5";
const errorClass = "text-label-sm font-label-sm text-error mt-1";
const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";
