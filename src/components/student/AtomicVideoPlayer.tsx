"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LectureVideoPlayer } from "@/components/video-player/LectureVideoPlayer";
import { ClassNotesPanel } from "@/components/video-player/ClassNotesPanel";
import { ClassDoubtPanel } from "@/components/video-player/ClassDoubtPanel";

export interface VideoPlayerProps {
  lectureId?: string;
  /**
   * "schedule" when lectureId is a BatchSchedule id (a recorded live class)
   * — enables class-linked doubts; "lecture" for a plain Lecture row.
   */
  classKind?: "schedule" | "lecture";
  title: string;
  subtitle?: string;
  subjectTitle?: string;
  chapterTitle?: string;
  educatorName?: string;
  videoUrl: string;
  posterUrl?: string | null;
  educatorVideoUrl?: string | null;
  slidesUrl?: string | null;
  isCompleted?: boolean;
}

/**
 * The recorded-class page — identical on phone, tablet and laptop: the
 * video spans the full width (capped so it never exceeds the screen
 * height), with the class details and the Notes / Ask Doubt tabs below.
 * No modal, no sidebar card.
 */
export function AtomicVideoPlayer({
  lectureId = "demo-lec-1",
  classKind = "lecture",
  title,
  subtitle,
  subjectTitle,
  chapterTitle,
  educatorName,
  videoUrl,
  posterUrl,
  slidesUrl,
  isCompleted = false,
}: VideoPlayerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"notes" | "doubt">("notes");
  const currentTimeRef = useRef(0);
  const completedRef = useRef(isCompleted);

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/schedule");
  }, [router]);

  const markComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (classKind === "lecture") {
      fetch(`/api/lectures/${lectureId}/complete`, { method: "POST" }).catch(() => {});
    }
  }, [classKind, lectureId]);

  const tabs = [
    { id: "notes" as const, label: "Notes", icon: "description" },
    { id: "doubt" as const, label: "Ask Doubt", icon: "help" },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Video — sticks to the top in portrait so notes/doubts scroll under it */}
      <div className="w-full bg-black portrait:sticky portrait:top-0 z-30">
        <div className="mx-auto w-[min(100%,calc(100vh*16/9))] supports-[height:100dvh]:w-[min(100%,calc(100dvh*16/9))]">
          <LectureVideoPlayer
            mode="recorded"
            lectureId={lectureId}
            title={title}
            subjectTitle={subjectTitle}
            educatorName={educatorName}
            videoUrl={videoUrl}
            posterUrl={posterUrl}
            className="!rounded-none"
            onClose={goBack}
            onTimeUpdate={(cur) => {
              currentTimeRef.current = cur;
            }}
            onEnded={markComplete}
            onProgressPercentage={(pct) => {
              if (pct >= 90) markComplete();
            }}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            {subjectTitle && (
              <span className="font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                {subjectTitle}
              </span>
            )}
            {chapterTitle && <span className="text-slate-500 dark:text-slate-400">{chapterTitle}</span>}
          </div>
          <h1 className="text-base sm:text-lg font-extrabold leading-snug">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          {educatorName && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">school</span>
              {educatorName}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 text-sm font-bold transition ${
                activeTab === t.id
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "notes" ? (
          <ClassNotesPanel classId={lectureId} fallbackPdfUrl={slidesUrl} />
        ) : (
          <ClassDoubtPanel
            classId={classKind === "schedule" ? lectureId : ""}
            subject={subjectTitle}
            getCurrentTime={() => currentTimeRef.current}
          />
        )}
      </div>
    </div>
  );
}
