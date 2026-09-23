"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  teacherSelfUpdateSchema,
  EXAM_OPTIONS,
  CLASS_OPTIONS,
  LANGUAGE_OPTIONS,
  EXPERIENCE_OPTIONS,
  type TeacherSelfUpdateInput,
} from "@/lib/validation/teacher";

const COMMON_SUBJECTS = [
  "Biology",
  "Chemistry",
  "Physics",
  "Mathematics",
  "Zoology",
  "Botany",
  "General Science",
];

export function SelfProfileForm({ initialData }: { initialData: TeacherSelfUpdateInput }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [subjectInput, setSubjectInput] = useState("");

  const normalizedExperience = (initialData.experienceList || []).map((exp: any) => ({
    organization: exp.organization || "",
    designation: exp.designation || "",
    totalMonths:
      Number(exp.totalMonths) ||
      (exp.startYear && exp.endYear && !isNaN(Number(exp.endYear)) && !isNaN(Number(exp.startYear))
        ? Math.max(1, (Number(exp.endYear) - Number(exp.startYear)) * 12)
        : 0),
  }));

  const {
    handleSubmit,
    watch,
    setValue,
    register,
    control,
  } = useForm<TeacherSelfUpdateInput>({
    resolver: zodResolver(teacherSelfUpdateSchema),
    defaultValues: {
      subjects: initialData.subjects ?? [],
      displayName: initialData.displayName ?? "",
      targetExams: initialData.targetExams ?? [],
      classes: initialData.classes ?? [],
      languages: initialData.languages ?? ["Hindi", "English"],
      experienceYears: initialData.experienceYears ?? "",
      qualifications: initialData.qualifications ?? [],
      experienceList: normalizedExperience,
      bio: initialData.bio ?? "",
      photoUrl: initialData.photoUrl ?? "",
    },
  });

  const {
    fields: qualFields,
    append: appendQual,
    remove: removeQual,
  } = useFieldArray({
    control,
    name: "qualifications" as any,
  });

  const {
    fields: expFields,
    append: appendExp,
    remove: removeExp,
  } = useFieldArray({
    control,
    name: "experienceList" as any,
  });

  const subjects = watch("subjects") ?? [];
  const targetExams = watch("targetExams") ?? [];
  const classes = watch("classes") ?? [];
  const languages = watch("languages") ?? [];
  const expWatch = watch("experienceList") ?? [];

  const totalExperienceMonths = expWatch.reduce(
    (sum, curr) => sum + (Number(curr?.totalMonths) || 0),
    0
  );
  const totalYears = Math.floor(totalExperienceMonths / 12);
  const remainingMonths = totalExperienceMonths % 12;

  function toggleItem(
    list: string[],
    item: string,
    fieldName: "targetExams" | "classes" | "languages" | "subjects"
  ) {
    if (list.includes(item)) {
      setValue(
        fieldName,
        list.filter((x) => x !== item) as any
      );
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

  async function onSubmit(values: TeacherSelfUpdateInput) {
    setSubmitting(true);
    try {
      // Clean empty qualifications & experience items
      const cleanedData: TeacherSelfUpdateInput = {
        ...values,
        experienceYears:
          totalYears > 0
            ? `${totalYears}+ Years`
            : totalExperienceMonths > 0
            ? `${totalExperienceMonths} Months`
            : values.experienceYears || "",
        qualifications: (values.qualifications || []).filter(
          (q) => q.degree?.trim() && q.institution?.trim()
        ),
        experienceList: (values.experienceList || []).filter(
          (e) => e.organization?.trim() && e.designation?.trim()
        ),
      };

      const res = await fetch("/api/team/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedData),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not save your profile");
        return;
      }
      toast.success("Profile updated successfully!");
      router.refresh();
    } catch {
      toast.error("Something went wrong saving your profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl" noValidate>
      {/* 1. Professional Display Name / Headline */}
      <div className="glass-card p-6 rounded-2xl space-y-3">
        <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">badge</span>
          <span>Professional Headline / Display Name</span>
        </label>
        <p className="text-xs text-on-surface-variant">
          This appears below your name on your public profile and faculty cards. If empty, it will be automatically built from your subject and exams.
        </p>
        <input
          className={inputClass}
          placeholder="e.g. Senior Biology Faculty | NEET & Foundation Mentor"
          {...register("displayName")}
        />
      </div>

      {/* 2. Subjects Taught */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">menu_book</span>
          <span>Subjects Taught</span>
        </label>
        <p className="text-xs text-on-surface-variant">
          Select all subjects you teach. Students can filter you by these subjects.
        </p>

        {/* Quick select buttons */}
        <div className="flex flex-wrap gap-1.5">
          {COMMON_SUBJECTS.map((sub) => {
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

        {/* Active subject chips */}
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
                  onClick={() => setValue("subjects", subjects.filter((x) => x !== s))}
                  className="hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Custom subject input */}
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Add custom subject — press Enter or Add"
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

      {/* 3. Target Exams / Educator Type */}
      <div className="glass-card p-6 rounded-2xl space-y-3">
        <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">flag</span>
          <span>Target Exams / Specialization</span>
        </label>
        <p className="text-xs text-on-surface-variant">
          Select target exams you mentor students for. Only selected exams will appear on your profile.
        </p>

        {/* Exam Dropdown Picker */}
        <div className="space-y-2">
          <select
            className={inputClass}
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (val && !targetExams.includes(val)) {
                setValue("targetExams", [...targetExams, val]);
              }
            }}
          >
            <option value="">-- Choose Target Exam from Dropdown --</option>
            {EXAM_OPTIONS.map((exam) => (
              <option key={exam} value={exam} disabled={targetExams.includes(exam)}>
                {exam} {targetExams.includes(exam) ? "✓ (Added)" : ""}
              </option>
            ))}
          </select>

          {/* Active exam chips */}
          {targetExams.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {targetExams.map((exam) => (
                <span
                  key={exam}
                  className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <span>{exam}</span>
                  <button
                    type="button"
                    onClick={() => setValue("targetExams", targetExams.filter((x) => x !== exam))}
                    className="hover:text-error transition-colors"
                    title={`Remove ${exam}`}
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Teaching Languages */}
      <div className="glass-card p-6 rounded-2xl space-y-3">
        <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">translate</span>
          <span>Teaching Languages / Medium</span>
        </label>
        <p className="text-xs text-on-surface-variant">
          Select languages you are comfortable conducting lectures and solving student doubts in.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {LANGUAGE_OPTIONS.map((lang) => {
            const active = languages.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => toggleItem(languages, lang, "languages")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  active
                    ? "bg-primary text-white border-primary shadow-sm ring-2 ring-primary/20"
                    : "bg-surface-container text-on-surface border-outline-variant/30 hover:border-primary/40"
                }`}
              >
                {active ? `✓ ${lang}` : `+ ${lang}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Educational Qualifications */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">history_edu</span>
              <span>Educational Qualifications</span>
            </label>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Add your degrees, colleges, and completion years.
            </p>
          </div>
          <button
            type="button"
            onClick={() => appendQual({ degree: "", institution: "", year: "" })}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Degree
          </button>
        </div>

        {qualFields.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic py-1">
            No degrees added yet. Click &quot;Add Degree&quot; to show your credentials.
          </p>
        ) : (
          <div className="space-y-3">
            {qualFields.map((field, index) => (
              <div
                key={field.id}
                className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
              >
                <div className="sm:col-span-5">
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Degree / Qualification *
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. M.Sc. Biology or B.Tech"
                    {...register(`qualifications.${index}.degree` as const)}
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    University / College *
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Delhi University"
                    {...register(`qualifications.${index}.institution` as const)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Year
                  </label>
                  <input
                    className={inputClass}
                    placeholder="2020"
                    {...register(`qualifications.${index}.year` as const)}
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end pb-1">
                  <button
                    type="button"
                    onClick={() => removeQual(index)}
                    className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                    title="Remove qualification"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Professional Work Experience */}
      <div className="glass-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">work_history</span>
              <span>Professional Work Experience</span>
            </label>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Add organizations/institutes where you worked, your designation, and total experience in months.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              appendExp({
                organization: "",
                designation: "",
                totalMonths: 12,
              })
            }
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Experience
          </button>
        </div>

        {/* Total Cumulative Experience Banner */}
        <div className="p-3.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">timeline</span>
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface block">Cumulative Total Experience</span>
              <span className="text-[11px] text-on-surface-variant">
                Auto-calculated sum of all institute records
              </span>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-base font-black text-primary block">
              {totalExperienceMonths} Months
            </span>
            {totalExperienceMonths > 0 && (
              <span className="text-xs font-semibold text-on-surface-variant">
                {totalYears > 0 ? `${totalYears} ${totalYears === 1 ? "Year" : "Years"}` : ""}
                {remainingMonths > 0 ? ` ${remainingMonths} ${remainingMonths === 1 ? "Month" : "Months"}` : ""}
              </span>
            )}
          </div>
        </div>

        {expFields.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic py-1">
            No work experience records added yet. Click &quot;Add Experience&quot; above.
          </p>
        ) : (
          <div className="space-y-3">
            {expFields.map((field, index) => (
              <div
                key={field.id}
                className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
              >
                <div className="sm:col-span-5">
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Company / Institute Name *
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Allen Career Institute / Atomic Pathshala"
                    {...register(`experienceList.${index}.organization` as const)}
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Designation / Role *
                  </label>
                  <input
                    className={inputClass}
                    placeholder="e.g. Senior Faculty / SME"
                    {...register(`experienceList.${index}.designation` as const)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Experience (Months) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={inputClass}
                    placeholder="e.g. 12"
                    {...register(`experienceList.${index}.totalMonths` as const, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end pb-1">
                  <button
                    type="button"
                    onClick={() => removeExp(index)}
                    className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                    title="Remove experience"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 8. About Educator / Bio */}
      <div className="glass-card p-6 rounded-2xl space-y-2">
        <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">person</span>
          <span>About You (Bio / Teaching Philosophy)</span>
        </label>
        <p className="text-xs text-on-surface-variant">
          Share your journey, mentorship style, and how you help students succeed.
        </p>
        <textarea
          rows={4}
          className={inputClass}
          placeholder="Tell students about your passion for teaching, pedagogy, and guidance..."
          {...register("bio")}
        />
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto bg-primary text-on-primary font-label-md text-label-md px-10 py-3.5 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2 font-bold"
        >
          {submitting ? (
            <>
              <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">save</span>
              <span>Save &amp; Update Profile</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-outline-variant/60 focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2.5 px-3.5 text-body-md text-on-surface outline-none transition-all placeholder:text-on-surface-variant/50";

