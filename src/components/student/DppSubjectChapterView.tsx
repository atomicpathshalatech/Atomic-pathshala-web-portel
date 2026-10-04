"use client";

import React, { useState } from "react";
import Link from "next/link";

export interface RealDPPItem {
  id: string;
  code: string;
  title: string;
  subject: string;
  chapter: string;
  difficulty: string;
  questionCount: number;
  durationMins: number;
  totalMarks: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "UPCOMING";
  score?: number | null;
  pdfUrl?: string | null;
  testId?: string | null;
  startsAt?: string | null;
  /** Published with questions added — only then can it be attempted/downloaded. */
  ready?: boolean;
  /** Where "Attempt" goes (chapter DPPs: /dpp/<id>/attempt). */
  attemptHref?: string | null;
}

export interface RealChapterGroup {
  id: string;
  chapterNumber: number;
  title: string;
  dpps: RealDPPItem[];
}

export interface RealSubjectGroup {
  id: string;
  name: string;
  icon: string;
  color: string;
  gradient: string;
  badgeBg: string;
  chapters: RealChapterGroup[];
}

const done = (list: RealDPPItem[]) => list.filter((d) => d.status === "COMPLETED").length;

/**
 * My DPP — simple boxes, one level at a time:
 * Subject → Chapter → that chapter's DPPs.
 */
export function DppSubjectChapterView({ subjects = [] }: { subjects: RealSubjectGroup[] }) {
  const withDpps = subjects.filter((s) => s.chapters.some((c) => c.dpps.length > 0));
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);

  const subject = withDpps.find((s) => s.id === subjectId) ?? null;
  const chapter = subject?.chapters.find((c) => c.id === chapterId) ?? null;

  if (withDpps.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
        <span className="material-symbols-outlined text-4xl text-slate-300">assignment_late</span>
        <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100">No DPPs yet</p>
        <p className="mt-1 text-xs text-slate-500">DPPs from your faculty will appear here, subject and chapter wise.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => {
            setSubjectId(null);
            setChapterId(null);
          }}
          className={`font-semibold ${subject ? "text-blue-700 hover:underline" : "text-slate-900 dark:text-white"}`}
        >
          Subjects
        </button>
        {subject && (
          <>
            <span className="material-symbols-outlined text-base text-slate-400">chevron_right</span>
            <button type="button" onClick={() => setChapterId(null)} className={`font-semibold ${chapter ? "text-blue-700 hover:underline" : "text-slate-900 dark:text-white"}`}>
              {subject.name}
            </button>
          </>
        )}
        {chapter && (
          <>
            <span className="material-symbols-outlined text-base text-slate-400">chevron_right</span>
            <span className="font-semibold text-slate-900 dark:text-white">{chapter.title}</span>
          </>
        )}
      </nav>

      {/* 1. Subjects */}
      {!subject && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {withDpps.map((s) => {
            const all = s.chapters.flatMap((c) => c.dpps);
            const chapters = s.chapters.filter((c) => c.dpps.length > 0).length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSubjectId(s.id)}
                className="flex flex-col items-start gap-1.5 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className={`material-symbols-outlined text-2xl ${s.color || "text-blue-600"}`}>{s.icon || "science"}</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">{s.name}</span>
                <span className="text-xs text-slate-500">
                  {chapters} chapter{chapters === 1 ? "" : "s"} · {all.length} DPP{all.length === 1 ? "" : "s"}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600">
                  {done(all)}/{all.length} done
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Chapters of the subject */}
      {subject && !chapter && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {subject.chapters
            .filter((c) => c.dpps.length > 0)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChapterId(c.id)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="material-symbols-outlined text-2xl text-amber-500">folder</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{c.title}</span>
                  <span className="block text-xs text-slate-500">
                    {c.dpps.length} DPP{c.dpps.length === 1 ? "" : "s"} · {done(c.dpps)}/{c.dpps.length} done
                  </span>
                </span>
                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </button>
            ))}
        </div>
      )}

      {/* 3. DPPs of the chapter */}
      {chapter && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {chapter.dpps.map((dpp) => (
            <DppRow key={dpp.id} dpp={dpp} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DppRow({ dpp }: { dpp: RealDPPItem }) {
  const isUpcoming = dpp.status === "UPCOMING" || Boolean(dpp.startsAt && new Date(dpp.startsAt).getTime() > Date.now());
  const href =
    dpp.status === "COMPLETED" && dpp.testId
      ? `/tests/${dpp.testId}/result`
      : dpp.attemptHref ?? (dpp.testId ? `/tests/${dpp.testId}/attempt` : `/dpp/${dpp.id}/attempt`);

  const statusText =
    dpp.status === "COMPLETED"
      ? `Score ${dpp.score ?? 0}/${dpp.totalMarks}`
      : dpp.status === "IN_PROGRESS"
        ? "In progress"
        : !dpp.ready
          ? "Questions coming soon"
          : isUpcoming
            ? "Upcoming"
            : "Not started";
  const statusTone = dpp.status === "COMPLETED" ? "text-emerald-600" : dpp.status === "IN_PROGRESS" ? "text-amber-600" : "text-slate-500";

  return (
    <li className="flex flex-wrap items-center gap-3 p-3.5">
      <span className="material-symbols-outlined text-2xl text-blue-600">assignment</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{dpp.title}</p>
        <p className="text-xs text-slate-500">
          {dpp.questionCount} Qs · {dpp.durationMins} min · <span className={`font-semibold ${statusTone}`}>{statusText}</span>
        </p>
      </div>
      {dpp.ready && (
        <div className="flex items-center gap-1.5">
          {dpp.testId && dpp.status === "COMPLETED" && (
            <a
              href={`/api/tests/${dpp.testId}/pdf?type=solutions`}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300"
              title="Download the DPP with solutions (one PDF)"
            >
              PDF
            </a>
          )}
          {isUpcoming ? (
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-400 dark:bg-slate-800">Upcoming</span>
          ) : (
            <Link
              href={href}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                dpp.status === "COMPLETED"
                  ? "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {dpp.status === "COMPLETED" ? "Result" : dpp.status === "IN_PROGRESS" ? "Resume" : "Start"}
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
