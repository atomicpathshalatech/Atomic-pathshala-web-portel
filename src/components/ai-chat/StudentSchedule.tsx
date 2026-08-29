"use client";

import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, PlayCircle, Radio, Search, Youtube } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const BATCHES = [
  { value: "", label: "All batches" },
  { value: "SELECTION_PRO", label: "Selection Pro Batch" },
  { value: "SELECTION_1_0", label: "Selection 1.0 Batch" },
  { value: "ARAMBH", label: "Arambh Batch" },
  { value: "MANZIL", label: "Manzil Batch" },
  { value: "UDAAN", label: "Udaan Batch (Class 10th)" },
];

const SUBJECT_PILLS = ["All", "Physics", "Chemistry", "Biology"];

interface ScheduleEntry {
  id: string;
  batch: string;
  classDate: string;
  startTime: string;
  endTime: string | null;
  subject: string;
  teacherName: string | null;
  teacherPhotoUrl: string | null;
  topic: string;
  youtubeLink: string | null;
  notes: string | null;
}

interface GroupedEntry {
  key: string;
  entries: ScheduleEntry[];
  batchLabels: string[];
}

type ClassStatus = "live" | "upcoming" | "completed";

function formatTime12h(time: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return time;
  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${suffix}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function buildDateTime(classDate: string, time: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  const base = new Date(classDate);
  if (!match) return base;
  base.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return base;
}

function getStatus(entry: ScheduleEntry, now: Date): ClassStatus {
  const start = buildDateTime(entry.classDate, entry.startTime);
  const end = entry.endTime
    ? buildDateTime(entry.classDate, entry.endTime)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "live";
  return "completed";
}

function timeUntil(entry: ScheduleEntry, now: Date) {
  const start = buildDateTime(entry.classDate, entry.startTime);
  const diffMs = start.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours <= 0 && minutes <= 0) return "Starting soon";
  if (hours > 0) return `Starts in ${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`;
  return `Starts in ${minutes}m`;
}

