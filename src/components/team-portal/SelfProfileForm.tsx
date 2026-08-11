"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { teacherSelfUpdateSchema, type TeacherSelfUpdateInput } from "@/lib/validation/teacher";

export function SelfProfileForm({ initialData }: { initialData: TeacherSelfUpdateInput }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [subjectInput, setSubjectInput] = useState("");

  const { handleSubmit, watch, setValue, register } = useForm<TeacherSelfUpdateInput>({
    resolver: zodResolver(teacherSelfUpdateSchema),
    defaultValues: initialData,
  });

  const subjects = watch("subjects") ?? [];

  function addSubject() {
    const value = subjectInput.trim();
    if (value && !subjects.includes(value)) setValue("subjects", [...subjects, value]);
    setSubjectInput("");
  }

  async function onSubmit(values: TeacherSelfUpdateInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not save your profile");
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-stack-lg rounded-xl space-y-4 max-w-2xl">
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface">Subjects Taught</label>
        <div className="flex flex-wrap gap-1">
          {subjects.map((s) => (
            <span key={s} className="bg-surface-container-high px-2 py-1 rounded text-label-sm flex items-center gap-1">
              {s}
              <button
                type="button"
                onClick={() => setValue("subjects", subjects.filter((x) => x !== s))}
                className="text-on-surface-variant hover:text-error"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Add a subject — press Enter"
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
        <label className="font-label-md text-label-md text-on-surface">Bio</label>
        <textarea rows={4} className={inputClass} placeholder="Tell students a bit about yourself..." {...register("bio")} />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60"
      >
        {submitting ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all";
