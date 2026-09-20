"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatISTDate, formatISTTime } from "@/lib/date-utils";
import { getEffectiveScheduleStatus, canStudentJoinClass } from "@/lib/schedule/access-rules";
import { WhiteboardPdfDownloadButton } from "@/components/whiteboard/WhiteboardPdfDownloadButton";

export function ClassesSection({ course }: { course?: any }) {
  const schedules = course?.schedules || [];
  const [clientNow, setClientNow] = useState<Date>(new Date());

  useEffect(() => {
    setClientNow(new Date());
    const interval = setInterval(() => setClientNow(new Date()), 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="classes" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">video_camera_front</span>
          <span>Live &amp; Scheduled Classes</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Interactive classroom sessions scheduled for this batch.
        </p>
      </div>

      {schedules.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500 text-xs">
          Upcoming class schedules will be posted here as faculty schedules live sessions.
        </div>
      ) : (
        <div className="space-y-2.5">
          {schedules.map((cls: any) => {
            const scheduleTarget = {
              id: cls.id,
              startsAt: cls.startsAt,
              endsAt: cls.endsAt,
              status: cls.status,
              type: cls.type,
              liveWhiteboardSession: cls.liveWhiteboardSession,
            };

            const effectiveStatus = getEffectiveScheduleStatus(scheduleTarget, clientNow);
            const studentEval = canStudentJoinClass(scheduleTarget, clientNow);
            const isCompleted = effectiveStatus === "COMPLETED";
            const isLive = effectiveStatus === "LIVE";
            const isCancelled = effectiveStatus === "CANCELLED";
            const wb = cls.liveWhiteboardSession;
            const hasRecording = wb?.recordingStatus === "READY" || Boolean(wb?.recordingStorageKey);
            const isRecordingProcessing = wb?.recordingStatus === "PROCESSING" || wb?.recordingStatus === "STOPPING";

            return (
              <div
                key={cls.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Status Badge */}
                    {isLive ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                    ) : isCompleted ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        COMPLETED
                      </span>
                    ) : isCancelled ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        CANCELLED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        UPCOMING
                      </span>
                    )}

                    {cls.type && cls.type !== "LIVE_CLASS" && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold uppercase shrink-0">
                        {cls.type.replace("_", " ")}
                      </span>
                    )}

                    {cls.teacher?.user?.name && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        by {cls.teacher.user.name}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-xs sm:text-sm text-[#031635] dark:text-white line-clamp-1">
                    {cls.title}
                  </h3>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatISTDate(cls.startsAt)} &middot; {formatISTTime(cls.startsAt)} → {formatISTTime(cls.endsAt)} (IST)
                  </p>
                </div>

                {/* Right Action Container */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:self-center">
                  {/* Classroom (new, YouTube-Live based module) entry point —
                      a sibling action alongside Whiteboard's Join Class/Enter
                      Lobby buttons below, never replacing them. Only shown
                      once a ClassroomSession has actually been configured for
                      this schedule; fine-grained waiting/live/ended states
                      are handled entirely inside the Classroom room itself. */}
                  {cls.classroomSession && !isCancelled && (
                    <Link
                      href={`/classroom/${cls.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm hover:opacity-95 active:scale-95 transition text-center shrink-0"
                      title="Application Class (Private Unlisted Stream)"
                    >
                      <span className="material-symbols-outlined text-[14px]">smart_display</span>
                      <span>Application Class</span>
                    </Link>
                  )}
                  {isCompleted ? (
                    <>
                      {hasRecording ? (
                        <Link
                          href={`/live-class/${cls.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-xs hover:opacity-90 active:scale-95 transition"
                          title="Play Recorded Class"
                        >
                          <span className="material-symbols-outlined text-[14px]">play_circle</span>
                          <span>Play Class</span>
                        </Link>
                      ) : isRecordingProcessing ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] font-medium border border-amber-200 dark:border-amber-900/50">
                          <span className="material-symbols-outlined text-[12px] animate-spin">refresh</span>
                          <span>Recording Processing...</span>
                        </span>
                      ) : null}

                      {wb?.id && (
                        <WhiteboardPdfDownloadButton
                          sessionId={wb.id}
                          format="pdf"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[11px] font-bold shadow-xs transition active:scale-95 disabled:opacity-60"
                          title="Download Class Board Notes PDF"
                        >
                          <span className="material-symbols-outlined text-[14px] text-rose-500">picture_as_pdf</span>
                          <span>Download Notes</span>
                        </WhiteboardPdfDownloadButton>
                      )}
                    </>
                  ) : isLive ? (
                    <Link
                      href={`/live-class/${cls.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm hover:opacity-95 active:scale-95 transition text-center shrink-0"
                    >
                      <span className="material-symbols-outlined text-[15px]">videocam</span>
                      <span>Join Class</span>
                    </Link>
                  ) : studentEval.allowed ? (
                    <Link
                      href={`/live-class/${cls.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm hover:opacity-95 active:scale-95 transition text-center shrink-0"
                    >
                      <span className="material-symbols-outlined text-[14px]">door_front</span>
                      <span>Enter Lobby</span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-medium cursor-not-allowed select-none">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      <span>Upcoming</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
