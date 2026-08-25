import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { BatchSchedule, Teacher, User } from "@prisma/client";
import { NextClassCountdown } from "@/components/student/NextClassCountdown";

export const metadata: Metadata = {
  title: "Dashboard",
};

type ScheduleWithTeacher = BatchSchedule & { teacher: (Teacher & { user: User }) | null };

const TYPE_LABELS: Record<string, string> = {
  LIVE_CLASS: "Live Class",
  TEST: "Test",
  DPP: "DPP",
  DOUBT_SESSION: "Doubt Session",
  OTHER: "Session",
};

function isToday(date: Date) {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

export default async function StudentDashboardPage() {
  const { student } = await requireStudentSession();
  const now = new Date();

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    include: {
      batch: {
        include: {
          course: { select: { title: true } },
          teachers: { include: { teacher: { include: { user: true } } } },
          schedules: {
            where: { endsAt: { gte: now } },
            orderBy: { startsAt: "asc" },
            include: { teacher: { include: { user: true } } },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const allUpcoming: ScheduleWithTeacher[] = enrollments
    .flatMap((e) => e.batch.schedules as ScheduleWithTeacher[])
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const nextClass = allUpcoming[0] ?? null;
  const todaysSchedule = allUpcoming.filter((s) => isToday(s.startsAt)).slice(0, 5);

  const [openDoubtsCount, recentDoubts] = await Promise.all([
    prisma.doubt.count({ where: { studentId: student.id, status: "OPEN" } }),
    prisma.doubt.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const firstName = student.user.name.split(" ")[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-stack-lg max-w-7xl">
      {/* Welcome + next class */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-stack-md glass-card p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="z-10">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {greeting}, {firstName}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {enrollments.length > 0
              ? `Enrolled in ${enrollments.length} batch${enrollments.length === 1 ? "" : "es"} — here's what's next.`
              : "You're not enrolled in a batch yet."}
          </p>
        </div>

        {nextClass && (
          <div className="bg-surface-container-lowest border border-outline-variant/30 p-4 rounded-xl flex flex-col items-center md:items-end gap-2 z-10 shadow-sm min-w-[260px]">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
              {TYPE_LABELS[nextClass.type] ?? nextClass.type} starts in
            </span>
            <NextClassCountdown startsAtIso={nextClass.startsAt.toISOString()} />
            <p className="font-label-md text-label-md text-on-surface text-center md:text-right">{nextClass.title}</p>
            {nextClass.type === "LIVE_CLASS" ? (
              <Link
                href={`/live-class/${nextClass.id}`}
                className="w-full md:w-auto text-center bg-primary text-on-primary font-label-md text-label-md px-6 py-2 rounded-full hover:opacity-90 transition-opacity"
              >
                Go to Live Class
              </Link>
            ) : (
              <Link
                href="/schedule"
                className="w-full md:w-auto text-center border border-primary text-primary font-label-md text-label-md px-6 py-2 rounded-full hover:bg-primary/5 transition-colors"
              >
                View in Schedule
              </Link>
            )}
          </div>
        )}
      </section>

      {enrollments.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          Once the team enrolls you into a batch, your classes, schedule, and progress will show up
          here. In the meantime, you can still raise a doubt from the{" "}
          <Link href="/doubts" className="text-primary hover:underline">
            Doubt Portal
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg">
          {/* Left column */}
          <div className="lg:col-span-8 space-y-stack-lg">
            {/* Quick stats */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
              <div className="glass-card p-4 rounded-xl flex flex-col gap-1">
                <span className="material-symbols-outlined text-primary text-2xl">groups</span>
                <span className="font-headline-md text-headline-md text-on-surface mt-1">{enrollments.length}</span>
                <span className="text-label-sm text-on-surface-variant">My Batches</span>
              </div>
              <div className="glass-card p-4 rounded-xl flex flex-col gap-1">
                <span className="material-symbols-outlined text-secondary text-2xl">today</span>
                <span className="font-headline-md text-headline-md text-on-surface mt-1">{todaysSchedule.length}</span>
                <span className="text-label-sm text-on-surface-variant">Today&apos;s Classes</span>
              </div>
              <div className="glass-card p-4 rounded-xl flex flex-col gap-1">
                <span className="material-symbols-outlined text-error text-2xl">live_help</span>
                <span className="font-headline-md text-headline-md text-on-surface mt-1">{openDoubtsCount}</span>
                <span className="text-label-sm text-on-surface-variant">Open Doubts</span>
              </div>
              <div className="glass-card p-4 rounded-xl flex flex-col gap-1">
                <span className="material-symbols-outlined text-secondary text-2xl">event_upcoming</span>
                <span className="font-headline-md text-headline-md text-on-surface mt-1">{allUpcoming.length}</span>
                <span className="text-label-sm text-on-surface-variant">Upcoming Sessions</span>
              </div>
            </section>

            {/* Today's schedule */}
            <section className="glass-card p-6 rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-headline-md text-headline-md text-on-surface">Today&apos;s Schedule</h2>
                <Link href="/schedule" className="font-label-md text-label-md text-primary hover:underline">
                  View Full
                </Link>
              </div>
              {todaysSchedule.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant py-6 text-center">
                  Nothing scheduled for today.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {todaysSchedule.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest"
                    >
                      <div className="w-16 flex flex-col items-center justify-center border-r border-outline-variant/30 pr-4 shrink-0">
                        <span className="font-label-md text-label-md text-on-surface">
                          {s.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="bg-surface-container px-2 py-0.5 rounded text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">
                          {TYPE_LABELS[s.type] ?? s.type}
                        </span>
                        <h3 className="font-label-md text-label-md text-on-surface mt-1 truncate">{s.title}</h3>
                        {s.teacher && (
                          <p className="text-label-sm text-on-surface-variant">{s.teacher.user.name}</p>
                        )}
                      </div>
                      {s.type === "LIVE_CLASS" && (
                        <Link
                          href={`/live-class/${s.id}`}
                          className="shrink-0 text-primary font-label-md text-label-md hover:underline"
                        >
                          Join
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 space-y-stack-lg">
            <section className="glass-card p-4 rounded-2xl">
              <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide mb-3">
                My Batches
              </h2>
              <div className="flex flex-col gap-3">
                {enrollments.slice(0, 3).map((e) => (
                  <Link
                    key={e.id}
                    href={`/courses/${e.batch.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/40 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-secondary-container text-lg">science</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-label-md text-label-md text-on-surface truncate">{e.batch.name}</h3>
                      <p className="text-label-sm text-on-surface-variant truncate">
                        {e.batch.teachers.length} faculty · {e.batch.schedules.length} upcoming
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              <Link href="/courses" className="block text-center mt-3 font-label-md text-label-md text-primary hover:underline">
                View all batches
              </Link>
            </section>

            <section className="glass-card p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wide">
                  Recent Doubts
                </h2>
                <Link href="/doubts" className="text-primary">
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                </Link>
              </div>
              {recentDoubts.length === 0 ? (
                <p className="text-label-sm text-on-surface-variant py-4 text-center">
                  No doubts submitted yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentDoubts.map((d) => (
                    <Link
                      key={d.id}
                      href={`/doubts/${d.id}`}
                      className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-label-sm text-on-surface-variant">{d.subject ?? "General"}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            d.status === "RESOLVED"
                              ? "bg-primary/10 text-primary"
                              : d.status === "FLAGGED"
                                ? "bg-error/10 text-error"
                                : "bg-surface-container text-on-surface-variant"
                          }`}
                        >
                          {d.status === "OPEN" ? "Pending" : d.status === "RESOLVED" ? "Resolved" : "Flagged"}
                        </span>
                      </div>
                      <p className="font-label-md text-label-md text-on-surface line-clamp-1">{d.body}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
