"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  formatISTTime,
  formatISTDate,
  getISTDayKey,
  isTodayInIST,
} from "@/lib/date-utils";
import {
  canStudentJoin,
  canTeacherStart,
  getEffectiveScheduleStatus,
  JOIN_WINDOW_MS,
  type NormalizedScheduleStatus,
} from "@/lib/schedule/access-rules";

export interface ScheduleItem {
  id: string;
  title: string;
  subject?: string | null;
  type: string; // LIVE_CLASS | TEST | DPP | DOUBT_SESSION | OTHER
  status: string; // SCHEDULED | LIVE | COMPLETED | CANCELLED
  startsAt: string | Date;
  endsAt: string | Date;
  batchId: string;
  batch: {
    id: string;
    name: string;
    code?: string;
  };
  teacher?: {
    id: string;
    user: {
      name: string | null;
      email?: string | null;
    };
  } | null;
  liveWhiteboardSession?: {
    id?: string;
    status?: string;
    livePhase?: string;
  } | null;
}

export interface BatchOption {
  id: string;
  name: string;
  code?: string;
}

const TYPE_LABELS: Record<string, string> = {
  LIVE_CLASS: "Live Class",
  TEST: "Test",
  DPP: "DPP",
  DOUBT_SESSION: "Doubt Session",
  OTHER: "Special Class",
};

