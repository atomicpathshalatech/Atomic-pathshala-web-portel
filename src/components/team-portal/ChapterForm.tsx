"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { chapterSchema, MEDIUM_VALUES, type ChapterInput, type MediumValue } from "@/lib/validation/chapter";

export type CourseWithSubjects = {
  id: string;
  title: string;
  subjects: Array<{ id: string; title: string }>;
};

export type ChapterFormInitialData = {
  id?: string;
  title: string;
  courseId?: string;
  subjectId: string;
  medium: MediumValue;
  order: number;
};

export function ChapterForm({
  courses,
  initialData,
}: {
  courses: CourseWithSubjects[];
  initialData?: ChapterFormInitialData;
}) {
  const router = useRouter();
  const isEditing = !!initialData?.id;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Derive initial course if not provided directly
  const initialCourseId = useMemo(() => {
    if (initialData?.courseId) return initialData.courseId;
    if (initialData?.subjectId) {
      const parentCourse = courses.find((c) => c.subjects.some((s) => s.id === initialData.subjectId));
      return parentCourse?.id || "";
    }
    return courses[0]?.id || "";
  }, [courses, initialData]);

  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ChapterInput>({
    resolver: zodResolver(chapterSchema),
    defaultValues: {
      title: initialData?.title ?? "",
      courseId: initialCourseId,
      subjectId: initialData?.subjectId ?? "",
      medium: initialData?.medium ?? "ENGLISH",
      order: initialData?.order ?? 0,
    },
  });

  const selectedMedium = watch("medium");

  // Filtered subjects based on course selection
  const availableSubjects = useMemo(() => {
    if (!selectedCourseId) return [];
    const course = courses.find((c) => c.id === selectedCourseId);
    return course ? course.subjects : [];
  }, [courses, selectedCourseId]);

  function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId);
    setValue("courseId", courseId);
    setValue("subjectId", ""); // Reset subject when course changes
  }

  async function onSubmit(values: ChapterInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const url = isEditing ? `/api/team/chapters/${initialData.id}` : "/api/team/chapters";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not save the chapter. Please check the fields.");
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
        {/* Course / Exam Selection */}
        <div>
          <label className={labelClass}>Course / Exam</label>
          <select
            className={inputClass}
            value={selectedCourseId}
            onChange={(e) => handleCourseChange(e.target.value)}
          >
            <option value="">Select Course / Exam...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Cascading Subject Selection */}
        <div>
          <label className={labelClass}>Subject</label>
          <select
            className={inputClass}
            {...register("subjectId")}
            disabled={!selectedCourseId || availableSubjects.length === 0}
          >
            <option value="">
              {!selectedCourseId
                ? "First choose a course above..."
                : availableSubjects.length === 0
                ? "No subjects in this course"
                : "Select subject..."}
            </option>
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          {errors.subjectId && <p className={errorClass}>{errors.subjectId.message}</p>}
        </div>

        {/* Chapter Name / Title */}
        <div>
          <label className={labelClass}>Chapter Title</label>
          <input
            className={inputClass}
            placeholder="e.g. Chemical Kinetics & Reaction Rates"
            {...register("title")}
          />
          {errors.title && <p className={errorClass}>{errors.title.message}</p>}
        </div>

        {/* Medium Selection (Hindi / English / Hinglish) */}
        <div>
          <label className={labelClass}>Medium / Language</label>
          <div className="grid grid-cols-3 gap-3">
            {MEDIUM_VALUES.map((med) => {
              const active = selectedMedium === med;
              const label = med === "HINDI" ? "Hindi (हिंदी)" : med === "ENGLISH" ? "English" : "Hinglish";
              return (
                <button
                  key={med}
                  type="button"
                  onClick={() => setValue("medium", med, { shouldValidate: true })}
                  className={`py-2.5 px-3 rounded-xl border text-label-md transition-all flex flex-col items-center justify-center gap-1 ${
                    active
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/30"
                      : "border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:border-outline-variant"
                  }`}
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          {errors.medium && <p className={errorClass}>{errors.medium.message}</p>}
        </div>

        {/* Display Order */}
        <div>
          <label className={labelClass}>Display Order</label>
          <input
            type="number"
            className={inputClass}
            {...register("order", { valueAsNumber: true })}
          />
          <p className="text-xs text-on-surface-variant mt-1">
            Determines the sequencing order of this chapter within the subject curriculum.
          </p>
        </div>
      </div>

      <div className="glass-card p-stack-md rounded-xl flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-md text-on-surface hover:bg-surface-container-high transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-7 py-2.5 rounded-xl bg-primary text-on-primary font-label-md shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting ? (
            <span>Saving...</span>
          ) : isEditing ? (
            <>
              <span className="material-symbols-outlined text-base">save</span>
              Save Changes
            </>
          ) : (
            <>
              <span>Create Chapter</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

const labelClass = "block text-label-sm font-label-md text-on-surface-variant mb-1.5";
const errorClass = "text-label-sm font-label-sm text-error mt-1";
const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";
