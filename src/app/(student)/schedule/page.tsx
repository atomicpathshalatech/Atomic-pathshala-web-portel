import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { BatchSchedule, Teacher, User, Batch } from "@prisma/client";

export const metadata: Metadata = {
  title: "My Schedule",
};

type ScheduleWithDetails = BatchSchedule & {
  batch: Batch;
  teacher: (Teacher & { user: User }) | null;
};

const TYPE_LABELS: Record<string, string> = {
  LIVE_CLASS: "Live Class",
  TEST: "Test",
  DPP: "DPP",
  DOUBT_SESSION: "Doubt Session",
  OTHER: "Special Class",
};

const TYPE_BORDER: Record<string, string> = {
  LIVE_CLASS: "border-l-blue-500",
  TEST: "border-l-amber-500",
  DPP: "border-l-emerald-500",
  DOUBT_SESSION: "border-l-purple-500",
  OTHER: "border-l-slate-300 dark:border-l-slate-700",
};

const JOIN_WINDOW_MS = 15 * 60 * 1000;

function formatDay(date: Date) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: { batch?: string };
}) {
  const { student } = await requireStudentSession();
  const selectedBatchId = searchParams?.batch;

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    include: {
      batch: {
        include: {
          course: { select: { title: true } },
          teachers: { include: { teacher: { include: { user: true } } } },
          schedules: {
            orderBy: { startsAt: "asc" },
            include: {
              batch: true,
              teacher: { include: { user: true } },
            },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  if (enrollments.length === 0) {
    return (
      <div className="max-w-6xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 md:p-10 shadow-sm">
        <header>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Schedule
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1">
            Track your learning journey and upcoming classroom sessions.
          </p>
        </header>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-12 text-center text-slate-500 text-xs md:text-sm">
          You are not enrolled in a batch yet — once enrolled, your live timetable, DPPs, and tests will appear here.
        </div>
      </div>
    );
  }

  const now = new Date();
  const allSchedules: ScheduleWithDetails[] = enrollments
    .flatMap((e) => e.batch.schedules as ScheduleWithDetails[])
    .filter((s) => !selectedBatchId || s.batchId === selectedBatchId)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const upcoming = allSchedules.filter((s) => s.endsAt >= now);
  const past = allSchedules.filter((s) => s.endsAt < now);

  const grouped = upcoming.reduce<Record<string, ScheduleWithDetails[]>>((acc, s) => {
    const key = s.startsAt.toDateString();
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  const allTeachers = Array.from(
    new Map(
      enrollments.flatMap((e) => e.batch.teachers).map((t) => [t.teacherId, t])
    ).values()
  );

  return (
    <div className="max-w-6xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 md:p-10 shadow-sm">
      <header>
        <p className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-2">
          <span>My Courses</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-orange-600 dark:text-orange-400 font-bold">Schedule</span>
        </p>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              My Schedule
            </h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">
              {enrollments.length} Active Batch{enrollments.length === 1 ? "" : "es"}
            </p>
          </div>

          {/* Batch Selector Tabs */}
          {enrollments.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Link
                href="/schedule"
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  !selectedBatchId
                    ? "bg-slate-900 text-white dark:bg-orange-500 dark:text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                All Batches ({allSchedules.length})
              </Link>
              {enrollments.map((e) => (
                <Link
                  key={e.batch.id}
                  href={`/schedule?batch=${e.batch.id}`}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedBatchId === e.batch.id
                      ? "bg-slate-900 text-white dark:bg-orange-500 dark:text-white shadow-sm"
                      : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {e.batch.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
        {/* Left Side: Overview & Faculty */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-5 shadow-xs">
            <h3 className="text-slate-900 dark:text-white font-bold text-sm mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-xl">analytics</span>
              Overview
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider block text-slate-400">Sessions Held</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1 block">{past.length}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider block text-slate-400">Upcoming</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mt-1 block">{upcoming.length}</span>
              </div>
            </div>
          </div>

          {allTeachers.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-5 shadow-xs">
              <h3 className="text-slate-900 dark:text-white font-bold text-sm mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-xl">school</span>
                Faculty
              </h3>
              <ul className="space-y-2">
                {allTeachers.map((t) => (
                  <li key={t.id} className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <b>{t.teacher.user.name}</b>
                    {t.subject ? <span className="text-slate-400"> — {t.subject}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Right Side: Timeline Sessions */}
        <section className="lg:col-span-8">
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-8 text-center text-slate-400 text-xs">
              No upcoming sessions scheduled yet. Check back once your batch timetable is updated.
            </div>
          ) : (
            <div className="relative pl-8 md:pl-12 space-y-8 pb-4">
              {/* Vertical connector line */}
              <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />
              {Object.entries(grouped).map(([dayKey, entries]) => (
                <div key={dayKey} className="space-y-4">
                  <div className="relative">
                    <div className="absolute -left-[22px] md:-left-[30px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-blue-600 rounded-full ring-4 ring-blue-100 dark:ring-blue-950/80 z-10" />
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider font-mono">
                      {formatDay(new Date(dayKey))}
                    </span>
                  </div>
                  {entries.map((s) => {
                    const isLiveNow = s.status === "LIVE" || (s.startsAt <= now && s.endsAt >= now);
                    const joinOpensAt = new Date(s.startsAt.getTime() - JOIN_WINDOW_MS);
                    const canEnter = s.type === "LIVE_CLASS" && now >= joinOpensAt && now <= s.endsAt;
                    return (
                      <div
                        key={s.id}
                        className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all border-l-4 ${
                          TYPE_BORDER[s.type] ?? "border-l-slate-300"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${
                                  isLiveNow
                                    ? "bg-red-50 text-red-600 border border-red-200 animate-pulse"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {isLiveNow ? "Live Now" : TYPE_LABELS[s.type] ?? s.type}
                              </span>
                              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900/40">
                                {s.batch.name}
                              </span>
                              {s.subject && <span className="text-xs font-semibold text-slate-500">{s.subject}</span>}
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">{s.title}</h3>
                            <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                              {s.teacher && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-base text-slate-400">person</span>
                                  {s.teacher.user.name}
                                </span>
                              )}
                              <span className="flex items-center gap-1 font-mono">
                                <span className="material-symbols-outlined text-base text-slate-400">schedule</span>
                                {s.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                                {s.endsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 w-full md:w-auto self-end md:self-center">
                            {s.type === "LIVE_CLASS" ? (
                              canEnter ? (
                                <Link
                                  href={`/live-class/${s.id}`}
                                  className="block text-center w-full md:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all"
                                >
                                  {isLiveNow ? "Join Class" : "Enter Class"}
                                </Link>
                              ) : (
                                <button
                                  disabled
                                  title="Opens 15 minutes before the scheduled start"
                                  className="w-full md:w-auto px-5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed border border-slate-200 dark:border-slate-700"
                                >
                                  Opens 15 min before
                                </button>
                              )
                            ) : s.type === "TEST" ? (
                              <Link
                                href="/tests"
                                className="block text-center w-full md:w-auto px-5 py-2 border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-xs font-bold rounded-xl transition-colors"
                              >
                                View in Tests
                              </Link>
                            ) : s.type === "DPP" ? (
                              <Link
                                href="/dpp"
                                className="block text-center w-full md:w-auto px-5 py-2 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-xs font-bold rounded-xl transition-colors"
                              >
                                View in DPP
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
