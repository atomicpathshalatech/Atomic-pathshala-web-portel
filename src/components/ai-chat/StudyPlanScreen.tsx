"use client";

import { CheckCircle2, Circle, Loader2, RefreshCw, Target } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type TaskType = "REVISE" | "PRACTICE" | "TEST" | "CLASS";

interface StudyPlanTask {
  id: string;
  date: string;
  subject: string;
  description: string;
  taskType: TaskType;
  completed: boolean;
}

interface StudyPlan {
  id: string;
  summary: string;
  generatedAt: string;
  tasks: StudyPlanTask[];
}

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  REVISE: "Revise",
  PRACTICE: "Practice",
  TEST: "Test",
  CLASS: "Class",
};

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function StudyPlanScreen() {
  const [plan, setPlan] = useState<StudyPlan | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/ai-chat/study-plan", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load your study plan.");
        return res.json() as Promise<{ plan: StudyPlan | null }>;
      })
      .then((body) => setPlan(body.plan))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your study plan."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-chat/study-plan/generate", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not generate a plan.");
      setPlan(body.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate a plan.");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleTask(task: StudyPlanTask) {
    setTogglingId(task.id);
    try {
      const res = await fetch(`/api/ai-chat/study-plan/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (!res.ok) return;
      const body = await res.json();
      setPlan((prev) =>
        prev
          ? { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? body.task : t)) }
          : prev
      );
    } finally {
      setTogglingId(null);
    }
  }

  const grouped = plan?.tasks.reduce<Record<string, StudyPlanTask[]>>((acc, task) => {
    const key = task.date.slice(0, 10);
    (acc[key] ??= []).push(task);
    return acc;
  }, {});

  return (
    <main className="min-h-dvh bg-gradient-to-b from-orange-50/40 to-white dark:from-slate-950 dark:to-atomic-navy">
      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-atomic-orange">Atomic Pathshala</p>
            <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
              <Target className="h-6 w-6 text-atomic-orange" />
              Study Plan
            </h1>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl bg-atomic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-atomic-orange-dark disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {plan ? "Regenerate" : "Generate my plan"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {plan === undefined ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : !plan ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center">
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              No study plan yet. Generate one and Atomic Guru will build a 7-day plan from your
              actual progress — weak chapters, streak, and recent scores.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
              {plan.summary}
            </div>

            {Object.entries(grouped ?? {}).map(([date, tasks]) => (
              <div key={date}>
                <p className="text-xs font-semibold uppercase text-slate-400 mb-2">{dayLabel(date)}</p>
                <div className="flex flex-col gap-2">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task)}
                      disabled={togglingId === task.id}
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        task.completed
                          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                          : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      }`}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-slate-300 mt-0.5" />
                      )}
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-atomic-orange">
                          {task.subject} · {TASK_TYPE_LABEL[task.taskType]}
                        </span>
                        <span
                          className={`block text-sm ${
                            task.completed ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {task.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
