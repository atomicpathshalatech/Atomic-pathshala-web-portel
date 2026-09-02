"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { seriesTestCreateSchema, type SeriesTestCreateInput } from "@/lib/validation/test-series";
import { Layers, CheckCircle2, Award } from "lucide-react";

export function SeriesTestCreateForm({ testSeriesId }: { testSeriesId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<"NEET" | "JEE" | "CHAPTER_TEST" | "BLANK">("NEET");

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SeriesTestCreateInput>({
    resolver: zodResolver(seriesTestCreateSchema),
    defaultValues: {
      title: "Minor Test 01",
      durationMin: 200,
      templatePreset: "NEET",
      instructions: "+4 for correct, -1 for incorrect. All sections are mandatory.",
    },
  });

  function handleSelectPreset(preset: "NEET" | "JEE" | "CHAPTER_TEST" | "BLANK") {
    setSelectedPreset(preset);
    if (preset === "NEET") {
      setValue("templatePreset", "NEET");
      setValue("durationMin", 200);
      setValue("title", "NEET UG Major Test 01");
      setValue("instructions", "NEET UG Pattern: Physics (50Q), Chemistry (50Q), Botany (50Q), Zoology (50Q). Max: 720 Marks (+4/-1).");
    } else if (preset === "JEE") {
      setValue("templatePreset", "JEE");
      setValue("durationMin", 180);
      setValue("title", "JEE Main Test 01");
      setValue("instructions", "JEE Main Pattern: Physics (30Q), Chemistry (30Q), Mathematics (30Q). Max: 300 Marks (+4/-1).");
    } else if (preset === "CHAPTER_TEST") {
      setValue("templatePreset", "CHAPTER_TEST");
      setValue("durationMin", 60);
      setValue("title", "Chapter Assessment Test");
      setValue("instructions", "30 Questions, Maximum Marks: 120 (+4/-1).");
    } else {
      setValue("templatePreset", null);
      setValue("durationMin", 60);
    }
  }

  async function onSubmit(values: SeriesTestCreateInput) {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        templatePreset: selectedPreset === "BLANK" ? null : selectedPreset,
      };

      const res = await fetch(`/api/team/test-series/${testSeriesId}/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        toast.error(body.error ?? "Could not create the test.");
        return;
      }

      toast.success("Test created with systematic template sections!");
      reset();
      setOpen(false);
      router.push(`/team/tests/${body.data.test.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined">add_circle</span>
        Add Test with Template
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="glass-card p-6 rounded-2xl space-y-4 border border-outline-variant/40 animate-in fade-in"
      noValidate
    >
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
        <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          Create Test in Series
        </h4>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      {/* Systematic Blueprint Presets */}
      <div>
        <label className={labelClass}>Select Exam Blueprint Template</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { key: "NEET", title: "NEET UG (180Q / 720M)", sub: "Physics, Chem, Botany, Zoo (200m)" },
            { key: "JEE", title: "JEE Main (90Q / 300M)", sub: "Physics, Chem, Math (180m)" },
            { key: "CHAPTER_TEST", title: "Chapter Test (30Q / 120M)", sub: "Single Subject (60m)" },
          ].map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => handleSelectPreset(p.key as any)}
              className={`p-3 rounded-xl border text-left transition relative ${
                selectedPreset === p.key
                  ? "bg-primary/10 border-primary text-primary shadow-sm"
                  : "bg-surface-container-lowest border-outline-variant/40 hover:border-outline-variant"
              }`}
            >
              {selectedPreset === p.key && (
                <CheckCircle2 className="w-4 h-4 text-primary absolute top-2.5 right-2.5" />
              )}
              <p className="font-bold text-xs text-slate-900 dark:text-white">{p.title}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{p.sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>Test Title *</label>
        <input className={inputClass} placeholder="Full Syllabus Test — 01" {...register("title")} />
        {errors.title && <p className={errorClass}>{errors.title.message}</p>}
      </div>

      <div>
        <label className={labelClass}>Duration (minutes)</label>
        <input type="number" className={inputClass} {...register("durationMin", { valueAsNumber: true })} />
        {errors.durationMin && <p className={errorClass}>{errors.durationMin.message}</p>}
      </div>

      <div>
        <label className={labelClass}>Instructions / Marking Scheme (optional)</label>
        <textarea className={`${inputClass} min-h-[70px]`} {...register("instructions")} />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-5 py-2.5 rounded-xl border border-outline-variant font-label-md hover:bg-surface-container-lowest transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Award className="w-4 h-4" />
          <span>{submitting ? "Creating..." : "Create Test & Configure Sections"}</span>
        </button>
      </div>
    </form>
  );
}

const labelClass = "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5";
const errorClass = "text-xs font-bold text-error mt-1";
const inputClass =
  "w-full rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2.5 px-3 text-body-md outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";
