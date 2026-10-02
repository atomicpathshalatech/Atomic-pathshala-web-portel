"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { dppSchema, type DppInput } from "@/lib/validation/dpp";
import { DPP_LEVELS } from "@/lib/dpp/levels";
import { DPP_CLASSES, DPP_EXAMS } from "@/lib/dpp/hierarchy";
import { DppCoverPreview } from "@/components/team-portal/DppCoverPreview";

type SubjectOption = {
  id: string;
  title: string;
  chapters: { id: string; title: string }[];
};

type ChapterOption = { title: string; label: string; chapterId: string | null; classNumber: number | null };
type TopicOption = { title: string; subtopics: string[] };

const OTHER = "__other__";

/**
 * A dropdown fed by the syllabus, with "Type another…" for anything that
 * isn't listed. `value` is the chosen / typed text.
 */
function SelectOrType({
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder,
  loading,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  placeholder: string;
  loading?: boolean;
}) {
  const listed = !value || options.some((o) => o.value === value);
  const [typing, setTyping] = useState(false);
  const showInput = typing || !listed;
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {showInput ? (
        <div className="flex gap-2">
          <input
            className={inputClass}
            autoFocus={typing}
            value={value}
            disabled={disabled}
            placeholder={`Type ${label.toLowerCase()}…`}
            onChange={(e) => onChange(e.target.value)}
          />
          {options.length > 0 && (
            <button
              type="button"
              className="shrink-0 px-2 text-label-sm text-primary hover:underline"
              onClick={() => {
                setTyping(false);
                onChange("");
              }}
            >
              List
            </button>
          )}
        </div>
      ) : (
        <select
          className={inputClass}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setTyping(true);
              onChange("");
            } else onChange(e.target.value);
          }}
        >
          <option value="">{loading ? "Loading…" : placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value={OTHER}>✎ Type another…</option>
        </select>
      )}
    </div>
  );
}

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
  const [nameTouched, setNameTouched] = useState(false);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);

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
      className: "",
      exam: "NEET",
      chapterName: "",
      topic: "",
      subTopic: "",
    },
  });

  const v = watch();
  const subjectId = v.subjectId ?? "";
  const className = v.className ?? "";
  const chapterName = v.chapterName ?? "";
  const topic = v.topic ?? "";
  const selectedSubject = subjects.find((s) => s.id === subjectId);

  // Subject + Class → chapters of that class (syllabus + the team's own chapters).
  useEffect(() => {
    setChapters([]);
    if (!subjectId) return;
    let alive = true;
    setLoadingChapters(true);
    const qs = new URLSearchParams({ subjectId, className });
    fetch(`/api/team/dpp/taxonomy?${qs}`)
      .then((r) => r.json())
      .then((b) => {
        if (alive && b?.success) setChapters(b.data.chapters ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setLoadingChapters(false));
    return () => {
      alive = false;
    };
  }, [subjectId, className]);

  // Chapter → topics (with sub-topics) from the Question Bank syllabus.
  useEffect(() => {
    setTopics([]);
    if (!subjectId || !chapterName.trim()) return;
    let alive = true;
    setLoadingTopics(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ subjectId, chapter: chapterName.trim() });
      fetch(`/api/team/dpp/taxonomy?${qs}`)
        .then((r) => r.json())
        .then((b) => {
          if (alive && b?.success) setTopics(b.data.topics ?? []);
        })
        .catch(() => {})
        .finally(() => alive && setLoadingTopics(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [subjectId, chapterName]);

  const subtopicOptions = useMemo(() => topics.find((t) => t.title === topic)?.subtopics ?? [], [topics, topic]);

  // Suggest a name until the teacher types their own.
  useEffect(() => {
    if (nameTouched) return;
    const parts = [chapterName.trim(), topic.trim()].filter(Boolean);
    if (parts.length) setValue("name", parts.join(" — "));
  }, [chapterName, topic, nameTouched, setValue]);

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

  const previewInfo = useMemo(
    () => ({
      dppNumberLabel: v.dppNumber ? `DPP ${String(v.dppNumber).padStart(2, "0")}` : "DPP 01",
      name: v.name || "DPP name",
      subject: selectedSubject?.title ?? "",
      className: v.className,
      exam: v.exam,
      chapter: v.chapterName,
      topic: v.topic,
      subTopic: v.subTopic,
      questionCount: Number(v.questionTargetCount) || 0,
      difficulty: v.difficulty,
      teacher: v.facultyName,
      durationMin: Number(v.estimatedTimeMin) || null,
      correctMarks: Number.isFinite(Number(v.correctMarks)) ? Number(v.correctMarks) : null,
      incorrectMarks: Number.isFinite(Number(v.incorrectMarks)) ? Number(v.incorrectMarks) : null,
    }),
    [
      v.dppNumber,
      v.name,
      selectedSubject?.title,
      v.className,
      v.exam,
      v.chapterName,
      v.topic,
      v.subTopic,
      v.questionTargetCount,
      v.difficulty,
      v.facultyName,
      v.estimatedTimeMin,
      v.correctMarks,
      v.incorrectMarks,
    ]
  );

  const nameField = register("name");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-gutter min-w-0" noValidate>
        {serverError && (
          <div className="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3">
            <p className="text-label-sm font-label-sm text-error">{serverError}</p>
          </div>
        )}

        <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
          <p className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
            Syllabus — Subject → Class → Exam → Chapter → Topic → Sub-topic
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Subject</label>
              <select
                className={inputClass}
                value={subjectId}
                onChange={(e) => {
                  setValue("subjectId", e.target.value, { shouldValidate: true });
                  setValue("chapterId", "");
                  setValue("chapterName", "");
                  setValue("topic", "");
                  setValue("subTopic", "");
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
              <label className={labelClass}>Class</label>
              <select
                className={inputClass}
                value={className}
                disabled={!subjectId}
                onChange={(e) => {
                  setValue("className", e.target.value);
                  setValue("chapterName", "");
                  setValue("topic", "");
                  setValue("subTopic", "");
                }}
              >
                <option value="">All classes</option>
                {DPP_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <SelectOrType
              label="Exam"
              value={v.exam ?? ""}
              onChange={(x) => setValue("exam", x)}
              options={DPP_EXAMS.map((e) => ({ value: e, label: e }))}
              placeholder="Select exam..."
            />
          </div>

          <SelectOrType
            label="Chapter"
            value={chapterName}
            disabled={!subjectId}
            loading={loadingChapters}
            onChange={(x) => {
              setValue("chapterName", x);
              setValue("topic", "");
              setValue("subTopic", "");
            }}
            options={chapters.map((c) => ({
              value: c.title,
              label: `${c.classNumber && !className ? `[${c.classNumber}] ` : ""}${c.label}`,
            }))}
            placeholder={subjectId ? "Select chapter..." : "Select subject first"}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectOrType
              label="Topic"
              value={topic}
              disabled={!chapterName}
              loading={loadingTopics}
              onChange={(x) => {
                setValue("topic", x);
                setValue("subTopic", "");
              }}
              options={topics.map((t) => ({ value: t.title, label: t.title }))}
              placeholder={chapterName ? "Select topic..." : "Select chapter first"}
            />
            <SelectOrType
              label="Sub-topic (optional)"
              value={v.subTopic ?? ""}
              disabled={!topic}
              onChange={(x) => setValue("subTopic", x)}
              options={subtopicOptions.map((s) => ({ value: s, label: s }))}
              placeholder={topic ? "Select sub-topic..." : "Select topic first"}
            />
          </div>
        </div>

        <div className="glass-card p-stack-lg rounded-xl space-y-stack-md">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
            <div>
              <label className={labelClass}>DPP Name</label>
              <input
                className={inputClass}
                placeholder="Mole Concept — Basic Concepts"
                {...nameField}
                onChange={(e) => {
                  setNameTouched(true);
                  nameField.onChange(e);
                }}
              />
              {errors.name && <p className={errorClass}>{errors.name.message}</p>}
            </div>
            <div>
              <label className={labelClass}>DPP No.</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                placeholder="Auto"
                {...register("dppNumber", { setValueAs: (x) => (x === "" || x == null ? undefined : Number(x)) })}
              />
              {errors.dppNumber && <p className={errorClass}>{errors.dppNumber.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Teacher</label>
              <input className={inputClass} placeholder="Firoz Sir" {...register("facultyName")} />
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
                onClick={() => setValue("level", v.level === l.level ? undefined : (l.level as DppInput["level"]))}
                className={`w-full text-left rounded-xl border p-4 transition-colors ${
                  v.level === l.level
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
              <input type="number" className={inputClass} {...register("questionTargetCount", { valueAsNumber: true })} />
            </div>
            <div>
              <label className={labelClass}>Est. Time (min)</label>
              <input type="number" className={inputClass} {...register("estimatedTimeMin", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Correct Marks</label>
              <input type="number" step="0.5" className={inputClass} {...register("correctMarks", { valueAsNumber: true })} />
            </div>
            <div>
              <label className={labelClass}>Incorrect Marks</label>
              <input type="number" step="0.5" className={inputClass} {...register("incorrectMarks", { valueAsNumber: true })} />
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

      <aside className="xl:sticky xl:top-4 space-y-2">
        <p className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">PDF front page — live preview</p>
        <DppCoverPreview info={previewInfo} />
        <p className="text-label-sm text-on-surface-variant">
          Questions from the Question Bank follow this page. After creating, use <b>Preview</b> on the DPP page to see the whole booklet before downloading.
        </p>
      </aside>
    </div>
  );
}

const labelClass = "block text-label-sm font-label-md text-on-surface-variant mb-1.5";
const errorClass = "text-label-sm font-label-sm text-error mt-1";
const inputClass =
  "w-full rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-container-lowest py-2 px-3 text-body-md outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed";
