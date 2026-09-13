"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WhiteboardPdfDownloadButton } from "@/components/whiteboard/WhiteboardPdfDownloadButton";
import { toast } from "sonner";

interface LectureEntry {
  id: string;
  title: string;
  teacherName: string | null;
  durationMin: number | null;
  recordingStatus: "NOT_SCHEDULED" | "SCHEDULED" | "PROCESSING" | "AVAILABLE";
  watchHref: string | null;
  slidesAvailable: boolean;
  slidesHref: string | null;
  slidesSessionId: string | null;
}

interface ChapterEntry {
  id: string;
  title: string;
  lectureCount: number;
  lectures: LectureEntry[];
}

interface SubjectEntry {
  id: string;
  title: string;
  chapters: ChapterEntry[];
}

const STATUS_BADGE: Record<LectureEntry["recordingStatus"], { label: string; className: string }> = {
  AVAILABLE: { label: "Watch Recording", className: "bg-emerald-600 hover:bg-emerald-500 text-white" },
  PROCESSING: { label: "Processing…", className: "bg-amber-100 text-amber-700 cursor-default" },
  SCHEDULED: { label: "Not Yet Recorded", className: "bg-slate-100 text-slate-500 cursor-default" },
  NOT_SCHEDULED: { label: "Not Yet Available", className: "bg-slate-100 text-slate-400 cursor-default" },
};

/**
 * Batch -> Subject -> Chapter -> Lecture recorded-content library ("My
 * Lectures"). Every chapter shown here comes from an explicit
 * BatchChapter assignment to THIS batch (see
 * /api/student/batches/[batchId]/my-lectures) - a chapter assigned only to
 * a different batch never appears here even if it shares the same course,
 * which is the actual fix for the cross-batch content leakage bug.
 */
export function MyLecturesSection({ batchId }: { batchId: string }) {
  const [subjects, setSubjects] = useState<SubjectEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/student/batches/${batchId}/my-lectures`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setError(json.error || "Could not load lectures for this batch.");
          return;
        }
        setSubjects(json.data.subjects);
      } catch {
        if (!cancelled) setError("Could not load lectures for this batch.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  function toggleChapter(id: string) {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (error) {
    return <p className="text-sm text-rose-600 font-semibold py-6 text-center">{error}</p>;
  }

  if (!subjects) {
    return <p className="text-sm text-slate-400 py-6 text-center">Loading your lectures…</p>;
  }

  if (subjects.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center">
        No chapters have been assigned to this batch yet — check back once your teacher adds content.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {subjects.map((subject) => (
        <div key={subject.id}>
          <h3 className="text-sm font-bold text-slate-800 mb-2">{subject.title}</h3>
          <div className="space-y-2">
            {subject.chapters.map((chapter) => {
              const isOpen = openChapters.has(chapter.id);
              return (
                <div key={chapter.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleChapter(chapter.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left"
                  >
                    <span className="text-xs font-bold text-slate-700">{chapter.title}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {chapter.lectureCount} lecture{chapter.lectureCount === 1 ? "" : "s"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-slate-100">
                      {chapter.lectures.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-slate-400">No lectures yet for this chapter.</p>
                      ) : (
                        chapter.lectures.map((lecture) => {
                          const badge = STATUS_BADGE[lecture.recordingStatus];
                          return (
                            <div key={lecture.id} className="px-4 py-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{lecture.title}</p>
                                <p className="text-[10px] text-slate-400">
                                  {lecture.teacherName || "Atomic Faculty"}
                                  {lecture.durationMin ? ` · ${lecture.durationMin} min` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {lecture.watchHref ? (
                                  <Link
                                    href={lecture.watchHref}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${badge.className}`}
                                  >
                                    <span className="material-symbols-outlined text-[13px]">play_circle</span>
                                    {badge.label}
                                  </Link>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${badge.className}`}>
                                    {badge.label}
                                  </span>
                                )}
                                {lecture.slidesAvailable && (
                                  lecture.slidesHref ? (
                                    <a
                                      href={lecture.slidesHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                      title="View PDF/Notes"
                                    >
                                      <span className="material-symbols-outlined text-[13px] text-rose-500">picture_as_pdf</span>
                                    </a>
                                  ) : lecture.slidesSessionId ? (
                                    <WhiteboardPdfDownloadButton
                                      sessionId={lecture.slidesSessionId}
                                      format="pdf"
                                      onUnavailable={(msg) => toast.info(msg)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-60"
                                      title="View PDF/Notes"
                                    >
                                      <span className="material-symbols-outlined text-[13px] text-rose-500">picture_as_pdf</span>
                                    </WhiteboardPdfDownloadButton>
                                  ) : null
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
