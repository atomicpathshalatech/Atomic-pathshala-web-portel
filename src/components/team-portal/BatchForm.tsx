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
import { ThumbnailUploader } from "./ThumbnailUploader";
import { cleanBatchName } from "@/lib/academic/canonical-courses";
import { calculateDiscountPercentage, formatInr } from "@/lib/commerce/pricing";

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

  /**
   * New batches default to the NEET UG course, since that is what almost
   * every batch here is. Matched by title rather than a hardcoded id — course
   * rows are seeded data and their ids differ per environment, so an id
   * baked in here would silently select nothing in production.
   *
   * Editing an existing batch always keeps whatever it already had, and the
   * full course list (plus "No course linked yet") stays selectable.
   */
  const neetUgCourseId =
    props.courses.find((c) => /neet\s*ug/i.test(c.title))?.id ??
    props.courses.find((c) => /neet/i.test(c.title))?.id ??
    "";

  const defaultCourseId = isCreate ? neetUgCourseId : initial?.courseId ?? "";

  // Only string/select fields go through RHF's defaultValues — date and number
  // inputs are uncontrolled natively (via the DOM `defaultValue` prop below) so
  // a Date/number from the server never collides with the string value a
  // native <input type="date"/"number"> actually holds.
  const [isFree, setIsFree] = useState<boolean>(initial ? initial.price === 0 : false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BatchCreateInput>({
    resolver: zodResolver(batchCreateSchema),
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      description: initial?.description ?? "",
      targetExam: initial?.targetExam ?? "",
      courseId: defaultCourseId,
      status: initial?.status ?? "UPCOMING",
      thumbnailUrl: initial?.thumbnailUrl ?? "",
      price: initial?.price ?? (isCreate ? 1000 : null),
      originalPrice: initial?.originalPrice ?? (isCreate ? 2000 : null),
      isPurchasable: initial?.isPurchasable ?? true,
    },
  });

  const thumbnailUrl = watch("thumbnailUrl") ?? "";
  const currentName = watch("name") || "Batch Title";
  const currentTargetExam = watch("targetExam") || "Exam";
  const currentPrice = watch("price");
  const currentOriginalPrice = watch("originalPrice");
  const currentIsPurchasable = watch("isPurchasable") ?? true;

  const discountPercent = isFree
    ? (Number(currentOriginalPrice) > 0 ? 100 : 0)
    : calculateDiscountPercentage(currentOriginalPrice, currentPrice);

  async function onSubmit(values: BatchCreateInput) {
    if (isFree) {
      values.price = 0;
    } else if (
      values.price != null &&
      values.originalPrice != null &&
      values.price > values.originalPrice &&
      values.originalPrice > 0
    ) {
      setServerError("Selling Price cannot be greater than Original MRP Price.");
      return;
    }

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
            <input className={inputClass} placeholder="e.g. NEET — Dropper Batch A" {...register("name")} />
          </Field>
          <Field label="Batch Code" error={errors.code?.message}>
            <input className={inputClass} placeholder="e.g. NEET-A1" {...register("code")} />
          </Field>
          <Field label="Target Exam" error={errors.targetExam?.message}>
            <input className={inputClass} placeholder="e.g. NEET" {...register("targetExam")} />
          </Field>
          <Field label="Course (optional)" error={errors.courseId?.message}>
            <select className={inputClass} defaultValue={defaultCourseId} {...register("courseId")}>
              <option value="">No course linked yet</option>
              {props.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {cleanBatchName(c.title)}
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
            rows={6}
            className={`${inputClass} min-h-[140px]`}
            placeholder="What this batch covers, timing, curriculum details, who it's for..."
            {...register("description")}
          />
        </div>

        <ThumbnailUploader
          value={thumbnailUrl}
          onChange={(url) => setValue("thumbnailUrl", url ?? "")}
          label="Batch Thumbnail (16:9)"
        />
        {errors.thumbnailUrl && (
          <p className="text-label-sm font-label-sm text-error">{errors.thumbnailUrl.message}</p>
        )}
      </fieldset>

      {/* Pricing, Discount & Self-Enrollment Controls */}
      <fieldset className="glass-card p-stack-lg rounded-xl space-y-5">
        <legend className="font-headline-md text-headline-md text-primary mb-1">
          Pricing &amp; Enrollment Controls
        </legend>
        <p className="text-body-sm text-on-surface-variant">
          Configure commercial pricing, automatic discount computation, and self-enrollment accessibility.
        </p>

        {/* FREE vs PAID Toggle */}
        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface block">Pricing Model</label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => {
                setIsFree(true);
                setValue("price", 0);
              }}
              className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                isFree
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 shadow-xs"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-outline"
              }`}
            >
              <span className="material-symbols-outlined text-base">card_giftcard</span>
              <span>FREE Batch (₹0)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFree(false);
                if (currentPrice === 0 || currentPrice == null) {
                  setValue(
                    "price",
                    currentOriginalPrice ? Math.round(Number(currentOriginalPrice) * 0.5) : 1000
                  );
                }
              }}
              className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                !isFree
                  ? "bg-primary/10 border-primary text-primary shadow-xs"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-outline"
              }`}
            >
              <span className="material-symbols-outlined text-base">payments</span>
              <span>PAID Batch</span>
            </button>
          </div>
        </div>

        {/* Pricing Inputs & Auto Discount */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Original Price / MRP (₹)" error={errors.originalPrice?.message}>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-on-surface-variant font-bold">₹</span>
              <input
                type="number"
                min={0}
                className={`${inputClass} pl-7 font-bold`}
                placeholder="2000"
                {...register("originalPrice")}
              />
            </div>
          </Field>

          <Field label="Selling Price (₹)" error={errors.price?.message}>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-on-surface-variant font-bold">₹</span>
              <input
                type="number"
                min={0}
                disabled={isFree}
                className={`${inputClass} pl-7 font-bold text-primary disabled:opacity-60 disabled:bg-surface-container-high/30`}
                placeholder="1000"
                value={isFree ? 0 : undefined}
                {...(!isFree ? register("price") : {})}
              />
            </div>
          </Field>

          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface">Calculated Discount</label>
            <div className="h-[38px] px-3 rounded-lg border border-outline-variant bg-surface-container-high/40 flex items-center justify-between">
              <span className="text-xs font-black text-emerald-600">
                {discountPercent > 0 ? `${discountPercent}% OFF` : "No Discount (0%)"}
              </span>
              {isFree && (
                <span className="bg-emerald-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  FREE
                </span>
              )}
            </div>
            <p className="text-[10px] text-on-surface-variant">Auto computed from MRP &amp; Selling Price</p>
          </div>
        </div>

        {/* Enrollment Availability Toggle */}
        <div className="p-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-on-surface">Allow Student Self-Enrollment</p>
            <p className="text-[11px] text-on-surface-variant">
              When checked, students can independently join/buy this batch from the store and catalog.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              {...register("isPurchasable")}
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Live Student-Facing Preview Card */}
        <div className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-high/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Live Student Preview (Store &amp; Catalog)
            </span>
            <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
              Live Preview
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-outline-variant/30 rounded-2xl p-4 shadow-sm max-w-sm flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase">{currentTargetExam}</span>
                <h4 className="font-bold text-sm text-on-surface line-clamp-1">{currentName}</h4>
              </div>
              {isFree ? (
                <span className="bg-emerald-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0">
                  FREE
                </span>
              ) : discountPercent > 0 ? (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0">
                  {discountPercent}% OFF
                </span>
              ) : null}
            </div>

            {/* Pricing Display */}
            <div className="flex items-baseline gap-2 pt-1">
              {isFree ? (
                <>
                  <span className="text-lg font-black text-emerald-600">FREE</span>
                  {Number(currentOriginalPrice) > 0 && (
                    <span className="text-xs text-slate-400 line-through">
                      {formatInr(Number(currentOriginalPrice))}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-[10px] font-extrabold text-emerald-600">
                      {discountPercent}% OFF
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-lg font-black text-on-surface">
                    {formatInr(Number(currentPrice) || 0)}
                  </span>
                  {discountPercent > 0 && (
                    <span className="text-xs text-slate-400 line-through">
                      {formatInr(Number(currentOriginalPrice) || 0)}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-[10px] font-extrabold text-emerald-600">
                      {discountPercent}% OFF
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Preview Button */}
            <button
              type="button"
              disabled
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 ${
                !currentIsPurchasable
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : isFree
                  ? "bg-emerald-600 text-white"
                  : "bg-primary text-on-primary"
              }`}
            >
              {!currentIsPurchasable
                ? "Enrollment Closed"
                : isFree
                ? "Join Free"
                : "Buy Now"}
            </button>
          </div>
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
