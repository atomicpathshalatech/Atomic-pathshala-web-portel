"use client";

import React from "react";
import { formatDateTime } from "@/lib/utils/date";

export function ScheduleSection({ course }: { course?: any }) {
  const schedules = course?.schedules || [];

  return (
    <section id="schedule" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">calendar_month</span>
            <span>Batch Class Schedule</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Weekly live lectures and interactive study calendar.
          </p>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500 text-xs">
          Weekly class timetable will be posted here as faculty schedules live sessions.
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((item: any) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                    {item.type || "Live Class"}
                  </span>
                  {item.subject && (
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {item.subject}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-[#031635] dark:text-white">{item.title}</h3>
                <p className="text-[11px] text-slate-400">
                  {formatDateTime(item.startsAt)}
                </p>
              </div>

              {item.teacher?.user?.name && (
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {item.teacher.user.name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
