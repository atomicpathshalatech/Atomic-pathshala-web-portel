"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { UnifiedQuestionEditor } from "@/components/questions/UnifiedQuestionEditor";
import type { SimilarityHit } from "@/lib/exercises/module-similarity";

type LastCheck = { questionCode: string | null; exerciseQuestionId: string; number: number; hits: SimilarityHit[]; compared: number; removed?: boolean };

interface Props {
  exercise: { id: string; title: string; subject: string; chapter: string; exerciseType: string; questionCount: number };
  sections: { id: string; title: string; topic: string | null; subTopic: string | null }[];
  initialSectionId: string | null;
}

/** Year in a PYQ part title ("NEET 2023") — the new question's PYQ year. */
function yearOf(title: string): number | undefined {
  const m = title.match(/\b(19[89]\d|20[0-4]\d)\b/);
  return m ? Number(m[1]) : undefined;
}

export function ExerciseQuestionAuthor({ exercise, sections, initialSectionId }: Props) {
  const [sectionId, setSectionId] = useState<string>(initialSectionId ?? "");
  const [added, setAdded] = useState(0);
  // A fresh, empty editor after each saved question (subject, chapter and part stay).
  const [editorKey, setEditorKey] = useState(0);
  // Similarity of the question just saved with the rest of the chapter module.
  const [lastCheck, setLastCheck] = useState<LastCheck | null>(null);

  const checkSimilarity = async (questionId: string, questionCode: string | null) => {
    try {
      const res = await fetch(`/api/team/exercises/${exercise.id}/similarity?questionId=${encodeURIComponent(questionId)}`);
      const json = await res.json();
      if (json.success) setLastCheck({ questionCode, ...json.data });
    } catch {
      // the check is a help; saving already worked
    }
  };

  const removeLast = async () => {
    if (!lastCheck) return;
    const res = await fetch(`/api/team/exercises/${exercise.id}/questions/${lastCheck.exerciseQuestionId}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (json?.success) {
      setLastCheck({ ...lastCheck, removed: true });
      setAdded((n) => Math.max(0, n - 1));
    }
  };

  const section = sections.find((s) => s.id === sectionId) ?? null;
  const backHref = `/team/exercises/${exercise.id}${section ? `#section-${section.id}` : ""}`;

  const initialQuestion = useMemo(() => {
    const isNeet = exercise.exerciseType === "NEET_PYQ";
    const isJee = exercise.exerciseType === "JEE_PYQ";
    const year = section ? yearOf(section.title) : undefined;
    return {
      subject: exercise.subject,
      chapter: exercise.chapter,
      topic: section?.topic || "",
      subTopic: section?.subTopic || "",
      category: isNeet ? "NEET_PYQ" : isJee ? "JEE_MAINS_PYQ" : exercise.exerciseType === "NCERT" ? "NCERT Canonical" : undefined,
      pyqExam: isNeet ? "NEET" : isJee ? "JEE_MAINS" : undefined,
      pyqYear: (isNeet || isJee) && year ? year : undefined,
    };
    // editorKey: each new editor starts from these values again
  }, [exercise, section]);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={backHref}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700"
            title="Back to the exercise"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
              {exercise.subject} · {exercise.chapter}
            </p>
            <h1 className="text-base font-black text-slate-900 dark:text-white truncate">
              Add New Question — {exercise.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {sections.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Add to
              <select
                value={sectionId}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  setEditorKey((k) => k + 1);
                }}
                className="h-9 max-w-[16rem] rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Auto (by the question&apos;s topic)</option>
                {sections.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    Part {i + 1}: {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {exercise.questionCount + added} in this exercise{added > 0 ? ` (${added} added now)` : ""}
          </span>
        </div>
      </div>

      {lastCheck && (() => {
        const top = lastCheck.hits[0];
        const tone = !top || top.score < 60
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          : top.score >= 90
          ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
        return (
          <div className={`rounded-2xl border px-4 py-3 text-xs ${tone}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">
                {lastCheck.removed
                  ? `Q.${lastCheck.number} (${lastCheck.questionCode ?? ""}) was removed from this exercise.`
                  : !top || top.score < 60
                  ? `Saved Q.${lastCheck.number} (${lastCheck.questionCode ?? ""}) — no similar question among the ${lastCheck.compared} in this chapter module.`
                  : `Saved Q.${lastCheck.number} (${lastCheck.questionCode ?? ""}) is ${top.score}% similar to ${top.match.exerciseTitle} Q.${top.match.number} — ${top.reason}`}
              </p>
              {!lastCheck.removed && top && top.score >= 60 && (
                <button
                  type="button"
                  onClick={removeLast}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove it from the exercise
                </button>
              )}
            </div>
            {!lastCheck.removed && top && top.score >= 60 && (
              <ul className="mt-2 space-y-1">
                {lastCheck.hits.map((h) => (
                  <li key={h.match.exerciseQuestionId} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <b>{h.score}%</b> {h.match.exerciseTitle} Q.{h.match.number} ({h.match.questionCode}) — {h.match.preview}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      <UnifiedQuestionEditor
        key={`${editorKey}-${sectionId}`}
        mode="exercise"
        exerciseId={exercise.id}
        exerciseSectionId={sectionId || undefined}
        initialQuestion={initialQuestion}
        slotNumber={exercise.questionCount + added + 1}
        totalSlots={exercise.questionCount + added + 1}
        syllabus={[{ subject: exercise.subject, chapter: exercise.chapter, topics: [] }]}
        onCancelHref={backHref}
        onSaveSuccess={(saved) => {
          setAdded((n) => n + 1);
          if (saved?.id) void checkSimilarity(saved.id, saved.questionCode ?? null);
          setEditorKey((k) => k + 1);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
