"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  batchCreateSchema,
  BATCH_STATUS_OPTIONS,
  type BatchCreateInput,
} from "@/lib/validation/batch";

type CourseOption = { id: string; title: string };

type Props =
  | { mode: "create"; courses: CourseOption[] }
  | {
      mode: "edit";
      batchId: string;
      courses: CourseOption[];
      initialData: Partial<BatchCreateInput> & { name: string; code: string };
    };

function toDateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function BatchForm(props: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isCreate = props.mode === "create";
  const initial = isCreate ? undefined : props.initialData;

  // Only string/select fields go through RHF's defaultValues — date and number
  // inputs are uncontrolled natively (via the DOM `defaultValue` prop below) so
  // a Date/number from the server never collides with the string value a
  // native <input type="date"/"number"> actually holds.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BatchCreateInput>({
    resolver: zodResolver(batchCreateSchema),
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      description: initial?.description ?? "",
      targetExam: initial?.targetExam ?? "",
      courseId: initial?.courseId ?? "",
      status: initial?.status ?? "UPCOMING",
    },
  });

  async function onSubmit(values: BatchCreateInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const editBatchId = !isCreate ? (props as { batchId: string }).batchId : undefined;
      const url = isCreate ? "/api/team/batches" : `/api/team/batches/${editBatchId}`;
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not save this batch. Please check the fields.");
        return;
      }
      const batchId = isCreate ? body.data.batch.id : editBatchId;
      router.push(`/team/batches/${batchId}`);
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6" noValidate>
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <fieldset className="glass-card p-stack-lg rounded-xl space-y-4">
        <legend className="font-headline-md text-headline-md text-primary mb-2">Batch Details</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Batch Name" error={errors.name?.message}>
            <input className={inputClass} placeholder="e.g. NEET 2027 — Dropper Batch A" {...register("name")} />
          </Field>
          <Field label="Batch Code" error={errors.code?.message}>
            <input className={inputClass} placeholder="e.g. NEET27-A1" {...register("code")} />
          </Field>
          <Field label="Target Exam" error={errors.targetExam?.message}>
            <input className={inputClass} placeholder="e.g. NEET" {...register("targetExam")} />
          </Field>
          <Field label="Course (optional)" error={errors.courseId?.message}>
            <select className={inputClass} defaultValue={initial?.courseId ?? ""} {...register("courseId")}>
              <option value="">No course linked yet</option>
              {props.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <select className={inputClass} defaultValue={initial?.status ?? "UPCOMING"} {...register("status")}>
              {BATCH_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Capacity (optional)" error={errors.capacity?.message}>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder="e.g. 120"
              defaultValue={initial?.capacity ?? ""}
              {...register("capacity")}
            />
          </Field>
          <Field label="Start Date (optional)" error={errors.startDate?.message as string | undefined}>
            <input
              type="date"
              className={inputClass}
              defaultValue={toDateInputValue(initial?.startDate as Date | undefined)}
              {...register("startDate")}
            />
          </Field>
          <Field label="End Date (optional)" error={errors.endDate?.message as string | undefined}>
            <input
              type="date"
              className={inputClass}
              defaultValue={toDateInputValue(initial?.endDate as Date | undefined)}
              {...register("endDate")}
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Description (optional)</label>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="What this batch covers, timing, who it's for..."
            {...register("description")}
          />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Saving..." : isCreate ? "Create Batch" : "Save Changes"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all";

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