function getWeekDates(centerDate: Date) {
  const day = centerDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(centerDate);
  monday.setDate(centerDate.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function groupKey(entry: ScheduleEntry) {
  return [
    entry.classDate,
    entry.startTime,
    entry.subject,
    entry.topic,
    entry.teacherName ?? "",
  ].join("|");
}

export function StudentSchedule() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [filterBatch, setFilterBatch] = useState("");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [liveOnly, setLiveOnly] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const load = useCallback(async (batch: string, searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (batch) query.set("batch", batch);
      if (searchTerm) query.set("search", searchTerm);

      const response = await fetch("/api/ai-chat/schedule?" + query.toString(), {
        cache: "no-store",
      });
      const data = (await response.json()) as { schedules?: ScheduleEntry[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load schedule.");
      setSchedules(data.schedules ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load schedule.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(filterBatch, search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filterBatch, search, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthLabel = selectedDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const goToPrevWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() - 7);
    setSelectedDate(next);
  };

  const goToNextWeek = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    setSelectedDate(next);
  };

  const groupedEntries = useMemo<GroupedEntry[]>(() => {
    const filtered = schedules
      .filter((entry) => isSameDate(new Date(entry.classDate), selectedDate))
      .filter((entry) =>
        subjectFilter === "All" ? true : entry.subject.toLowerCase() === subjectFilter.toLowerCase()
      )
      .filter((entry) => (liveOnly ? getStatus(entry, now) === "live" : true));

    const map = new Map<string, ScheduleEntry[]>();
    for (const entry of filtered) {
      const key = groupKey(entry);
      const existing = map.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(key, [entry]);
      }
    }

    const groups: GroupedEntry[] = Array.from(map.entries()).map(([key, entries]) => ({
      key,
      entries,
      batchLabels: entries.map(
        (e) => BATCHES.find((b) => b.value === e.batch)?.label ?? e.batch
      ),
    }));

    groups.sort((a, b) => a.entries[0]!.startTime.localeCompare(b.entries[0]!.startTime));
    return groups;
  }, [schedules, selectedDate, subjectFilter, liveOnly, now]);

  return (
    <main className="min-h-dvh bg-white dark:bg-atomic-navy">
      <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-atomic-orange" />
            <div>
              <p className="text-sm font-medium text-atomic-orange">Atomic Pathshala</p>
              <h1 className="text-2xl font-bold">Class Schedule</h1>
            </div>
          </div>
          <Link
            href="/guru"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Return to chat
          </Link>
        </div>

        {/* Date strip */}
        <div className="mt-5 flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevWeek}
            aria-label="Previous week"
            className="flex-shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-atomic-orange dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-between gap-2 overflow-x-auto pb-1">
            {weekDates.map((date) => {
              const active = isSameDate(date, selectedDate);
              const isToday = isSameDate(date, new Date());
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`flex min-w-[52px] flex-col items-center rounded-2xl px-2 py-2 transition-colors ${
                    active
                      ? "bg-atomic-orange/10 text-atomic-orange ring-1 ring-atomic-orange/30"
                      : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    {date.toLocaleDateString("en-GB", { weekday: "short" })}
                  </span>
                  <span className="mt-0.5 text-lg font-extrabold">{date.getDate()}</span>
                  {isToday && <span className="mt-0.5 text-[9px] font-bold uppercase">Today</span>}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={goToNextWeek}
            aria-label="Next week"
            className="flex-shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-atomic-orange dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          {monthLabel}
        </p>

        {/* Subject filter pills */}
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {SUBJECT_PILLS.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => setSubjectFilter(subject)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                subjectFilter === subject
                  ? "bg-atomic-orange text-white"
                  : "border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
            >
              {subject}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLiveOnly((v) => !v)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
              liveOnly
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
            }`}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </button>
        </div>

        {/* Search + batch filter */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by subject or teacher name..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <select
            value={filterBatch}
            onChange={(event) => setFilterBatch(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {BATCHES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {/* Schedule cards */}
        <div className="mt-6 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : groupedEntries.length === 0 ? (
            <p className="text-sm text-slate-500">No classes found for this day.</p>
          ) : (
            groupedEntries.map((group) => {
              const entry = group.entries[0];
              const status = getStatus(entry, now);
              const barColor =
                status === "live"
                  ? "bg-emerald-500"
                  : status === "upcoming"
                    ? "bg-atomic-orange"
                    : "bg-amber-500";

              return (
                <div
                  key={group.key}
                  className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 backdrop-blur-sm transition-transform hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <div className={`absolute bottom-0 left-0 top-0 w-1.5 ${barColor}`} />
                  <div className="flex flex-col gap-4 p-5 pl-6 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-atomic-orange">
                          {entry.subject}
                        </span>
                        <span className="text-xs text-slate-400">-</span>
                        <span className="text-xs font-medium text-slate-500">
                          {formatTime12h(entry.startTime)}
                          {entry.endTime ? ` to ${formatTime12h(entry.endTime)}` : ""}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {group.batchLabels.map((label, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-atomic-orange/10 px-2.5 py-0.5 text-[11px] font-semibold text-atomic-orange"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                      <h3 className="mt-1.5 truncate text-lg font-bold">{entry.topic}</h3>
                      {entry.teacherName && (
                        <div className="mt-2 flex items-center gap-2">
                          {entry.teacherPhotoUrl ? (
                            <img
                              src={entry.teacherPhotoUrl}
                              alt={entry.teacherName}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-atomic-orange/15 text-[11px] font-bold text-atomic-orange">
                              {initials(entry.teacherName)}
                            </span>
                          )}
                          <span className="text-sm font-medium text-slate-500">{entry.teacherName}</span>
                        </div>
                      )}
                      {entry.notes && <p className="mt-1 text-xs text-slate-400">{entry.notes}</p>}
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                      {status === "live" && (
                        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-tight text-emerald-600">
                          <Radio className="h-3 w-3 animate-pulse" />
                          Live now
                        </span>
                      )}
                      {status === "upcoming" && (
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          {timeUntil(entry, now)}
                        </span>
                      )}
                      {status === "completed" && (
                        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">
                          Completed
                        </span>
                      )}

                      {status === "live" && entry.youtubeLink ? (
                        <Link
                          href={entry.youtubeLink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white transition-transform active:scale-95 hover:bg-emerald-600"
                        >
                          Join Class
                        </Link>
                      ) : null}
                      {status === "completed" && entry.youtubeLink ? (
                        <Link
                          href={entry.youtubeLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-600 transition-transform active:scale-95 hover:bg-amber-500/20"
                        >
                          <PlayCircle className="h-4 w-4" />
                          Watch Recording
                        </Link>
                      ) : null}
                      {status === "upcoming" && entry.youtubeLink ? (
                        <Link
                          href={entry.youtubeLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-red-500 hover:underline"
                        >
                          <Youtube className="h-3.5 w-3.5" />
                          Class link
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
