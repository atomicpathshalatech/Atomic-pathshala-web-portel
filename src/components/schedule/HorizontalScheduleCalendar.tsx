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
      image?: string | null;
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
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const SUBJECT_COLORS: Record<string, { bg: string; text: string }> = {
  chemistry: { bg: "bg-orange-100 dark:bg-orange-950/60", text: "text-orange-700 dark:text-orange-300" },
  physics: { bg: "bg-blue-100 dark:bg-blue-950/60", text: "text-blue-700 dark:text-blue-300" },
  mathematics: { bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-700 dark:text-emerald-300" },
  maths: { bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-700 dark:text-emerald-300" },
  biology: { bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-700 dark:text-rose-300" },
  botany: { bg: "bg-lime-100 dark:bg-lime-950/60", text: "text-lime-700 dark:text-lime-300" },
  zoology: { bg: "bg-teal-100 dark:bg-teal-950/60", text: "text-teal-700 dark:text-teal-300" },
};

function getSubjectBadgeColor(subject?: string | null) {
  if (!subject) return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" };
  const lower = subject.toLowerCase();
  for (const [key, val] of Object.entries(SUBJECT_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return { bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-700 dark:text-indigo-300" };
}

export function HorizontalScheduleCalendar({
  schedules: initialSchedules,
  batches,
  role = "STUDENT",
  title = "My Schedule",
  subtitle = "live lectures and test",
}: {
  schedules: ScheduleItem[];
  batches: BatchOption[];
  role?: "STUDENT" | "TEACHER";
  title?: string;
  subtitle?: string;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>("ALL");
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getISTDayKey(new Date()));
  const [clientTimeMs, setClientTimeMs] = useState<number>(Date.now());
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);

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
    const newStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    setCurrentWeekStart(newStart);
    setSelectedDateKey(getISTDayKey(newStart));
  };

  const handleNextWeek = () => {
    const newStart = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    setCurrentWeekStart(newStart);
    setSelectedDateKey(getISTDayKey(newStart));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentWeekStart(getMonday(today));
    setSelectedDateKey(getISTDayKey(today));
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

  // Selected date object & items
  const selectedDateObj = useMemo(() => {
    const found = weekDays.find((d) => d.key === selectedDateKey);
    if (found) return found.date;
    const parts = selectedDateKey.split("-").map(Number);
    const y = parts[0] ?? 2026;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    return new Date(y, m - 1, d);
  }, [weekDays, selectedDateKey]);

  const selectedDateFormattedTitle = useMemo(() => {
    return selectedDateObj.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }, [selectedDateObj]);

  const selectedDateLectures = useMemo(() => {
    return groupedByDate[selectedDateKey] ?? [];
  }, [groupedByDate, selectedDateKey]);

  // Summary counts for selected date
  const selectedDateSummary = useMemo(() => {
    const total = selectedDateLectures.length;
    if (total === 0) return "No Classes Scheduled";

    let liveCount = 0;
    let completedCount = 0;
    for (const item of selectedDateLectures) {
      const status = getEffectiveScheduleStatus(item, clientNow);
      if (status === "LIVE") liveCount++;
      if (status === "COMPLETED") completedCount++;
    }

    if (liveCount > 0) {
      return `${total} Class${total > 1 ? "es" : ""} • ${liveCount} Live`;
    }
    if (completedCount === total) {
      return `${total} Class${total > 1 ? "es" : ""} Recorded`;
    }
    return `${total} Class${total > 1 ? "es" : ""} Scheduled`;
  }, [selectedDateLectures, clientNow]);

  const currentBatchName = useMemo(() => {
    if (selectedBatchId === "ALL") return "All Batches";
    return batches.find((b) => b.id === selectedBatchId)?.name ?? "Selected Batch";
  }, [selectedBatchId, batches]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 px-2 sm:px-4 pb-16">
      {/* Top Header */}
      <section className="pt-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-headline-sm">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-body-sm">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Month Navigation & Batch Selector Control Bar */}
        <div className="flex items-center justify-between gap-2 mt-1">
          {/* Month Navigator */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl px-2 py-1">
            <button
              aria-label="Previous Week"
              onClick={handlePrevWeek}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white px-2 tracking-wider select-none">
              {monthYearLabel}
            </span>
            <button
              aria-label="Next Week"
              onClick={handleNextWeek}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          {/* Today Button & Batch Selector */}
          <div className="flex items-center gap-2 relative">
            <button
              onClick={handleToday}
              className="px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 hover:bg-amber-200 text-[11px] uppercase tracking-wider font-extrabold transition-all shadow-sm active:scale-95"
              type="button"
            >
              TODAY
            </button>

            {/* Batch Selector Dropdown */}
            {batches.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setBatchDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm text-xs font-semibold"
                  type="button"
                >
                  <span className="truncate max-w-[120px]">{currentBatchName}</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
                </button>

                {batchDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setBatchDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-1.5 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBatchId("ALL");
                          setBatchDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          selectedBatchId === "ALL"
                            ? "bg-[#a33900] text-white"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        All Batches ({initialSchedules.length})
                      </button>
                      {batches.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setSelectedBatchId(b.id);
                            setBatchDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold transition-all truncate ${
                            selectedBatchId === b.id
                              ? "bg-[#a33900] text-white"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Horizontal Scrollable Date Strip */}
      <section className="w-full overflow-x-auto no-scrollbar py-1">
        <div className="flex items-center gap-2.5 min-w-max">
          {weekDays.map((day) => {
            const isSelected = selectedDateKey === day.key;
            const dayLectures = groupedByDate[day.key] ?? [];
            const hasClasses = dayLectures.length > 0;
            const hasLive = dayLectures.some(
              (l) => getEffectiveScheduleStatus(l, clientNow) === "LIVE"
            );

            return (
              <button
                key={day.key}
                onClick={() => setSelectedDateKey(day.key)}
                className={`flex flex-col items-center justify-center w-14 py-2.5 rounded-2xl transition-all active:scale-95 border ${
                  isSelected
                    ? "bg-[#a33900] text-white border-[#a33900] shadow-md scale-105"
                    : day.isToday
                    ? "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 text-orange-900 dark:text-orange-200"
                    : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                type="button"
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isSelected ? "text-orange-100" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {day.dayName}
                </span>
                <span
                  className={`text-base sm:text-lg font-black leading-tight mt-0.5 ${
                    isSelected ? "text-white" : "text-slate-900 dark:text-white"
                  }`}
                >
                  {day.dayNum}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-1 ${
                    hasLive
                      ? "bg-rose-500 animate-ping"
                      : hasClasses
                      ? isSelected
                        ? "bg-white"
                        : "bg-emerald-500"
                      : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Date Summary Banner */}
      <section>
        <div className="flex items-center justify-between bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 px-3.5 py-2.5 rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[#a33900] text-[20px] shrink-0">
              calendar_month
            </span>
            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
              {selectedDateFormattedTitle}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-blue-200/60 dark:border-blue-800/60 px-2.5 py-1 rounded-full shrink-0 shadow-xs">
            {selectedDateLectures.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
            <span className="text-[10px] sm:text-[11px] font-bold text-[#a33900] dark:text-orange-400 uppercase tracking-wide">
              {selectedDateSummary}
            </span>
          </div>
        </div>
      </section>

      {/* Interactive Timeline Feed */}
      <main className="flex flex-col gap-3">
        {selectedDateLectures.length === 0 ? (
          /* Empty State for Zero-Class Day */
          <div className="flex flex-col items-center justify-center py-12 px-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[#a33900] text-[36px]">
                self_improvement
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Classes Scheduled
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              This day is dedicated to self-paced revision, mock analysis, DPPs, and backlog clearing.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <Link
                href="/dpp"
                className="flex items-center gap-1.5 py-2 px-4 bg-[#a33900] hover:bg-orange-800 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">quiz</span>
                <span>Take DPP Test</span>
              </Link>
              <Link
                href="/doubts"
                className="flex items-center gap-1.5 py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <span className="material-symbols-outlined text-[16px] text-[#a33900]">
                  psychology
                </span>
                <span>Ask Doubt AI</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {selectedDateLectures.map((item, idx) => {
              const isLast = idx === selectedDateLectures.length - 1;
              return (
                <TimelineLectureRow
                  key={item.id}
                  item={item}
                  role={role}
                  clientNow={clientNow}
                  isLast={isLast}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Single Row in Timeline: Left Time Strip (with connecting vertical line) + Right Card
 */
function TimelineLectureRow({
  item,
  role,
  clientNow,
  isLast,
}: {
  item: ScheduleItem;
  role: "STUDENT" | "TEACHER";
  clientNow: Date;
  isLast: boolean;
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

  const startTimeStr = formatISTTime(item.startsAt);
  const endTimeStr = formatISTTime(item.endsAt);
  const subjectBadge = getSubjectBadgeColor(item.subject);

  // Time remaining calculation for countdown tags
  const minutesUntilStart = Math.ceil(
    (new Date(item.startsAt).getTime() - clientNow.getTime()) / (1000 * 60)
  );

  return (
    <div className="relative flex gap-3 sm:gap-4 items-start">
      {/* Left Column: Timeline Indicator & Times */}
      <div className="flex flex-col items-center shrink-0 w-14 sm:w-16 pt-0.5">
        {/* Status Indicator Icon */}
        {isLive ? (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
            </span>
            <span className="text-[10px] font-black uppercase">LIVE</span>
          </div>
        ) : isStartingSoon ? (
          <div className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined text-[14px]">timer</span>
          </div>
        ) : isCompleted ? (
          <div className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
          </div>
        ) : isCancelled ? (
          <div className="flex items-center gap-0.5 text-rose-500">
            <span className="material-symbols-outlined text-[16px]">cancel</span>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 text-slate-400">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
          </div>
        )}

        {/* Start & End Times */}
        <span className="font-extrabold text-xs sm:text-[13px] text-slate-900 dark:text-white leading-none mt-1">
          {startTimeStr}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
          {endTimeStr}
        </span>

        {/* Vertical Connecting Line to next item */}
        {!isLast && (
          <div className="w-0.5 bg-slate-200 dark:bg-slate-700/80 h-24 sm:h-20 mt-2 rounded-full" />
        )}
      </div>

      {/* Right Column: Full Details Card */}
      <div
        className={`flex-1 bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-3.5 shadow-sm hover:shadow-md transition-all border ${
          isLive
            ? "border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/10"
            : isCancelled
            ? "border-rose-200 dark:border-rose-900/40 bg-rose-50/10"
            : "border-slate-200/80 dark:border-slate-800"
        }`}
      >
        {/* Header Tags Row */}
        <div className="flex items-center justify-between gap-1 mb-1 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {/* Live / Status Badge */}
            {isLive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Live
              </span>
            ) : isStartingSoon ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wide shrink-0">
                <span className="material-symbols-outlined text-[12px]">bolt</span>
                Opens in {minutesUntilStart > 0 ? `${minutesUntilStart}m` : "now"}
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wide shrink-0">
                <span className="material-symbols-outlined text-[12px]">done_all</span>
                Completed
              </span>
            ) : isCancelled ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[10px] font-bold uppercase tracking-wide shrink-0">
                Rescheduled
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide shrink-0">
                Upcoming
              </span>
            )}

            {/* Subject Badge */}
            {item.subject && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${subjectBadge.bg} ${subjectBadge.text}`}
              >
                {item.subject}
              </span>
            )}

            {/* Batch Badge */}
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
              {item.batch.name}
            </span>
          </div>

          {/* Right Status Pill / Info */}
          <div className="shrink-0 text-[10px] text-slate-500 flex items-center gap-1">
            {isLive ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[13px]">chat</span>
                Doubt Open
              </span>
            ) : isStartingSoon ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                T-15 Active
              </span>
            ) : (
              <span className="text-slate-400 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[13px]">lock_clock</span>
                T-15 mins
              </span>
            )}
          </div>
        </div>

        {/* Lecture Title */}
        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight mt-1 line-clamp-2">
          {item.title}
        </p>

        {/* Footer Row: Teacher Info & Role-Aware Action Button */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Teacher Avatar & Name */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-200 text-[10px] font-bold overflow-hidden">
              {item.teacher?.user?.name ? item.teacher.user.name.charAt(0).toUpperCase() : "T"}
            </div>
            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
              {item.teacher?.user?.name ?? "Atomic Faculty"}
            </span>
          </div>

          {/* Action Button */}
          <div className="shrink-0">
            {item.type !== "LIVE_CLASS" ? (
              item.type === "TEST" ? (
                <Link
                  href="/tests"
                  className="inline-flex items-center gap-1 py-1 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold shadow-sm transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-[14px]">fact_check</span>
                  <span>View Test</span>
                </Link>
              ) : (
                <Link
                  href="/dpp"
                  className="inline-flex items-center gap-1 py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-[14px]">description</span>
                  <span>View DPP</span>
                </Link>
              )
            ) : isCompleted ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 py-1 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold transition"
                >
                  <span className="material-symbols-outlined text-[13px] text-[#a33900]">play_circle</span>
                  <span>Watch Video</span>
                </button>
              </div>
            ) : isCancelled ? (
              <span className="text-[10px] font-semibold text-rose-500">
                Class Cancelled
              </span>
            ) : role === "STUDENT" ? (
              studentEval.allowed ? (
                <Link
                  href={`/live-class/${item.id}`}
                  className={`inline-flex items-center justify-center gap-1 py-1 px-3 rounded-lg text-[11px] font-bold shadow-sm active:scale-95 transition-all text-white ${
                    isLive
                      ? "bg-[#a33900] hover:bg-orange-800 animate-pulse shadow-orange-600/30"
                      : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">videocam</span>
                  <span>{isLive ? "Enter Live Class" : "Join Waiting Room (Ready)"}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center gap-1 py-1 px-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg text-[10px] font-semibold cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[12px]">lock</span>
                  <span>Locked • Opens {formatISTTime(studentEval.opensAt)}</span>
                </button>
              )
            ) : teacherEval.allowed ? (
              <Link
                href={`/team/live-class/${item.id}`}
                className={`inline-flex items-center justify-center gap-1 py-1 px-3 rounded-lg text-[11px] font-bold shadow-sm active:scale-95 transition-all text-white ${
                  isLive
                    ? "bg-[#a33900] hover:bg-orange-800 animate-pulse shadow-orange-600/30"
                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">videocam</span>
                <span>{isLive ? "Resume Live Class" : "Start Live Class"}</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-1 py-1 px-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg text-[10px] font-semibold cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[12px]">lock</span>
                <span>Start from {formatISTTime(teacherEval.opensAt)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
