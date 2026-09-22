"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Video, Layers, ArrowRight, Sparkles } from "lucide-react";

export interface TeacherChapterCardData {
  id: string;
  chapterId?: string | null;
  title: string;
  medium: string;
  status: string;
  subjectTitle?: string;
  courseTitle?: string;
  lectureCount: number;
  assignedBatches: { id: string; name: string }[];
}

export function TeacherProfileChaptersSection({
  chapters,
}: {
  chapters: TeacherChapterCardData[];
}) {
  if (!chapters || chapters.length === 0) {
    return (
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>My Chapters & Live Teaching</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Access your assigned chapters to manage lectures and start live classes.
            </p>
          </div>
          <Link
            href="/team/chapters"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>Browse All Chapters</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          No chapters directly assigned yet. Visit the Chapters directory to create or open a chapter.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>My Chapters & Live Classes</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quickly open any chapter to view scheduled lectures and launch live classes.
          </p>
        </div>
        <Link
          href="/team/chapters"
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <span>View All Chapters</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {chapters.map((ch) => (
          <div
            key={ch.id}
            className="group relative flex flex-col justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition shadow-2xs"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                  {ch.subjectTitle || "Subject"}
                </span>
                {ch.courseTitle && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[140px]">
                    {ch.courseTitle}
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                {ch.title}
              </h3>

              {/* Batches indicator */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {ch.assignedBatches && ch.assignedBatches.length > 0 ? (
                  ch.assignedBatches.map((b) => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      <Layers className="w-2.5 h-2.5 text-blue-500" />
                      {b.name}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    Not assigned to specific batch
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {ch.lectureCount} {ch.lectureCount === 1 ? "lecture" : "lectures"}
              </span>

              <Link
                href={`/team/chapters/${ch.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Open & Start Class →</span>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
