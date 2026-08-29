"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { questionSchema, type QuestionInput } from "@/lib/validation/question";

type SubjectOption = {
  id: string;
  title: string;
  chapters: { id: string; title: string }[];
};

export function QuestionForm({
  subjects,
  initialData,
  questionId,
}: {
  subjects: SubjectOption[];
  initialData?: Partial<QuestionInput>;
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
    formState: { errors },
  } = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      type: "MCQ",
      difficulty: "MEDIUM",
      tags: [],
      ...initialData,
    },
  });

  const type = watch("type");
  const subjectId = watch("subjectId");
  const tags = watch("tags") ?? [];
  const selectedSubject = subjects.find((s) => s.id === subjectId);

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

  async function onSubmit(values: QuestionInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const url = questionId ? `/api/team/questions/${questionId}` : "/api/team/questions";
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
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-gutter" noValidate>
      {/* Main column */}
      <div className="lg:col-span-2 space-y-gutter">
        {serverError && (
          <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
            <p className="text-label-sm font-label-sm text-error">{serverError}</p>
          </div>
        )}

        <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
          <h3 className="font-headline-md text-headline-md text-primary">Question Body</h3>
          <textarea
            className={textareaClass}
            rows={6}
            placeholder="Enter the question text. LaTeX support is planned for a later phase."
            {...register("body")}
          />
          {errors.body && <p className="text-label-sm font-label-sm text-error">{errors.body.message}</p>}
        </div>

        <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-md text-headline-md text-primary">Response Options</h3>
            <div className="flex bg-surface-container-high p-1 rounded-lg text-label-sm font-label-md">
              <button
                type="button"
                onClick={() => setValue("type", "MCQ")}
                className={`px-3 py-1.5 rounded-md transition-colors ${type === "MCQ" ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-surface-variant"}`}
              >
                MCQ
              </button>
              <button
                type="button"
                onClick={() => setValue("type", "INTEGER")}
                className={`px-3 py-1.5 rounded-md transition-colors ${type === "INTEGER" ? "bg-surface-container-lowest shadow-sm text-primary" : "text-on-surface-variant"}`}
              >
                Integer
              </button>
            </div>
          </div>

          {type === "MCQ" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                {(["A", "B", "C", "D"] as const).map((letter) => (
                  <div
                    key={letter}
                    className={`glass-card p-stack-md rounded-xl border-l-4 transition-all ${
                      watch("correctOption") === letter ? "border-primary" : "border-outline-variant"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-label-md text-label-md text-primary bg-primary-container/10 px-2 py-0.5 rounded">
                        Option {letter}
                      </span>
                      <input
                        type="radio"
                        checked={watch("correctOption") === letter}
                        onChange={() => setValue("correctOption", letter)}
                        className="w-5 h-5 text-primary focus:ring-primary"
                      />
                    </div>
                    <input
                      className="w-full bg-transparent border-none focus:ring-0 p-0 text-body-md"
                      placeholder="Enter option text..."
                      {...register(`option${letter}` as `optionA`)}
                    />
                  </div>
                ))}
              </div>
              {errors.optionA && (
                <p className="text-label-sm font-label-sm text-error">{errors.optionA.message}</p>
              )}
              {errors.correctOption && (
                <p className="text-label-sm font-label-sm text-error">{errors.correctOption.message}</p>
              )}
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface">Correct numeric answer</label>
              <input className={inputClass} placeholder="e.g. 42" {...register("correctOption")} />
              {errors.correctOption && (
                <p className="text-label-sm font-label-sm text-error">{errors.correctOption.message}</p>
              )}
            </div>
          )}
        </div>

        <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
          <h3 className="font-headline-md text-headline-md text-primary">Detailed Explanation</h3>
          <textarea
            className={textareaClass}
            rows={4}
            placeholder="Step-by-step solution for the student..."
            {...register("explanation")}
          />
        </div>
      </div>

      {/* Sidebar */}
      <aside className="space-y-stack-md">
        <div className="glass-card p-stack-md rounded-xl space-y-stack-md">
          <p className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">category</span>
            Classification
          </p>
          {subjects.length === 0 ? (
            <p className="text-label-sm font-label-sm text-on-surface-variant">
              No subjects exist yet — a Content Team member needs to add subjects/chapters first.
              You can still save this question unclassified.
            </p>
          ) : (
            <>
              <div>
                <p className="text-label-sm font-label-sm text-outline mb-1">Subject</p>
                <select
                  className={inputClass}
                  {...register("subjectId")}
                  onChange={(e) => {
                    setValue("subjectId", e.target.value);
                    setValue("chapterId", "");
                  }}
                >
                  <option value="">Unclassified</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-label-sm font-label-sm text-outline mb-1">Chapter</p>
                <select className={inputClass} disabled={!selectedSubject} {...register("chapterId")}>
                  <option value="">None</option>
                  {selectedSubject?.chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="glass-card p-stack-md rounded-xl space-y-stack-md">
          <p className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">psychology</span>
            Difficulty
          </p>
          <div className="flex flex-wrap gap-2">
            {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setValue("difficulty", d)}
                className={`px-3 py-1 rounded-full border text-label-sm transition-all ${
                  watch("difficulty") === d
                    ? "border-primary bg-primary/5 text-primary font-bold"
                    : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                }`}
              >
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-stack-md rounded-xl space-y-stack-sm">
          <p className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">sell</span>
            Keywords
          </p>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="bg-surface-container-high px-2 py-1 rounded text-label-sm flex items-center gap-1">
                #{tag}
                <button type="button" onClick={() => removeTag(tag)} className="text-on-surface-variant hover:text-error">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
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

        <div className="glass-card p-stack-md rounded-xl space-y-3">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-md shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : questionId ? "Save Changes" : "Save to Bank"}
          </button>
        </div>
      </aside>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all";

const textareaClass =
  "w-full p-stack-md bg-surface-container-lowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all font-body-md text-body-md";
