"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  teacherCreateSchema,
  teacherAdminUpdateSchema,
  DEPARTMENT_OPTIONS,
  type TeacherCreateInput,
  type TeacherAdminUpdateInput,
} from "@/lib/validation/teacher";

type Props =
  | { mode: "create" }
  | { mode: "edit"; teacherId: string; initialData: TeacherAdminUpdateInput };

export function TeacherForm(props: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [subjectInput, setSubjectInput] = useState("");

  const isCreate = props.mode === "create";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeacherCreateInput | TeacherAdminUpdateInput>({
    resolver: zodResolver(isCreate ? teacherCreateSchema : teacherAdminUpdateSchema),
    defaultValues: isCreate
      ? { subjects: [] }
      : { ...(props as { initialData: TeacherAdminUpdateInput }).initialData },
  });

  const subjects = watch("subjects") ?? [];

  function addSubject() {
    const value = subjectInput.trim();
    if (value && !subjects.includes(value)) {
      setValue("subjects", [...subjects, value]);
    }
    setSubjectInput("");
  }

  function removeSubject(subject: string) {
    setValue(
      "subjects",
      subjects.filter((s) => s !== subject)
    );
  }

  async function onSubmit(values: TeacherCreateInput | TeacherAdminUpdateInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const url = isCreate
        ? "/api/team/faculty"
        : `/api/team/faculty/${(props as { teacherId: string }).teacherId}`;
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not save this profile. Please check the fields.");
        return;
      }
      router.push("/team/faculty");
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

      {isCreate && (
        <fieldset className="glass-card p-stack-lg rounded-xl space-y-4">
          <legend className="font-headline-md text-headline-md text-primary mb-2">Login Details</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name" error={"name" in errors ? errors.name?.message : undefined}>
              <input className={inputClass} {...register("name" as "name")} />
            </Field>
            <Field label="Email" error={"email" in errors ? errors.email?.message : undefined}>
              <input type="email" className={inputClass} {...register("email" as "email")} />
            </Field>
            <Field label="Temporary Password" error={"password" in errors ? errors.password?.message : undefined}>
              <input type="password" className={inputClass} {...register("password" as "password")} />
            </Field>
          </div>
        </fieldset>
      )}

      <fieldset className="glass-card p-stack-lg rounded-xl space-y-4">
        <legend className="font-headline-md text-headline-md text-primary mb-2">Faculty Details</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Employee Code" error={errors.employeeCode?.message}>
            <input className={inputClass} placeholder="e.g. EMP-2026-014" {...register("employeeCode")} />
          </Field>
          <Field label="Department" error={errors.department?.message}>
            <select className={inputClass} defaultValue="" {...register("department")}>
              <option value="" disabled>
                Select department
              </option>
              {DEPARTMENT_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Subjects Taught</label>
          <div className="flex flex-wrap gap-1">
            {subjects.map((s) => (
              <span key={s} className="bg-surface-container-high px-2 py-1 rounded text-label-sm flex items-center gap-1">
                {s}
                <button type="button" onClick={() => removeSubject(s)} className="text-on-surface-variant hover:text-error">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="e.g. Physics — press Enter to add"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubject();
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Bio (optional)</label>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Short teaching background, experience, achievements..."
            {...register("bio")}
          />
        </div>
      </fieldset>

      <div className="flex items-center gap-4 flex-wrap">
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
        >
          {submitting ? "Saving..." : isCreate ? "Create Faculty Profile" : "Save Changes"}
        </button>

        {!isCreate && (
          <a
            href={`/teachers/${props.teacherId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto border border-primary text-primary font-label-md text-label-md px-6 py-3 rounded-xl hover:bg-primary/5 transition-all text-center flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            Preview Student Profile
          </a>
        )}
      </div>
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
