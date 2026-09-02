"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { testCreateSchema, type TestCreateInput } from "@/lib/validation/test";
import { Layers, Sparkles, CheckCircle2, BookOpen, Clock, Award, ShieldAlert } from "lucide-react";

type ScheduleOption = {
  id: string;
  title: string;
  batchName: string;
  startsAt: string;
  endsAt: string;
};

type TestSeriesOption = {
  id: string;
  name: string;
  code: string;
  targetBatch?: string | null;
  course?: string | null;
};

type TemplateOption = {
  id: string;
  name: string;
  description: string | null;
  sections: Array<{
    id: string;
    name: string;
    subject: string;
    targetCount: number;
    marksPerQuestion: number | null;
    negativeMarks: number | null;
  }>;
};

type Props =
  | {
      mode: "create";
      scheduleOptions: ScheduleOption[];
      testSeriesOptions?: TestSeriesOption[];
      templates?: TemplateOption[];
      initialTestSeriesId?: string;
    }
  | {
      mode: "edit";
      testId: string;
      initialData: { title: string; instructions: string | null; durationMin: number };
    };

const inputClass =
  "w-full rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2.5 px-3.5 text-body-md outline-none transition-all";

export function TestForm(props: Props) {
  const router = useRouter();
  const isCreate = props.mode === "create";
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Template / Blueprint Selection
  const [selectedBlueprint, setSelectedBlueprint] = useState<"NEET" | "JEE" | "CHAPTER_TEST" | "CUSTOM" | "BLANK">("NEET");
  const [selectedCustomTemplateId, setSelectedCustomTemplateId] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TestCreateInput>({
    resolver: zodResolver(testCreateSchema),
    defaultValues: isCreate
      ? {
          testSeriesId: (props as any).initialTestSeriesId || "",
          batchScheduleId: "",
          templatePreset: "NEET",
          templateId: "",
          title: "NEET UG Full Mock Test — 01",
          instructions: "+4 for correct response, -1 for incorrect response. All sections are mandatory.",
          durationMin: 200,
        }
      : {
          batchScheduleId: "",
          title: props.initialData.title,
          instructions: props.initialData.instructions ?? "",
          durationMin: props.initialData.durationMin,
        },
  });

  const durationMin = watch("durationMin");

  function handleSelectBlueprint(preset: "NEET" | "JEE" | "CHAPTER_TEST" | "CUSTOM" | "BLANK") {
    setSelectedBlueprint(preset);

    if (preset === "NEET") {
      setValue("templatePreset", "NEET");
      setValue("templateId", "");
      setValue("durationMin", 200);
      setValue("title", "NEET UG Full Mock Test — 01");
      setValue("instructions", "NEET UG Examination Pattern: Physics (50Q), Chemistry (50Q), Botany (50Q), Zoology (50Q). Max Marks: 720 (+4/-1).");
    } else if (preset === "JEE") {
      setValue("templatePreset", "JEE");
      setValue("templateId", "");
      setValue("durationMin", 180);
      setValue("title", "JEE Main Full Syllabus Test — 01");
      setValue("instructions", "JEE Main Pattern: Physics (30Q), Chemistry (30Q), Mathematics (30Q). Max Marks: 300 (+4/-1).");
    } else if (preset === "CHAPTER_TEST") {
      setValue("templatePreset", "CHAPTER_TEST");
      setValue("templateId", "");
      setValue("durationMin", 60);
      setValue("title", "Chapter Assessment Test");
      setValue("instructions", "30 Questions, Maximum Marks: 120 (+4/-1). Time limit: 60 minutes.");
    } else if (preset === "CUSTOM") {
      setValue("templatePreset", "CUSTOM");
      setValue("templateId", selectedCustomTemplateId || "");
      setValue("durationMin", 180);
    } else {
      setValue("templatePreset", null);
      setValue("templateId", "");
      setValue("durationMin", 60);
    }
  }

  async function onSubmit(values: TestCreateInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const url = isCreate ? "/api/team/tests" : `/api/team/tests/${(props as { testId: string }).testId}`;
      const payload = isCreate
        ? {
            ...values,
            templatePreset: selectedBlueprint === "BLANK" ? null : selectedBlueprint === "CUSTOM" ? null : selectedBlueprint,
            templateId: selectedBlueprint === "CUSTOM" ? selectedCustomTemplateId : values.templateId || null,
          }
        : { title: values.title, instructions: values.instructions, durationMin: values.durationMin };

      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setServerError(json.error ?? "Could not save this test.");
        return;
      }
      const testId = isCreate ? json.data.test.id : (props as { testId: string }).testId;
      router.push(`/team/tests/${testId}`);
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const scheduleOptions = isCreate ? props.scheduleOptions : [];
  const testSeriesOptions = isCreate ? props.testSeriesOptions || [] : [];
  const templates = isCreate ? props.templates || [] : [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-2xl px-4 py-3 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-error shrink-0" />
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      {/* 1. SYSTEMATIC EXAM BLUEPRINT SELECTOR */}
      {isCreate && (
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                1. Select Exam Pattern / Template Blueprint
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically configures subjects, sections, question counts, and marking scheme.
              </p>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              Systematic Setup
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* NEET Preset */}
            <button
              type="button"
              onClick={() => handleSelectBlueprint("NEET")}
              className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                selectedBlueprint === "NEET"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20"
                  : "bg-surface-container-lowest border-outline-variant/40 hover:border-outline-variant"
              }`}
            >
              {selectedBlueprint === "NEET" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 absolute top-3 right-3" />
              )}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                  Medical
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">NEET UG Blueprint</h3>
                <p className="text-xs text-slate-500 mt-1">180 Qs · 720 Marks</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                Physics, Chemistry, Botany &amp; Zoology
              </p>
            </button>

            {/* JEE Preset */}
            <button
              type="button"
              onClick={() => handleSelectBlueprint("JEE")}
              className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                selectedBlueprint === "JEE"
                  ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20"
                  : "bg-surface-container-lowest border-outline-variant/40 hover:border-outline-variant"
              }`}
            >
              {selectedBlueprint === "JEE" && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 absolute top-3 right-3" />
              )}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                  Engineering
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">JEE Main Blueprint</h3>
                <p className="text-xs text-slate-500 mt-1">90 Qs · 300 Marks</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                Physics, Chemistry &amp; Mathematics
              </p>
            </button>

            {/* Chapter Test Preset */}
            <button
              type="button"
              onClick={() => handleSelectBlueprint("CHAPTER_TEST")}
              className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                selectedBlueprint === "CHAPTER_TEST"
                  ? "bg-purple-50 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20"
                  : "bg-surface-container-lowest border-outline-variant/40 hover:border-outline-variant"
              }`}
            >
              {selectedBlueprint === "CHAPTER_TEST" && (
                <CheckCircle2 className="w-4 h-4 text-purple-600 absolute top-3 right-3" />
              )}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-full">
                  Topic Test
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">Chapter Assessment</h3>
                <p className="text-xs text-slate-500 mt-1">30 Qs · 120 Marks</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                Single Subject Quick Evaluation
              </p>
            </button>

            {/* Custom Template / Saved Templates */}
            <button
              type="button"
              onClick={() => handleSelectBlueprint("CUSTOM")}
              className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                selectedBlueprint === "CUSTOM"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20"
                  : "bg-surface-container-lowest border-outline-variant/40 hover:border-outline-variant"
              }`}
            >
              {selectedBlueprint === "CUSTOM" && (
                <CheckCircle2 className="w-4 h-4 text-amber-600 absolute top-3 right-3" />
              )}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                  Custom
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-2">Custom Template</h3>
                <p className="text-xs text-slate-500 mt-1">{templates.length} saved templates</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                Pick a custom saved blueprint
              </p>
            </button>
          </div>

          {/* Custom Template Picker if selected */}
          {selectedBlueprint === "CUSTOM" && templates.length > 0 && (
            <div className="pt-2 animate-in fade-in">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Choose Saved Template Blueprint
              </label>
              <select
                value={selectedCustomTemplateId}
                onChange={(e) => {
                  setSelectedCustomTemplateId(e.target.value);
                  setValue("templateId", e.target.value);
                }}
                className={inputClass}
              >
                <option value="">Select a saved template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.sections.length} sections)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* 2. TEST DETAILS & METADATA */}
      <fieldset className="glass-card p-6 rounded-2xl space-y-4">
        <legend className="font-headline-md text-headline-md text-primary mb-2 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          2. Test Details &amp; Target Association
        </legend>

        {isCreate && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Link to Test Series */}
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Test Series (Optional)</label>
              <select className={inputClass} {...register("testSeriesId")}>
                <option value="">Standalone / Not in a Series</option>
                {testSeriesOptions.map((ts) => (
                  <option key={ts.id} value={ts.id}>
                    {ts.code} — {ts.name} {ts.course ? `(${ts.course})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Associate this test inside a student-enrolled Test Series.
              </p>
            </div>

            {/* Link to Schedule Slot */}
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Batch Timetable Slot (Optional)</label>
              <select className={inputClass} {...register("batchScheduleId")}>
                <option value="">No Timetable Binding</option>
                {scheduleOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.batchName} — {s.title} ({new Date(s.startsAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Optional: bind to a batch live timetable test window.
              </p>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Test Title *</label>
          <input className={inputClass} placeholder="e.g. NEET 2027 Major Full Syllabus Test 01" {...register("title")} />
          {errors.title && <p className="text-label-sm font-label-sm text-error">{errors.title.message}</p>}
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />
            Duration (minutes)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={600}
              className={inputClass + " max-w-xs"}
              {...register("durationMin", { valueAsNumber: true })}
            />
            <div className="flex items-center gap-1.5">
              {[60, 180, 200].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setValue("durationMin", mins)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    durationMin === mins
                      ? "bg-primary text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-primary"
                  }`}
                >
                  {mins} mins
                </button>
              ))}
            </div>
          </div>
          {errors.durationMin && (
            <p className="text-label-sm font-label-sm text-error">{errors.durationMin.message}</p>
          )}
        </div>

        {/* Instructions */}
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface">Instructions / Marking Scheme</label>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Marking scheme notes, negative marking rules, calculator allowed/not, etc."
            {...register("instructions")}
          />
        </div>
      </fieldset>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-xl border border-outline-variant font-label-md hover:bg-surface-container-lowest transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="bg-primary text-on-primary font-bold text-sm px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting ? (
            "Creating Systematic Test..."
          ) : (
            <>
              <span>{isCreate ? "Create Test with Template" : "Save Changes"}</span>
              <Award className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
