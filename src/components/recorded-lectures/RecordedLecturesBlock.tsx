"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LectureCard = {
  id: string;
  title: string;
  language: string;
  teacher: string;
  lectureNumber: number | null;
  durationSec: number | null;
  thumbnailUrl: string | null;
  summaryPreview: string | null;
  completed: boolean;
  href: string;
};
type Chapter = { id: string; title: string; lectures: LectureCard[] };
type Subject = { id: string; title: string; chapters: Chapter[] };

function minutes(sec: number | null) {
  if (!sec) return null;
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/**
 * Published recorded lectures of this batch, Subject → Chapter → lectures,
 * inside the batch's Classes tab. Renders nothing for someone who is not
 * enrolled (the API refuses), so the course page is unchanged for them.
 */
export function RecordedLecturesBlock({ batchId }: { batchId: string }) {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/student/batches/${encodeURIComponent(batchId)}/recorded-lectures`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403 || r.status === 404) {
          if (!cancelled) setHidden(true);
          return;
        }
        const j = await r.json();
        if (cancelled) return;
        if (!j.success) throw new Error();
        setSubjects(j.data.subjects);
        setSubjectId(j.data.subjects[0]?.id ?? null);
        setOpenChapter(j.data.subjects[0]?.chapters[0]?.id ?? null);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  if (hidden) return null;

  const subject = subjects?.find((s) => s.id === subjectId) ?? null;

  return (
    <section id="recorded-lectures" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">video_library</span>
          <span>Recorded Lectures</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Watch recorded lectures chapter by chapter, with the teacher&apos;s summary.</p>
      </div>

      {failed ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-center text-rose-700 dark:text-rose-300 text-xs">
          Recorded lectures could not be loaded. Check your connection and reload the page.
        </div>
      ) : subjects === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500 text-xs">
          Recorded lectures will appear here as your teachers publish them.
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Subjects">
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === subjectId}
                onClick={() => {
                  setSubjectId(s.id);
                  setOpenChapter(s.chapters[0]?.id ?? null);
                }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold border transition ${
                  s.id === subjectId ? "bg-primary text-white border-primary" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                }`}
              >
                {s.title}
                <span className="ml-1.5 opacity-70">{s.chapters.reduce((n, c) => n + c.lectures.length, 0)}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {subject?.chapters.map((c) => {
              const open = openChapter === c.id;
              return (
                <div key={c.id} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenChapter(open ? null : c.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 text-left"
                  >
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100 min-w-0 truncate">{c.title}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                      {c.lectures.length} lecture{c.lectures.length === 1 ? "" : "s"}
                      <span className="material-symbols-outlined text-base">{open ? "expand_less" : "expand_more"}</span>
                    </span>
                  </button>
                  {open && (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {c.lectures.map((l) => (
                        <li key={l.id}>
                          <Link href={l.href} className="flex gap-3 p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                            <div className="relative w-28 sm:w-36 aspect-video shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-blue-600 to-[#031635] flex items-center justify-center">
                              {l.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={l.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <span className="text-white/90 text-xs font-black">{l.lectureNumber ? `L${String(l.lectureNumber).padStart(2, "0")}` : "Lecture"}</span>
                              )}
                              <span className="material-symbols-outlined absolute text-white text-3xl drop-shadow">play_circle</span>
                              {minutes(l.durationSec) && (
                                <span className="absolute bottom-1 right-1 rounded bg-black/70 text-white text-[10px] font-bold px-1">{minutes(l.durationSec)}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2">
                                {l.lectureNumber ? `Lecture ${String(l.lectureNumber).padStart(2, "0")} · ` : ""}
                                {l.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {l.teacher} · {l.language}
                                {l.completed && <span className="ml-1.5 text-emerald-600 font-bold">· Watched</span>}
                              </p>
                              {l.summaryPreview && <p className="text-xs text-slate-500 line-clamp-2">{l.summaryPreview}</p>}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
