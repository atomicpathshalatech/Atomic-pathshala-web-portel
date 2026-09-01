"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { testSeriesSchema, type TestSeriesInput } from "@/lib/validation/test-series";

export function TestSeriesForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TestSeriesInput>({
    resolver: zodResolver(testSeriesSchema),
    defaultValues: {
      visibility: "PRIVATE",
      tags: [],
    },
  });

  const tags = watch("tags") ?? [];

  function addTag() {
    const value = tagInput.trim();
    if (value && !tags.includes(value)) {
      setValue("tags", [...tags, value]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setValue(
      "tags",
      tags.filter((t) => t !== tag)
    );
  }

  async function onSubmit(values: TestSeriesInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/team/test-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not create the test series. Please check the fields.");
        return;
      }

      router.push(`/team/test-series/${body.data.series.id}`);
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-gutter" noValidate>
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
        <div>
          <label className={labelClass}>Series Name</label>
          <input className={inputClass} placeholder="NEET 2027 Full Syllabus Test Series" {...register("name")} />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={`${inputClass} min-h-[90px]`}
            placeholder="What this series covers..."
            {...register("description")}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Target Batch</label>
            <input className={inputClass} placeholder="NEET Dropper 2027" {...register("targetBatch")} />
          </div>
          <div>
            <label className={labelClass}>Class</label>
            <input className={inputClass} placeholder="12" {...register("className")} />
          </div>
          <div>
            <label className={labelClass}>Course</label>
            <input className={inputClass} placeholder="NEET" {...register("course")} />
          </div>
          <div>
            <label className={labelClass}>Exam Type</label>
            <input className={inputClass} placeholder="Full Syllabus" {...register("examType")} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Tags</label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-primary-container/30 text-primary px-3 py-1 rounded-full text-label-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-on-surface-variant hover:text-error"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            className={inputClass}
            placeholder="Add a tag and press Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Start Date</label>
            <input
              type="datetime-local"
              className={inputClass}
              onChange={(e) =>
                setValue("startDate", e.target.value ? new Date(e.target.value).toISOString() : "")
              }
            />
          </div>
          <div>
            <label className={labelClass}>End Date</label>
            <input
              type="datetime-local"
              className={inputClass}
              onChange={(e) => setValue("endDate", e.target.value ? new Date(e.target.value).toISOString() : "")}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Visibility</label>
          <select className={inputClass} {...register("visibility")}>
            <option value="PRIVATE">Private</option>
            <option value="PUBLIC">Public</option>
          </select>
        </div>
      </div>

      <div className="glass-card p-stack-md rounded-xl">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-md shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create Test Series →"}
        </button>
      </div>
    </form>
  );
}

const labelClass = "block text-label-sm font-label-md text-on-surface-variant mb-1.5";
const errorClass = "text-label-sm font-label-sm text-error mt-1";
const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";
