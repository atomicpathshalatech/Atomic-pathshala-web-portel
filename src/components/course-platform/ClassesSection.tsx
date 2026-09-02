"use client";

import React from "react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/utils/date";

export function ClassesSection({ course }: { course?: any }) {
  const schedules = course?.schedules || [];

  return (
    <section id="classes" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-600">video_camera_front</span>
          <span>Live &amp; Scheduled Classes</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Interactive classroom sessions scheduled for this batch.
        </p>
      </div>

      {schedules.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500 text-xs">
          Upcoming class schedules will be posted here as faculty schedules live sessions.
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((cls: any) => (
            <div
              key={cls.id}
              className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-200 transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase">
                    {cls.type || "Live Class"}
                  </span>
                  {cls.teacher?.user?.name && (
                    <span className="text-[11px] text-slate-500">
                      by {cls.teacher.user.name}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-[#031635] dark:text-white">{cls.title}</h3>
                <p className="text-[11px] text-slate-400">
                  {formatDateTime(cls.startsAt)}
                </p>
              </div>

              <Link
                href={`/live-class/${cls.id}`}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-sm hover:opacity-90 transition text-center self-start sm:self-auto shrink-0"
              >
                Join Class
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
