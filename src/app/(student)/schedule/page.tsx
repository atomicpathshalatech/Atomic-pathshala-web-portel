import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { BatchSchedule, Teacher, User } from "@prisma/client";

export const metadata: Metadata = {
  title: "Batch Schedule",
};

type ScheduleWithTeacher = BatchSchedule & { teacher: (Teacher & { user: User }) | null };

const TYPE_LABELS: Record<string, string> = {
  LIVE_CLASS: "Live Class",
  TEST: "Test",
  DPP: "DPP",
  DOUBT_SESSION: "Doubt Session",
  OTHER: "Special Class",
};

const TYPE_BORDER: Record<string, string> = {
  LIVE_CLASS: "border-l-primary",
  TEST: "border-l-secondary",
  DPP: "border-l-outline-variant",
  DOUBT_SESSION: "border-l-outline-variant",
  OTHER: "border-l-outline-variant",
};

// A student can enter a live class up to 15 minutes before its scheduled
// start — same window the teacher side uses (see (team)/team/my-schedule/
// page.tsx) so both sides of the same class agree on when "Join" unlocks.
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

export default async function SchedulePage() {
  const { student } = await requireStudentSession();

  const enrollment = await prisma.batchEnrollment.findFirst({
    where: { studentId: student.id, status: "ACTIVE" },
    include: {
      batch: {
        include: {
          course: { select: { title: true } },
          teachers: { include: { teacher: { include: { user: true } } } },
          schedules: {
            orderBy: { startsAt: "asc" },
            include: { teacher: { include: { user: true } } },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  if (!enrollment) {
    return (
      <div className="space-y-stack-lg max-w-6xl">
        <header>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
            Batch Roadmap &amp; Schedule
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            Track your learning journey and upcoming milestones.
          </p>
        </header>
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          You&apos;re not enrolled in a batch yet — once the team enrolls you into one, your real
          class and test schedule will show up here.
        </div>
      </div>
    );
  }

  const now = new Date();
  const schedules = enrollment.batch.schedules as ScheduleWithTeacher[];
  const upcoming = schedules.filter((s) => s.endsAt >= now);
  const past = schedules.filter((s) => s.endsAt < now);

  const grouped = upcoming.reduce<Record<string, ScheduleWithTeacher[]>>((acc, s) => {
    const key = s.startsAt.toDateString();
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <header>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <span>My Batch</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">{enrollment.batch.name}</span>
        </p>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
          Batch Roadmap &amp; Schedule
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          {enrollment.batch.code}
          {enrollment.batch.targetExam ? ` · ${enrollment.batch.targetExam}` : ""}
          {enrollment.batch.course ? ` · ${enrollment.batch.course.title}` : ""}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg">
        <aside className="lg:col-span-4 space-y-stack-lg">
          <div className="glass-card rounded-xl p-stack-md">
            <h3 className="font-headline-md text-headline-md mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">analytics</span>
              Batch Stats
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container/50 p-3 rounded-lg">
                <span className="text-label-sm block text-on-surface-variant">Sessions Held</span>
                <span className="font-headline-md text-headline-md">{past.length}</span>
              </div>
              <div className="bg-surface-container/50 p-3 rounded-lg">
                <span className="text-label-sm block text-on-surface-variant">Upcoming</span>
                <span className="font-headline-md text-headline-md">{upcoming.length}</span>
              </div>
            </div>
          </div>

          {enrollment.batch.teachers.length > 0 && (
            <div className="glass-card rounded-xl p-stack-md">
              <h3 className="font-headline-md text-headline-md mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">school</span>
                Faculty
              </h3>
              <ul className="space-y-2">
                {enrollment.batch.teachers.map((t) => (
                  <li key={t.id} className="text-label-md text-on-surface-variant">
                    {t.teacher.user.name}
                    {t.subject ? ` — ${t.subject}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="lg:col-span-8">
          {upcoming.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-on-surface-variant font-body-md">
              No upcoming sessions scheduled yet. Check back once your batch&apos;s timetable is
              published.
            </div>
          ) : (
            <div className="relative pl-8 md:pl-12 space-y-stack-lg pb-4">
              <div className="absolute left-4 md:left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-secondary-container rounded-full opacity-20" />
              {Object.entries(grouped).map(([dayKey, entries]) => (
                <div key={dayKey} className="space-y-stack-md">
                  <div className="relative">
                    <div className="absolute -left-[22px] md:-left-[30px] top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full ring-4 ring-primary-container/20 z-10" />
                    <span className="text-label-sm font-bold text-primary uppercase tracking-wider">
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
                        className={`glass-card rounded-xl p-stack-md hover:shadow-md transition-all border-l-4 ${
                          TYPE_BORDER[s.type] ?? "border-l-outline-variant"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                  isLiveNow
                                    ? "bg-error/10 text-error"
                                    : "bg-surface-container text-on-surface-variant"
                                }`}
                              >
                                {isLiveNow ? "Live Now" : TYPE_LABELS[s.type] ?? s.type}
                              </span>
                              {s.subject && (
                                <span className="text-label-sm text-on-surface-variant">{s.subject}</span>
                              )}
                            </div>
                            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">
                              {s.title}
                            </h3>
                            <div className="flex flex-wrap gap-4 text-label-md text-on-surface-variant">
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
                          {s.type === "LIVE_CLASS" && (
                            <div className="shrink-0 w-full md:w-auto">
                              {canEnter ? (
                                <Link
                                  href={`/live-class/${s.id}`}
                                  className="block text-center w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-label-md rounded-lg hover:opacity-90"
                                >
                                  {isLiveNow ? "Join Class" : "Enter Class"}
                                </Link>
                              ) : (
                                <button
                                  disabled
                                  title="Opens 15 minutes before the scheduled start"
                                  className="w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-label-md rounded-lg opacity-70 cursor-not-allowed"
                                >
                                  Opens 15 min before
                                </button>
                              )}
                            </div>
                          )}
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
