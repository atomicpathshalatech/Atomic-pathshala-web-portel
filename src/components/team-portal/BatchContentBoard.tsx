"use client";

import { useState } from "react";
import Link from "next/link";
import { BOX, BOX_GRID, BackToSubjects, SubjectBox, subjectTone } from "./batch-ui";

export type BatchChapterBox = {
  id: string;
  chapterId: string | null;
  title: string;
  status: string;
  subjectTitle: string;
  lectureCount: number;
  dppCount: number;
  testCount: number;
  sessionCount: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Content tab: one box per subject; opening a subject shows its chapters as boxes. */
export function BatchContentBoard({ chapters }: { chapters: BatchChapterBox[] }) {
  const subjects = Array.from(new Set(chapters.map((c) => c.subjectTitle))).sort();
  const [open, setOpen] = useState<string | null>(subjects.length === 1 ? subjects[0]! : null);

  if (!open || !subjects.includes(open)) {
    return (
      <div className={BOX_GRID}>
        {subjects.map((s) => {
          const list = chapters.filter((c) => c.subjectTitle === s);
          const lectures = list.reduce((n, c) => n + c.lectureCount, 0);
          return (
            <SubjectBox
              key={s}
              subject={s}
              onClick={() => setOpen(s)}
              lines={[plural(list.length, "chapter"), plural(lectures, "lecture")]}
            />
          );
        })}
      </div>
    );
  }

  const list = chapters.filter((c) => c.subjectTitle === open);
  const tone = subjectTone(open);
  return (
    <div className="space-y-3">
      {subjects.length > 1 && <BackToSubjects subject={open} onBack={() => setOpen(null)} />}
      <div className={BOX_GRID}>
        {list.map((c) => (
          <Link key={c.id} href={`/team/chapters/${c.id}`} className={`${BOX} ${tone.ring} hover:shadow-md flex flex-col gap-2`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${tone.chip}`}>{c.subjectTitle}</span>
              <span className="text-[10px] font-bold uppercase text-slate-500">{c.status.replace(/_/g, " ").toLowerCase()}</span>
            </div>
            <p className="font-bold text-sm text-slate-900 dark:text-white leading-snug line-clamp-2">{c.title}</p>
            {c.chapterId && <p className="text-[11px] font-mono text-slate-400">#{c.chapterId}</p>}
            <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-4 gap-1 text-center">
              {[
                ["Lectures", c.lectureCount],
                ["DPPs", c.dppCount],
                ["Tests", c.testCount],
                ["Classes", c.sessionCount],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{v}</p>
                  <p className="text-[10px] text-slate-500">{k}</p>
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
