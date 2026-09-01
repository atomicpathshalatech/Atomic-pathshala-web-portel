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
  OTHER: "border-l-[#2d2e3b]",
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
      <div className="max-w-6xl mx-auto rounded-3xl bg-[#0d0e15] border border-[#2d2e3b] p-6 md:p-10">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-white">My Schedule</h1>
          <p className="text-gray-400 mt-2">Track your learning journey and upcoming milestones.</p>
        </header>
        <div className="mt-6 rounded-2xl border border-[#2d2e3b] bg-[#1a1b23] p-12 text-center text-gray-400">
          You&apos;re not enrolled in a batch yet — once the team enrolls you into one, your real
          class and test schedule will show up here.
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
    <div className="max-w-6xl mx-auto rounded-3xl bg-[#0d0e15] border border-[#2d2e3b] p-6 md:p-10">
      <header>
        <p className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <span>My Courses</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-blue-400">Schedule</span>
        </p>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">My Schedule</h1>
            <p className="text-gray-400 mt-2">
              {enrollments.length} Active Batch{enrollments.length === 1 ? "" : "es"}
            </p>
          </div>
          {/* Batch Selector Tabs */}
          {enrollments.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Link
                href="/schedule"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  !selectedBatchId
                    ? "bg-blue-600 text-white"
                    : "bg-[#1a1b23] text-gray-400 hover:text-white border border-[#2d2e3b]"
                }`}
              >
                All Batches ({allSchedules.length})
              </Link>
              {enrollments.map((e) => (
                <Link
                  key={e.batch.id}
                  href={`/schedule?batch=${e.batch.id}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedBatchId === e.batch.id
                      ? "bg-blue-600 text-white"
                      : "bg-[#1a1b23] text-gray-400 hover:text-white border border-[#2d2e3b]"
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
        <aside className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-[#2d2e3b] bg-[#1a1b23] p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-xl">analytics</span>
              Overview
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#10131b] border border-[#2d2e3b] p-3 rounded-xl">
                <span className="text-xs block text-gray-500">Sessions Held</span>
                <span className="text-2xl font-bold text-white">{past.length}</span>
              </div>
              <div className="bg-[#10131b] border border-[#2d2e3b] p-3 rounded-xl">
                <span className="text-xs block text-gray-500">Upcoming</span>
                <span className="text-2xl font-bold text-white">{upcoming.length}</span>
              </div>
            </div>
          </div>

          {allTeachers.length > 0 && (
            <div className="rounded-2xl border border-[#2d2e3b] bg-[#1a1b23] p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400 text-xl">school</span>
                Faculty
              </h3>
              <ul className="space-y-2">
                {allTeachers.map((t) => (
                  <li key={t.id} className="text-sm text-gray-300">
                    {t.teacher.user.name}
                    {t.subject ? <span className="text-gray-500"> — {t.subject}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="lg:col-span-8">
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-[#2d2e3b] bg-[#1a1b23] p-8 text-center text-gray-400">
              No upcoming sessions scheduled yet. Check back once your batch timetable is updated.
            </div>
          ) : (
            <div className="relative pl-8 md:pl-12 space-y-8 pb-4">
              <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-[#2d2e3b]" />
              {Object.entries(grouped).map(([dayKey, entries]) => (
                <div key={dayKey} className="space-y-4">
                  <div className="relative">
                    <div className="absolute -left-[22px] md:-left-[30px] top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full ring-4 ring-blue-900/30 z-10" />
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
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
                        className={`rounded-2xl border border-[#2d2e3b] bg-[#1a1b23] p-5 hover:border-blue-800/50 transition-colors border-l-4 ${
                          TYPE_BORDER[s.type] ?? "border-l-[#2d2e3b]"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                  isLiveNow ? "bg-red-500/15 text-red-400" : "bg-[#10131b] text-gray-400"
                                }`}
                              >
                                {isLiveNow ? "Live Now" : TYPE_LABELS[s.type] ?? s.type}
                              </span>
                              <span className="text-xs text-blue-400/80 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/30">
                                {s.batch.name}
                              </span>
                              {s.subject && <span className="text-sm text-gray-500">{s.subject}</span>}
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                              {s.teacher && (
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-lg">person</span>
                                  {s.teacher.user.name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-lg">schedule</span>
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
                                  className="block text-center w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                  {isLiveNow ? "Join Class" : "Enter Class"}
                                </Link>
                              ) : (
                                <button
                                  disabled
                                  title="Opens 15 minutes before the scheduled start"
                                  className="w-full md:w-auto px-6 py-2 bg-gray-700 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed"
                                >
                                  Opens 15 min before
                                </button>
                              )
                            ) : s.type === "TEST" ? (
                              <Link
                                href="/tests"
                                className="block text-center w-full md:w-auto px-6 py-2 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-sm font-medium rounded-lg transition-colors"
                              >
                                View in Tests
                              </Link>
                            ) : s.type === "DPP" ? (
                              <Link
                                href="/dpp"
                                className="block text-center w-full md:w-auto px-6 py-2 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-sm font-medium rounded-lg transition-colors"
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
