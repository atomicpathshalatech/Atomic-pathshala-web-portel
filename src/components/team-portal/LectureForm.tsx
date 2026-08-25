"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { lectureCreateSchema, LANGUAGE_OPTIONS, type LectureCreateInput } from "@/lib/validation/lecture";

type ChapterOption = { id: string; title: string; subjectTitle: string; courseTitle: string };
type TeacherOption = { id: string; name: string; employeeCode: string };

type Props =
  | { mode: "create"; chapterOptions: ChapterOption[]; teacherOptions: TeacherOption[] | null }
  | {
      mode: "edit";
      lectureId: string;
      initialData: {
        title: string;
        language: string;
        order: number;
        videoUrl: string;
        educatorVideoUrl: string | null;
        slidesUrl: string | null;
      };
    };

const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all";

export function LectureForm(props: Props) {
  const router = useRouter();
  const isCreate = props.mode === "create";
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LectureCreateInput>({
    resolver: zodResolver(lectureCreateSchema),
    defaultValues: isCreate
      ? {
          chapterId: "",
          teacherId: undefined,
          title: "",
          language: "English",
          order: 0,
          videoUrl: "",
          educatorVideoUrl: "",
          slidesUrl: "",
        }
      : {
          chapterId: "placeholder", // unused in edit mode, schema still requires a non-empty string
          title: props.initialData.title,
          language: props.initialData.language as LectureCreateInput["language"],
          order: props.initialData.order,
          videoUrl: props.initialData.videoUrl,
          educatorVideoUrl: props.initialData.educatorVideoUrl ?? "",
          slidesUrl: props.initialData.slidesUrl ?? "",
        },
  });

  async function onSubmit(values: LectureCreateInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const url = isCreate ? "/api/team/lectures" : `/api/team/lectures/${(props as { lectureId: string }).lectureId}`;
      const body = isCreate
        ? values
        : {
            title: values.title,
            language: values.language,
            order: values.order,
            videoUrl: values.videoUrl,
            educatorVideoUrl: values.educatorVideoUrl,
            slidesUrl: values.slidesUrl,
          };
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setServerError(json.error ?? "Could not save this lecture.");
        return;
      }
      const lectureId = isCreate ? json.data.lecture.id : (props as { lectureId: string }).lectureId;
      router.push(`/team/lectures/${lectureId}`);
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const chapterOptions = isCreate ? props.chapterOptions : [];
  const teacherOptions = isCreate ? props.teacherOptions : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6" noValidate>
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <fieldset className="glass-card p-stack-lg rounded-xl space-y-4">
        <legend className="font-headline-md text-headline-md text-primary mb-2">Lecture Details</legend>

        {isCreate && (
          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface">Chapter</label>
            <select className={inputClass} {...register("chapterId")}>
              <option value="">Select a chapter...</option>
              {chapterOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseTitle} — {c.subjectTitle} — {c.title}
                </option>
              ))}
            </select>
            {chapterOptions.length === 0 && (
              <p className="text-label-sm text-on-surface-variant">
                No chapters found. Add a chapter under a Subject first — a lecture always belongs to one.
              </p>
            )}
            {errors.chapterId && <p className="text-label-sm font-label-sm text-error">{errors.chapterId.message}</p>}
          </div>
        )}

        {isCreate && teacherOptions && (
          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface">Faculty</label>
            <select className={inputClass} {...register("teacherId")}>
              <option value="">Select a faculty member...</option>
              {teacherOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.employeeCode})
                </option>
              ))}
            </select>
            <p className="text-label-sm text-on-surface-variant">
              You don't have a faculty profile of your own, so pick who this lecture should be attributed to.
            </p>
            {errors.teacherId && <p className="text-label-sm font-label-sm text-error">{errors.teacherId.message}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Title</label>
          <input className={inputClass} placeholder="e.g. Cell I Chapterwise — Part 3" {...register("title")} />
          {errors.title && <p className="text-label-sm font-label-sm text-error">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface">Language</label>
            <select className={inputClass} {...register("language")}>
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface">Order</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              {...register("order", { valueAsNumber: true })}
            />
            <p className="text-label-sm text-on-surface-variant">
              Lower numbers play first in the student's prev/next navigation.
            </p>
            {errors.order && <p className="text-label-sm font-label-sm text-error">{errors.order.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Video URL</label>
          <input className={inputClass} placeholder="https://..." {...register("videoUrl")} />
          {errors.videoUrl && <p className="text-label-sm font-label-sm text-error">{errors.videoUrl.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Educator Webcam Video URL (optional)</label>
          <input className={inputClass} placeholder="https://..." {...register("educatorVideoUrl")} />
          <p className="text-label-sm text-on-surface-variant">
            Shown as the small picture-in-picture corner clip. Leave blank if this lecture wasn't recorded with a
            webcam feed — the player hides the toggle entirely rather than showing a broken one.
          </p>
          {errors.educatorVideoUrl && (
            <p className="text-label-sm font-label-sm text-error">{errors.educatorVideoUrl.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Slides URL (optional)</label>
          <input className={inputClass} placeholder="https://..." {...register("slidesUrl")} />
          <p className="text-label-sm text-on-surface-variant">
            Enables "Slide mode" in the player. Leave blank if there's no slide deck for this lecture.
          </p>
          {errors.slidesUrl && <p className="text-label-sm font-label-sm text-error">{errors.slidesUrl.message}</p>}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Saving..." : isCreate ? "Create Lecture" : "Save Changes"}
      </button>
    </form>
  );
}
