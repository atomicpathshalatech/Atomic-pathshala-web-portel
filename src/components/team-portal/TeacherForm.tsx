"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  teacherCreateSchema,
  teacherAdminUpdateSchema,
  DEPARTMENT_OPTIONS,
  EXAM_OPTIONS,
  CLASS_OPTIONS,
  LANGUAGE_OPTIONS,
  EXPERIENCE_OPTIONS,
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
  const [showPassword, setShowPassword] = useState(false);

  const isCreate = props.mode === "create";

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeacherCreateInput | TeacherAdminUpdateInput>({
    resolver: zodResolver(isCreate ? teacherCreateSchema : teacherAdminUpdateSchema),
    defaultValues: isCreate
      ? {
          subjects: [],
          targetExams: [],
          classes: [],
          languages: ["Hindi", "English"],
          qualifications: [],
          experienceList: [],
        }
      : {
          ...(props as { initialData: TeacherAdminUpdateInput }).initialData,
        },
  });

  const {
    fields: qualFields,
    append: appendQual,
    remove: removeQual,
  } = useFieldArray({ control, name: "qualifications" as any });

  const {
    fields: expFields,
    append: appendExp,
    remove: removeExp,
  } = useFieldArray({ control, name: "experienceList" as any });

  const subjects = watch("subjects") ?? [];
  const targetExams = watch("targetExams") ?? [];
  const classes = watch("classes") ?? [];
  const languages = watch("languages") ?? [];

  function toggleItem(list: string[], item: string, fieldName: "targetExams" | "classes" | "languages" | "subjects") {
    if (list.includes(item)) {
      setValue(fieldName, list.filter((x) => x !== item) as any);
    } else {
      setValue(fieldName, [...list, item] as any);
    }
  }

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
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-8" noValidate>
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-2xl px-5 py-4">
          <p className="text-label-md font-label-md text-error">{serverError}</p>
        </div>
      )}

      {/* 1. Account & Login Credentials */}
      {isCreate && (
        <fieldset className="glass-card p-6 md:p-8 rounded-2xl space-y-4">
          <legend className="font-headline-md text-headline-md text-primary font-bold mb-2">
            1. Account &amp; Login Details
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name *" error={"name" in errors ? errors.name?.message : undefined}>
              <input className={inputClass} placeholder="e.g. Rehan Ali" {...register("name" as "name")} />
            </Field>
            <Field label="Email Address *" error={"email" in errors ? errors.email?.message : undefined}>
              <input type="email" className={inputClass} placeholder="teacher@atomicpathshala.com" {...register("email" as "email")} />
            </Field>
            <div className="md:col-span-2">
              <Field
                label="Account Password *"
                error={"password" in errors ? errors.password?.message : undefined}
              >
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={inputClass + " pr-10"}
                    placeholder="Enter intended login password (min 8 chars)"
                    {...register("password" as "password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors text-sm"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                <p className="text-[12px] text-on-surface-variant mt-1">
                  This password will be securely hashed and emailed to the educator as their initial login credential.
                </p>
              </Field>
            </div>
          </div>
        </fieldset>
      )}

      {/* 1. Account & Identity (Edit Mode) */}
      {!isCreate && (
        <fieldset className="glass-card p-6 md:p-8 rounded-2xl space-y-4">
          <legend className="font-headline-md text-headline-md text-primary font-bold mb-2">
            1. User Account &amp; Identity
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Full Name *" error={"name" in errors ? (errors as any).name?.message : undefined}>
              <input className={inputClass} placeholder="e.g. Rehan Ali" {...register("name" as any)} />
            </Field>
            <Field label="Email Address *" error={"email" in errors ? (errors as any).email?.message : undefined}>
              <input type="email" className={inputClass} placeholder="teacher@atomicpathshala.com" {...register("email" as any)} />
            </Field>
            <Field label="Mobile / Phone" error={"phone" in errors ? (errors as any).phone?.message : undefined}>
              <input type="tel" className={inputClass} placeholder="+91 9876543210" {...register("phone" as any)} />
            </Field>
          </div>
        </fieldset>
      )}

      {/* 2. Basic Profile & Branding */}
      <fieldset className="glass-card p-6 md:p-8 rounded-2xl space-y-4">
        <legend className="font-headline-md text-headline-md text-primary font-bold mb-2">
          {isCreate ? "2." : "2."} Basic Profile &amp; Headline
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Employee Code *" error={errors.employeeCode?.message}>
            <input className={inputClass} placeholder="e.g. EMP-2026-014" {...register("employeeCode")} />
          </Field>
          <Field label="Primary Department *" error={errors.department?.message}>
            <select className={inputClass} defaultValue="" {...register("department")}>
              <option value="" disabled>
                Select Department
              </option>
              {DEPARTMENT_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Professional Display Name / Headline (Optional)">
            <input
              className={inputClass}
              placeholder="e.g. Senior Biology Faculty | NEET Mentor"
              {...register("displayName")}
            />
          </Field>
          <Field label="Profile Photo URL (Optional)">
            <input
              className={inputClass}
              placeholder="https://... photo url"
              {...register("photoUrl")}
            />
          </Field>
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="font-label-md text-label-md text-on-surface font-semibold">
            About Educator (Bio)
          </label>
          <p className="text-[12px] text-on-surface-variant">
            Enter a personal introduction, teaching philosophy, or mentoring background. (Do not include qualifications or DOB here — they have dedicated sections).
          </p>
          <textarea
            rows={4}
            className={inputClass}
            placeholder="I have been mentoring students for NEET & JEE with a concept-first visual approach..."
            {...register("bio")}
          />
        </div>
      </fieldset>

      {/* 3. Subjects, Exams, Classes & Languages */}
      <fieldset className="glass-card p-6 md:p-8 rounded-2xl space-y-6">
        <legend className="font-headline-md text-headline-md text-primary font-bold mb-2">
          {isCreate ? "3." : "2."} Teaching Scope &amp; Target Levels
        </legend>

        {/* Subjects */}
        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface font-semibold">
            Subjects Taught *
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {["Biology", "Chemistry", "Physics", "Mathematics", "Zoology", "Botany"].map((sub) => {
              const active = subjects.includes(sub);
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => toggleItem(subjects, sub, "subjects")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    active
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-surface-container text-on-surface border-outline-variant/30 hover:border-primary/50"
                  }`}
                >
                  {active ? `✓ ${sub}` : `+ ${sub}`}
                </button>
              );
            })}
          </div>
          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
              {subjects.map((s) => (
                <span
                  key={s}
                  className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSubject(s)}
                    className="hover:text-error transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Add custom subject (press Enter to add)"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubject();
                }
              }}
            />
            <button
              type="button"
              onClick={addSubject}
              className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg text-xs font-semibold shrink-0"
            >
              Add
            </button>
          </div>
        </div>

        {/* Exams / Educator Type */}
        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface font-semibold">
            Exams / Educator Type (Only selected will appear on profile)
          </label>
          <div className="flex flex-wrap gap-2">
            {EXAM_OPTIONS.map((exam) => {
              const active = targetExams.includes(exam);
              return (
                <button
                  key={exam}
                  type="button"
                  onClick={() => toggleItem(targetExams, exam, "targetExams")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    active
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-surface-container text-on-surface border-outline-variant/30 hover:border-primary/40"
                  }`}
                >
                  {active ? `✓ ${exam}` : `+ ${exam}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Classes */}
        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface font-semibold">
            Classes / Grade Levels
          </label>
          <div className="flex flex-wrap gap-2">
            {CLASS_OPTIONS.map((cls) => {
              const active = classes.includes(cls);
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => toggleItem(classes, cls, "classes")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    active
                      ? "bg-secondary text-white border-secondary shadow-sm"
                      : "bg-surface-container text-on-surface border-outline-variant/30 hover:border-secondary/40"
                  }`}
                >
                  {active ? `✓ ${cls}` : `+ ${cls}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface font-semibold">
            Teaching Language
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((lang) => {
              const active = languages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleItem(languages, lang, "languages")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    active
                      ? "bg-tertiary text-white border-tertiary shadow-sm"
                      : "bg-surface-container text-on-surface border-outline-variant/30 hover:border-tertiary/40"
                  }`}
                >
                  {active ? `✓ ${lang}` : `+ ${lang}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Total Experience */}
        <div className="space-y-2">
          <label className="font-label-md text-label-md text-on-surface font-semibold">
            Total Teaching Experience
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select className={inputClass} {...register("experienceYears")}>
              <option value="">Select experience level</option>
              {EXPERIENCE_OPTIONS.map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              placeholder="Or custom text, e.g. 2.5 Years"
              onChange={(e) => {
                if (e.target.value) setValue("experienceYears", e.target.value);
              }}
            />
          </div>
        </div>
      </fieldset>

      {/* 4. Educational Qualifications */}
      <fieldset className="glass-card p-6 md:p-8 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <legend className="font-headline-md text-headline-md text-primary font-bold">
              {isCreate ? "4." : "3."} Educational Qualifications
            </legend>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              Add degrees, certifications, and universities attended.
            </p>
          </div>
          <button
            type="button"
            onClick={() => appendQual({ degree: "", institution: "", year: "" })}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Qualification
          </button>
        </div>

        {qualFields.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic py-2">
            No educational qualifications added yet. Click &quot;Add Qualification&quot; above.
          </p>
        ) : (
          <div className="space-y-3">
            {qualFields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-5">
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Degree / Qualification *
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. M.Sc. Chemistry or BAMS"
                    {...register(`qualifications.${index}.degree` as const)}
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Institution / University *
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. University of Delhi"
                    {...register(`qualifications.${index}.institution` as const)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Year (Optional)
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. 2021"
                    {...register(`qualifications.${index}.year` as const)}
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeQual(index)}
                    className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                    title="Remove Qualification"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* 5. Professional Experience */}
      <fieldset className="glass-card p-6 md:p-8 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <legend className="font-headline-md text-headline-md text-primary font-bold">
              {isCreate ? "5." : "4."} Professional Work Experience
            </legend>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              Add past or current institutes, companies, and roles held.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              appendExp({
                organization: "",
                designation: "",
                startYear: "",
                endYear: "Present",
                description: "",
              })
            }
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Experience
          </button>
        </div>

        {expFields.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic py-2">
            No work experience entries added yet. Click &quot;Add Experience&quot; above.
          </p>
        ) : (
          <div className="space-y-4">
            {expFields.map((field, index) => (
              <div
                key={field.id}
                className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4 md:col-span-4">
                    <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                      Organization / Company *
                    </label>
                    <input
                      className={inputClass}
                      placeholder="e.g. Atomic Pathshala"
                      {...register(`experienceList.${index}.organization` as const)}
                    />
                  </div>
                  <div className="sm:col-span-4 md:col-span-4">
                    <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                      Designation / Role *
                    </label>
                    <input
                      className={inputClass}
                      placeholder="e.g. Senior Biology Faculty"
                      {...register(`experienceList.${index}.designation` as const)}
                    />
                  </div>
                  <div className="sm:col-span-2 md:col-span-1.5">
                    <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                      Start Year *
                    </label>
                    <input
                      className={inputClass}
                      placeholder="2022"
                      {...register(`experienceList.${index}.startYear` as const)}
                    />
                  </div>
                  <div className="sm:col-span-2 md:col-span-1.5">
                    <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                      End Year *
                    </label>
                    <input
                      className={inputClass}
                      placeholder="Present"
                      {...register(`experienceList.${index}.endYear` as const)}
                    />
                  </div>
                  <div className="sm:col-span-1 md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeExp(index)}
                      className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                      title="Remove Entry"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Description / Responsibilities (Optional)
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Mentored 500+ students for NEET UG with 95% qualification rate"
                    {...register(`experienceList.${index}.description` as const)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* Submission */}
      <div className="flex items-center gap-4 flex-wrap pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto bg-primary text-white font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
        >
          {submitting && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
          {submitting ? "Saving Profile..." : isCreate ? "Create Faculty Profile" : "Save Changes"}
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