const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // day 0 is Sunday, 1 is Monday...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function HorizontalScheduleCalendar({
  schedules: initialSchedules,
  batches,
  role = "STUDENT",
  title = "My Schedule",
  subtitle = "Track your learning journey and live classroom sessions.",
}: {
  schedules: ScheduleItem[];
  batches: BatchOption[];
  role?: "STUDENT" | "TEACHER";
  title?: string;
  subtitle?: string;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>("ALL");
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [clientTimeMs, setClientTimeMs] = useState<number>(Date.now());
  const [mobileSelectedDateKey, setMobileSelectedDateKey] = useState<string>(() => getISTDayKey(new Date()));

  // Local ticker every second for authoritative boundary updates
  useEffect(() => {
    const timer = setInterval(() => setClientTimeMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter schedules by batch
  const filteredSchedules = useMemo(() => {
    return initialSchedules.filter((s) => {
      if (selectedBatchId !== "ALL" && s.batchId !== selectedBatchId) return false;
      return true;
    });
  }, [initialSchedules, selectedBatchId]);

  // Generate 7 days of the current selected week (Mon - Sun)
  const weekDays = useMemo(() => {
    const days: { date: Date; key: string; dayName: string; dayNum: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = getISTDayKey(d);
      const dayName = DAY_NAMES[i] ?? "";
      const dayNum = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit" });
      const isToday = isTodayInIST(d);
      days.push({ date: d, key, dayName, dayNum, isToday });
    }
    return days;
  }, [currentWeekStart]);

  // Group filtered schedules by IST Date Key
  const groupedByDate = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    for (const s of filteredSchedules) {
      const key = getISTDayKey(s.startsAt);
      (map[key] ??= []).push(s);
    }
    // Sort chronologically within each date
    for (const key of Object.keys(map)) {
      map[key]?.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [filteredSchedules]);

  // Navigation handlers
  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentWeekStart(getMonday(today));
    setMobileSelectedDateKey(getISTDayKey(today));
  };

  // Month & Year header label
  const monthYearLabel = useMemo(() => {
    const midWeek = new Date(currentWeekStart.getTime() + 3 * 24 * 60 * 60 * 1000);
    return midWeek.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      month: "long",
      year: "numeric",
    }).toUpperCase();
  }, [currentWeekStart]);

  const clientNow = useMemo(() => new Date(clientTimeMs), [clientTimeMs]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Batch Selector */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              Indian Standard Time (IST &bull; Asia/Kolkata)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        {/* Batch Filter Tabs */}
        {batches.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 max-w-md">
            <button
              type="button"
              onClick={() => setSelectedBatchId("ALL")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedBatchId === "ALL"
                  ? "bg-slate-900 text-white dark:bg-orange-500 dark:text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              All Batches ({initialSchedules.length})
            </button>
            {batches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBatchId(b.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedBatchId === b.id
                    ? "bg-slate-900 text-white dark:bg-orange-500 dark:text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Week Navigation Controls */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-5 py-3.5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevWeek}
            className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
            title="Previous Week"
          >
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleNextWeek}
            className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
            title="Next Week"
          >
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        <div className="text-center font-black font-mono text-sm sm:text-base text-slate-900 dark:text-white tracking-widest">
          {monthYearLabel}
        </div>

        <div className="text-xs text-slate-500 font-mono hidden sm:block">
          7-Day Horizontal Schedule
        </div>
      </div>

      {/* Desktop 7-Column Horizontal Schedule Calendar Grid */}
      <div className="hidden lg:grid grid-cols-7 gap-3 items-start">
        {weekDays.map((day) => {
          const dayLectures = groupedByDate[day.key] ?? [];
          return (
            <div
              key={day.key}
              className={`rounded-2xl border flex flex-col transition-all min-h-[360px] ${
                day.isToday
                  ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-300 dark:border-blue-900/60 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
              }`}
            >
              {/* Day Header */}
              <div
                className={`p-3 text-center border-b rounded-t-2xl ${
                  day.isToday
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-50/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="text-[10px] font-black font-mono uppercase tracking-wider opacity-90">
                  {day.dayName}
                </div>
                <div className="text-xl font-black font-mono leading-none mt-0.5">
                  {day.dayNum}
                </div>
                {day.isToday && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-white text-blue-700">
                    Today
                  </span>
                )}
              </div>

              {/* Day Lectures Stack */}
              <div className="p-2.5 space-y-2.5 flex-1">
                {dayLectures.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-center text-slate-400 dark:text-slate-600 text-[11px] font-medium p-2">
                    No classes scheduled
                  </div>
                ) : (
                  dayLectures.map((item) => (
                    <ScheduleCard
                      key={item.id}
                      item={item}
                      role={role}
                      clientNow={clientNow}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile / Tablet Responsive Horizontal Date Selector + Cards Underneath */}
      <div className="lg:hidden space-y-4">
        {/* Horizontal Date Bar */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {weekDays.map((day) => {
            const isSelected = mobileSelectedDateKey === day.key;
            const count = (groupedByDate[day.key] ?? []).length;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setMobileSelectedDateKey(day.key)}
                className={`flex flex-col items-center justify-center min-w-[64px] py-2.5 px-2 rounded-2xl border transition-all text-center shrink-0 ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105"
                    : day.isToday
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-300"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span className="text-[10px] font-bold font-mono uppercase">{day.dayName}</span>
                <span className="text-lg font-black font-mono leading-tight">{day.dayNum}</span>
                {count > 0 && (
                  <span
                    className={`mt-1 text-[9px] font-extrabold px-1.5 rounded-full ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Date Lectures */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
              {formatISTDate(weekDays.find((d) => d.key === mobileSelectedDateKey)?.date ?? new Date())}
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {(groupedByDate[mobileSelectedDateKey] ?? []).length} Classes
            </span>
          </div>

          {(groupedByDate[mobileSelectedDateKey] ?? []).length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No classes scheduled on this date.
            </div>
          ) : (
            <div className="space-y-3">
              {(groupedByDate[mobileSelectedDateKey] ?? []).map((item) => (
                <ScheduleCard
                  key={item.id}
                  item={item}
                  role={role}
                  clientNow={clientNow}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Single Schedule Lecture Card with Authoritative T-15 Actions & Status Badges
 */
function ScheduleCard({
  item,
  role,
  clientNow,
}: {
  item: ScheduleItem;
  role: "STUDENT" | "TEACHER";
  clientNow: Date;
}) {
  const scheduleTarget = {
    id: item.id,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    status: item.status,
    type: item.type,
    liveWhiteboardSession: item.liveWhiteboardSession,
  };

  const studentEval = canStudentJoin(scheduleTarget, clientNow);
  const teacherEval = canTeacherStart(scheduleTarget, clientNow);
  const effectiveStatus = getEffectiveScheduleStatus(scheduleTarget, clientNow);

  const isLive = effectiveStatus === "LIVE";
  const isCompleted = effectiveStatus === "COMPLETED";
  const isCancelled = effectiveStatus === "CANCELLED";
  const isStartingSoon = effectiveStatus === "STARTING_SOON";

  // Status Chip Style
  const statusBadge = useMemo(() => {
    if (isCancelled) {
      return (
        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
          CANCELLED
        </span>
      );
    }
    if (isCompleted) {
      return (
        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
          COMPLETED
        </span>
      );
    }
    if (isLive) {
      return (
        <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-rose-500 text-white animate-pulse shadow-xs">
          🔴 LIVE NOW
        </span>
      );
    }
    if (isStartingSoon) {
      return (
        <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 animate-pulse">
          STARTING SOON (T-15)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
        UPCOMING
      </span>
    );
  }, [isCancelled, isCompleted, isLive, isStartingSoon]);

  // Action Button
  const actionButton = useMemo(() => {
    if (item.type !== "LIVE_CLASS") {
      if (item.type === "TEST") {
        return (
          <Link
            href="/tests"
            className="block text-center w-full py-1.5 px-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition"
          >
            View in Tests
          </Link>
        );
      }
      if (item.type === "DPP") {
        return (
          <Link
            href="/dpp"
            className="block text-center w-full py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition"
          >
            View in DPP
          </Link>
        );
      }
      return null;
    }

    if (isCancelled) {
      return (
        <div className="w-full py-1.5 text-center text-[10px] font-semibold text-rose-500 bg-rose-50/50 dark:bg-rose-950/30 rounded-lg border border-dashed border-rose-200 dark:border-rose-900/30">
          Class Cancelled
        </div>
      );
    }

    if (isCompleted) {
      return (
        <div className="w-full py-1.5 text-center text-[10px] font-semibold text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800">
          Concluded
        </div>
      );
    }

    // Role: STUDENT
    if (role === "STUDENT") {
      if (studentEval.allowed) {
        return (
          <Link
            href={`/live-class/${item.id}`}
            className={`block text-center w-full py-1.5 px-3 text-white text-[11px] font-black rounded-xl shadow transition-all ${
              isLive
                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30 animate-pulse"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
            }`}
          >
            {isLive ? "🔴 Enter Live Class" : "🚪 Enter Studio (Lobby)"}
          </Link>
        );
      }

      // Locked state before T-15
      return (
        <div
          className="w-full py-1.5 px-2 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-bold text-center border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 cursor-not-allowed"
          title={studentEval.reason}
        >
          <span className="material-symbols-outlined text-xs">lock</span>
          <span>Opens {formatISTTime(studentEval.opensAt)}</span>
        </div>
      );
    }

    // Role: TEACHER
    if (teacherEval.allowed) {
      return (
        <Link
          href={`/team/live-class/${item.id}`}
          className={`block text-center w-full py-1.5 px-3 text-white text-[11px] font-black rounded-xl shadow transition-all ${
            isLive
              ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30 animate-pulse"
              : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
          }`}
        >
          {isLive ? "🔴 Resume Live Class" : "🎙️ Start Live Class"}
        </Link>
      );
    }

    return (
      <div
        className="w-full py-1.5 px-2 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-bold text-center border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 cursor-not-allowed"
        title={teacherEval.reason}
      >
        <span className="material-symbols-outlined text-xs">lock</span>
        <span>Start from {formatISTTime(teacherEval.opensAt)}</span>
      </div>
    );
  }, [item.id, item.type, isCancelled, isCompleted, isLive, role, studentEval, teacherEval]);

  return (
    <div
      className={`rounded-xl p-3 border transition-all space-y-2 relative ${
        isLive
          ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60 shadow-sm"
          : isCompleted
          ? "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80"
          : isCancelled
          ? "bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/30 opacity-70"
          : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      {/* Top Header: Badge + Batch */}
      <div className="flex items-center justify-between gap-1 flex-wrap">
        {statusBadge}
        <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/40 truncate max-w-[110px]">
          {item.batch.name}
        </span>
      </div>

      {/* Class Title */}
      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
        {item.title}
      </h4>

      {/* Subject & Timing */}
      <div className="space-y-1 text-[11px] text-slate-500 font-medium">
        {item.subject && (
          <div className="text-slate-600 dark:text-slate-400 font-semibold truncate">
            {item.subject}
          </div>
        )}
        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-600 dark:text-slate-400">
          <span className="material-symbols-outlined text-xs text-slate-400">schedule</span>
          <span>
            {formatISTTime(item.startsAt)} – {formatISTTime(item.endsAt)}
          </span>
        </div>
        {item.teacher?.user?.name && (
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
            Faculty: {item.teacher.user.name}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="pt-1">{actionButton}</div>
    </div>
  );
}
