"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

export interface ChapterExerciseItem {
  id: string;
  exerciseCode: string;
  title: string;
  subtitle: string | null;
  subject: string;
  chapter: string;
  exerciseType: string;
  status: string;
  _count: {
    questions: number;
    sections: number;
    attempts?: number;
  };
}

export interface ChapterModuleItem {
  subject: string;
  chapter: string;
  totalQuestions: number;
  exercises: ChapterExerciseItem[];
}

interface ChapterModulesGridProps {
  chapterModules: ChapterModuleItem[];
}

const COLUMNS = [
  { key: "physics", label: "Physics", match: (s: string) => s.includes("phys"), tone: "text-blue-700 dark:text-blue-300", bar: "bg-blue-500" },
  { key: "chemistry", label: "Chemistry", match: (s: string) => s.includes("chem"), tone: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
  {
    key: "biology",
    label: "Biology",
    match: (s: string) => s.includes("bio") || s.includes("bot") || s.includes("zoo"),
    tone: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
] as const;

/**
 * Chapter modules in three columns — Physics | Chemistry | Biology (a fourth,
 * "Other", only if some chapter belongs to another subject). Each chapter
 * opens to its exercises.
 */
export function ChapterModulesGrid({ chapterModules }: ChapterModulesGridProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const keyOf = (cm: ChapterModuleItem) => `${cm.subject.trim().toLowerCase()}:::${cm.chapter.trim().toLowerCase()}`;

  const columns: { key: string; label: string; tone: string; bar: string; items: ChapterModuleItem[] }[] = COLUMNS.map((c) => ({
    key: c.key,
    label: c.label,
    tone: c.tone,
    bar: c.bar,
    items: chapterModules.filter((cm) => c.match(cm.subject.toLowerCase())),
  }));
  const other = chapterModules.filter((cm) => !COLUMNS.some((c) => c.match(cm.subject.toLowerCase())));
  if (other.length) columns.push({ key: "other", label: "Other", tone: "text-violet-700 dark:text-violet-300", bar: "bg-violet-500", items: other });

  return (
    <div
      className={`grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 ${
        columns.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"
      }`}
    >
      {columns.map((col) => (
        <section key={col.key} className="min-w-0">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/80">
            <div className="flex items-center gap-2">
              <span className={`h-4 w-1 rounded-full ${col.bar}`} />
              <h2 className={`text-sm font-black uppercase tracking-wide ${col.tone}`}>{col.label}</h2>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {col.items.length} {col.items.length === 1 ? "chapter" : "chapters"} · {col.items.reduce((n, cm) => n + cm.totalQuestions, 0)} Qs
            </span>
          </header>

          <div className="space-y-2 p-3">
            {col.items.length === 0 && <p className="px-1 py-6 text-center text-xs text-slate-400">No chapter modules yet.</p>}
            {col.items.map((cm) => {
              const key = keyOf(cm);
              const isOpen = Boolean(open[key]);
              return (
                <div
                  key={key}
                  className={`rounded-xl border transition ${
                    isOpen ? "border-amber-400 shadow-sm" : "border-slate-200 hover:border-amber-300 dark:border-slate-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold leading-snug text-slate-900 dark:text-white line-clamp-2" title={cm.chapter}>
                        {cm.chapter}
                      </h3>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <BookOpen className="h-3 w-3 text-amber-500" />
                        {cm.exercises.length} {cm.exercises.length === 1 ? "exercise" : "exercises"} · {cm.totalQuestions} Qs
                      </span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="space-y-1 border-t border-slate-100 p-2 dark:border-slate-800">
                      {cm.exercises.map((ex) => (
                        <Link
                          key={ex.id}
                          href={`/team/exercises/${ex.id}`}
                          className="group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-amber-50 dark:hover:bg-slate-800"
                        >
                          <span className="truncate text-xs font-bold text-slate-800 group-hover:text-amber-700 dark:text-slate-200">{ex.title}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {ex._count.questions} Qs
                            </span>
                            <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-amber-600" />
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
