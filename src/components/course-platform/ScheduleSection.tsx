"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils/date";

export function ScheduleSection({ course }: { course?: any }) {
  const [filter, setFilter] = useState<"ALL" | "UPCOMING" | "PRESENT" | "PAST">("ALL");

  const rawSchedules = (course?.schedules || []).map((s: any) => {
    const startsAt = new Date(s.startsAt);
    const endsAt = new Date(s.endsAt || startsAt.getTime() + 60 * 60_000);
    const now = new Date();
    let timingState: "UPCOMING" | "PRESENT" | "PAST" = "UPCOMING";
    if (s.status === "COMPLETED" || endsAt < now) {
      timingState = "PAST";
    } else if (startsAt <= now && now <= endsAt) {
      timingState = "PRESENT";
    } else {
      timingState = "UPCOMING";
    }

    return {
      id: s.id,
      title: s.title,
      subject: s.subject,
      itemType: "CLASS",
      type: s.type || "Live Class",
      startsAt,
      endsAt,
      timingState,
      teacherName: s.teacher?.user?.name || null,
      href: `/live-class/${s.id}`,
    };
  });

  const rawTests = (course?.tests || []).map((t: any) => {
    const startsAt = t.startsAt ? new Date(t.startsAt) : new Date(t.openTime || Date.now());
    const endsAt = t.endsAt ? new Date(t.endsAt) : new Date(startsAt.getTime() + (t.durationMin || 180) * 60_000);
    const timingState: "UPCOMING" | "PRESENT" | "PAST" = t.timingState || "UPCOMING";

    return {
      id: `test-${t.id}`,
      testId: t.id,
      title: t.title || t.name,
      subject: t.testSeriesName || "Test Series Assessment",
      itemType: "TEST",
      type: "Test",
      startsAt,
      endsAt,
      timingState,
      teacherName: null,
      isSubmitted: t.isSubmitted,
      href: t.isSubmitted ? `/tests/${t.id}/result` : `/tests/${t.id}/attempt`,
    };
  });

  const allItems = [...rawSchedules, ...rawTests].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime()
  );

  const filteredItems = allItems.filter((i) => {
    if (filter === "ALL") return true;
    return i.timingState === filter;
  });

  return (
    <section id="schedule" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#031635] dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">calendar_month</span>
            <span>Batch Schedule &amp; Timetable</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Live lectures, tests, and interactive timetable for this batch.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold self-start sm:self-auto">
          {(
            [
              { id: "ALL", label: "All" },
              { id: "PRESENT", label: "Live / Today" },
              { id: "UPCOMING", label: "Upcoming" },
              { id: "PAST", label: "Past" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === tab.id
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-500 text-xs">
          No {filter !== "ALL" ? filter.toLowerCase() : ""} classes or tests scheduled right now.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item: any) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      item.itemType === "TEST"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                    }`}
                  >
                    {item.type}
                  </span>

                  {item.timingState === "PRESENT" && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold animate-pulse">
                      Live Now
                    </span>
                  )}
                  {item.timingState === "UPCOMING" && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Upcoming
                    </span>
                  )}
                  {item.timingState === "PAST" && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                      Concluded
                    </span>
                  )}

                  {item.subject && (
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {item.subject}
                    </span>
                  )}
                </div>

                <Link
                  href={item.href}
                  className="font-bold text-xs sm:text-sm text-[#031635] dark:text-white hover:text-blue-600 transition block truncate"
                >
                  {item.title}
                </Link>

                <p className="text-[11px] text-slate-400">
                  {formatDateTime(item.startsAt.toISOString())}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {item.teacherName && (
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mr-2">
                    {item.teacherName}
                  </span>
                )}

                {item.itemType === "TEST" ? (
                  <Link
                    href={item.href}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 ${
                      item.isSubmitted
                        ? "bg-slate-800 hover:bg-slate-900 text-white"
                        : item.timingState === "PRESENT"
                        ? "bg-violet-600 hover:bg-violet-700 text-white animate-pulse"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {item.isSubmitted
                      ? "View Result"
                      : item.timingState === "PRESENT"
                      ? "Start Test Now"
                      : "Open Test"}
                  </Link>
                ) : (
                  <Link
                    href={item.href}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-2xs transition active:scale-95"
                  >
                    Join Class
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
