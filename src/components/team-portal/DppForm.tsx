"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { dppSchema, type DppInput } from "@/lib/validation/dpp";
import { DPP_LEVELS } from "@/lib/dpp/levels";

type SubjectOption = {
  id: string;
  title: string;
  chapters: { id: string; title: string }[];
};

export function DppForm({
  subjects,
  defaultFacultyName,
}: {
  subjects: SubjectOption[];
  defaultFacultyName?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DppInput>({
    resolver: zodResolver(dppSchema),
    defaultValues: {
      languageMode: "BOTH",
      difficulty: "MEDIUM",
      questionTargetCount: 10,
      estimatedTimeMin: 30,
      correctMarks: 4,
      incorrectMarks: -1,
      negativeMarkingEnabled: true,
      topics: [],
      tags: [],
      facultyName: defaultFacultyName ?? "",
    },
  });

  const subjectId = watch("subjectId");
  const chapterId = watch("chapterId");
  const level = watch("level");
  const topics = watch("topics") ?? [];
  const selectedSubject = subjects.find((s) => s.id === subjectId);

  function addTopic() {
    const value = topicInput.trim();
    if (value && !topics.includes(value)) {
      setValue("topics", [...topics, value]);
    }
    setTopicInput("");
  }

  function removeTopic(topic: string) {
    setValue(
      "topics",
      topics.filter((t) => t !== topic)
    );
  }

  async function onSubmit(values: DppInput) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/team/dpp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setServerError(body.error ?? "Could not create the DPP. Please check the fields.");
        return;
      }

      router.push(`/team/dpp/${body.data.dpp.id}`);
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-gutter" noValidate>
      {serverError && (
        <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-label-sm font-label-sm text-error">{serverError}</p>
        </div>
      )}

      <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
        <div>
          <label className={labelClass}>DPP Name</label>
          <input className={inputClass} placeholder="Mole Concept — Basic Concepts" {...register("name")} />
          {errors.name && <p className={errorClass}>{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Subject</label>
            <select
              className={inputClass}
              value={subjectId ?? ""}
              onChange={(e) => {
                setValue("subjectId", e.target.value);
                setValue("chapterId", "");
                setValue("topics", []);
              }}
            >
              <option value="">Select subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            {errors.subjectId && <p className={errorClass}>{errors.subjectId.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Chapter</label>
            <select className={inputClass} disabled={!selectedSubject} {...register("chapterId")}>
              <option value="">Select or type a chapter...</option>
              {selectedSubject?.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Topics (optional — select all that this DPP covers)</label>
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {topics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1 bg-primary-container/30 text-primary px-3 py-1 rounded-full text-label-sm"
                >
                  {topic}
                  <button
                    type="button"
                    onClick={() => removeTopic(topic)}
                    className="text-on-surface-variant hover:text-error"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            className={inputClass}
            placeholder={chapterId ? "Add a topic and press Enter" : "Select chapter first"}
            disabled={!chapterId}
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTopic();
              }
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Faculty (display name)</label>
            <input className={inputClass} placeholder="By Firoz Sir" {...register("facultyName")} />
          </div>
          <div>
            <label className={labelClass}>Language</label>
            <select className={inputClass} {...register("languageMode")}>
              <option value="BOTH">Both</option>
              <option value="HINDI">Hindi</option>
              <option value="ENGLISH">English</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
        <label className={labelClass}>DPP Level (optional — defines the question style for this DPP)</label>
        <div className="space-y-2">
          {DPP_LEVELS.map((l) => (
            <button
              key={l.level}
              type="button"
              onClick={() => setValue("level", level === l.level ? undefined : (l.level as DppInput["level"]))}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${
                level === l.level
                  ? "border-primary bg-primary-container/15"
                  : "border-outline-variant hover:bg-surface-container-lowest"
              }`}
            >
              <p className="text-label-sm font-bold text-on-surface-variant tracking-wide uppercase">
                Level {l.level} · {l.title}
              </p>
              <p className="text-label-sm text-on-surface-variant mt-0.5">{l.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Difficulty</label>
            <select className={inputClass} {...register("difficulty")}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Questions</label>
            <input
              type="number"
              className={inputClass}
              {...register("questionTargetCount", { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className={labelClass}>Est. Time (min)</label>
            <input
              type="number"
              className={inputClass}
              {...register("estimatedTimeMin", { valueAsNumber: true })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Correct Marks</label>
            <input
              type="number"
              step="0.5"
              className={inputClass}
              {...register("correctMarks", { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className={labelClass}>Incorrect Marks</label>
            <input
              type="number"
              step="0.5"
              className={inputClass}
              {...register("incorrectMarks", { valueAsNumber: true })}
            />
          </div>
        </div>
      </div>

      <div className="glass-card p-stack-md rounded-xl">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-primary text-on-primary font-label-md shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create DPP & Add Questions →"}
        </button>
      </div>
    </form>
  );
}

const labelClass = "block text-label-sm font-label-md text-on-surface-variant mb-1.5";
const errorClass = "text-label-sm font-label-sm text-error mt-1";
const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";
