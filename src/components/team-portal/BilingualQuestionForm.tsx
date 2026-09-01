"use client";

import { useState } from "react";
import { useForm, useFieldArray, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { bilingualQuestionSchema, type BilingualQuestionInput } from "@/lib/validation/question-v2";

type SubjectOption = {
  id: string;
  title: string;
  chapters: { id: string; title: string }[];
};

const TYPE_OPTIONS: { value: BilingualQuestionInput["type"]; label: string }[] = [
  { value: "SINGLE_CORRECT", label: "Single Correct (MCQ)" },
  { value: "MULTIPLE_CORRECT", label: "Multiple Correct" },
  { value: "INTEGER", label: "Integer Answer" },
  { value: "NUMERICAL", label: "Numerical Answer" },
  { value: "STATEMENT_BASED", label: "Statement Based" },
  { value: "MATCH_COLUMN", label: "Match the Column" },
  { value: "ASSERTION_REASON", label: "Assertion & Reason" },
];

const OPTION_FIELDS = ["optionA", "optionB", "optionC", "optionD"] as const;
const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export function BilingualQuestionForm({
  subjects,
  initialData,
  questionId,
}: {
  subjects: SubjectOption[];
  initialData?: Partial<BilingualQuestionInput>;
  questionId?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<BilingualQuestionInput>({
    resolver: zodResolver(bilingualQuestionSchema),
    defaultValues: {
      type: "SINGLE_CORRECT",
      difficulty: "MEDIUM",
      tags: [],
      translations: [
        { language: "ENGLISH", statement: "", correctOptionIds: [], optionA: "", optionB: "", optionC: "", optionD: "" },
      ],
      ...initialData,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "translations" });

  const type = watch("type");
  const subjectId = watch("subjectId");
  const tags = watch("tags") ?? [];
  const selectedSubject = subjects.find((s) => s.id === subjectId);
  const needsOptions = type !== "INTEGER" && type !== "NUMERICAL";
  const allowMultipleCorrect = type === "MULTIPLE_CORRECT";

  const includedLanguages = fields.map((f) => f.language);

  function toggleLanguage(language: "HINDI" | "ENGLISH") {
    const idx = fields.findIndex((f) => f.language === language);
    if (idx >= 0) {
      if (fields.length === 1) return; // keep at least one language
      remove(idx);
    } else {
      append({
        language,
        statement: "",
        correctOptionIds: [],
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
      });
    }
  }

  function toggleCorrectOption(index: number, letter: string) {
    const path = `translations.${index}.correctOptionIds` as const;
    const current = (watch(path) ?? []) as string[];
    if (allowMultipleCorrect) {
      setValue(
        path,
        current.includes(letter) ? current.filter((c) => c !== letter) : [...current, letter]
      );
    } else {
      setValue(path, [letter]);
    }
  }

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

  async function onSubmit(values: BilingualQuestionInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const url = questionId ? `/api/team/questions/bilingual/${questionId}` : "/api/team/questions/bilingual";
      const method = questionId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not save the question. Please check the fields.");
        return;
      }

      router.push("/team/questions");
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-gutter" noValidate>
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
        <h3 className="font-headline-md text-headline-md text-primary">Classification</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Question Type</label>
            <select className={inputClass} {...register("type")}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Difficulty</label>
            <select className={inputClass} {...register("difficulty")}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Subject</label>
            <select
              className={inputClass}
              value={subjectId ?? ""}
              onChange={(e) => {
                setValue("subjectId", e.target.value);
                setValue("chapterId", "");
              }}
            >
              <option value="">Select subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Chapter</label>
            <select className={inputClass} disabled={!selectedSubject} {...register("chapterId")}>
              <option value="">Select chapter...</option>
              {selectedSubject?.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Topic</label>
            <input className={inputClass} {...register("topic")} />
          </div>
          <div>
            <label className={labelClass}>Sub-topic</label>
            <input className={inputClass} {...register("subTopic")} />
          </div>
          <div>
            <label className={labelClass}>PYQ Source (optional)</label>
            <input className={inputClass} placeholder="e.g. NEET 2023" {...register("pyqSource")} />
          </div>
          <div>
            <label className={labelClass}>Question Code (optional)</label>
            <input className={inputClass} placeholder="Unique code, auto if left blank" {...register("questionCode")} />
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
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-on-surface-variant hover:text-error">
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
      </div>

      <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-md text-headline-md text-primary">Languages</h3>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-label-md">
              <input
                type="checkbox"
                checked={includedLanguages.includes("ENGLISH")}
                onChange={() => toggleLanguage("ENGLISH")}
              />
              English
            </label>
            <label className="flex items-center gap-2 text-label-md">
              <input
                type="checkbox"
                checked={includedLanguages.includes("HINDI")}
                onChange={() => toggleLanguage("HINDI")}
              />
              Hindi
            </label>
          </div>
        </div>
        {errors.translations?.root && <p className={errorClass}>{errors.translations.root.message}</p>}

        {fields.map((field, index) => {
          const correctOptionIds = (watch(`translations.${index}.correctOptionIds` as Path<BilingualQuestionInput>) ??
            []) as string[];
          return (
            <div key={field.id} className="rounded-xl border border-outline-variant p-4 space-y-stack-sm">
              <p className="text-label-md font-bold text-primary">{field.language === "ENGLISH" ? "English" : "Hindi"}</p>
              <textarea
                className={textareaClass}
                rows={4}
                placeholder="Question text"
                {...register(`translations.${index}.statement` as const)}
              />
              {errors.translations?.[index]?.statement && (
                <p className={errorClass}>{errors.translations[index]?.statement?.message}</p>
              )}

              {needsOptions ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {OPTION_FIELDS.map((optionField, i) => (
                    <div key={optionField} className="flex items-center gap-2">
                      <input
                        type={allowMultipleCorrect ? "checkbox" : "radio"}
                        name={`translations.${index}.correct`}
                        checked={correctOptionIds.includes(OPTION_LETTERS[i]!)}
                        onChange={() => toggleCorrectOption(index, OPTION_LETTERS[i]!)}
                      />
                      <input
                        className={inputClass}
                        placeholder={`Option ${OPTION_LETTERS[i]}`}
                        {...register(`translations.${index}.${optionField}` as const)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Correct Answer</label>
                  <input
                    className={inputClass}
                    placeholder="e.g. 42"
                    value={correctOptionIds[0] ?? ""}
                    onChange={(e) =>
                      setValue(`translations.${index}.correctOptionIds` as Path<BilingualQuestionInput>, [
                        e.target.value,
                      ])
                    }
                  />
                </div>
              )}
              {errors.translations?.[index]?.correctOptionIds && (
                <p className={errorClass}>{errors.translations[index]?.correctOptionIds?.message}</p>
              )}

              <textarea
                className={textareaClass}
                rows={2}
                placeholder="Solution / explanation (optional)"
                {...register(`translations.${index}.solution` as const)}
              />
            </div>
          );
        })}
      </div>

      <div className="glass-card p-stack-md rounded-xl">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-md shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : questionId ? "Save Changes" : "Save to Bank"}
        </button>
      </div>
    </form>
  );
}

const labelClass = "block text-label-sm font-label-md text-on-surface-variant mb-1.5";
const errorClass = "text-label-sm font-label-sm text-error mt-1";
const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const textareaClass =
  "w-full p-stack-md bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-body-md text-body-md";
