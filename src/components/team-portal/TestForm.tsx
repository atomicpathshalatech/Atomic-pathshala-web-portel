"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { testCreateSchema, type TestCreateInput } from "@/lib/validation/test";

type ScheduleOption = {
  id: string;
  title: string;
  batchName: string;
  startsAt: string;
  endsAt: string;
};

type Props =
  | { mode: "create"; scheduleOptions: ScheduleOption[] }
  | {
      mode: "edit";
      testId: string;
      initialData: { title: string; instructions: string | null; durationMin: number };
    };

const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all";

export function TestForm(props: Props) {
  const router = useRouter();
  const isCreate = props.mode === "create";
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TestCreateInput>({
    resolver: zodResolver(testCreateSchema),
    defaultValues: isCreate
      ? { batchScheduleId: "", title: "", instructions: "", durationMin: 60 }
      : {
          batchScheduleId: "placeholder", // unused in edit mode, schema still requires a non-empty string
          title: props.initialData.title,
          instructions: props.initialData.instructions ?? "",
          durationMin: props.initialData.durationMin,
        },
  });

  async function onSubmit(values: TestCreateInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const url = isCreate ? "/api/team/tests" : `/api/team/tests/${(props as { testId: string }).testId}`;
      const body = isCreate
        ? values
        : { title: values.title, instructions: values.instructions, durationMin: values.durationMin };
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setServerError(json.error ?? "Could not save this test.");
        return;
      }
      const testId = isCreate ? json.data.test.id : (props as { testId: string }).testId;
      router.push(`/team/tests/${testId}`);
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const scheduleOptions = isCreate ? props.scheduleOptions : [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6" noValidate>
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <fieldset className="glass-card p-stack-lg rounded-xl space-y-4">
        <legend className="font-headline-md text-headline-md text-primary mb-2">Test Details</legend>

        {isCreate && (
          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface">Schedule Slot</label>
            <select className={inputClass} {...register("batchScheduleId")}>
              <option value="">Select a "Test" timetable entry...</option>
              {scheduleOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.batchName} — {s.title} ({new Date(s.startsAt).toLocaleString()})
                </option>
              ))}
            </select>
            {scheduleOptions.length === 0 && (
              <p className="text-label-sm text-on-surface-variant">
                No open "Test" timetable slots found. Add one first from a batch's Timetable section
                (type: Test) — a test always binds to a scheduled slot, same as a live class.
              </p>
            )}
            {errors.batchScheduleId && (
              <p className="text-label-sm font-label-sm text-error">{errors.batchScheduleId.message}</p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Title</label>
          <input className={inputClass} placeholder="e.g. Weekly Test — Organic Chemistry" {...register("title")} />
          {errors.title && <p className="text-label-sm font-label-sm text-error">{errors.title.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Duration (minutes)</label>
          <input
            type="number"
            min={1}
            className={inputClass + " max-w-xs"}
            {...register("durationMin", { valueAsNumber: true })}
          />
          {errors.durationMin && (
            <p className="text-label-sm font-label-sm text-error">{errors.durationMin.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Instructions (optional)</label>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Marking scheme notes, calculator allowed/not, etc."
            {...register("instructions")}
          />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Saving..." : isCreate ? "Create Test" : "Save Changes"}
      </button>
    </form>
  );
}
