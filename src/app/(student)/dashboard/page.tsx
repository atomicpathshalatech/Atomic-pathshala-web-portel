import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { BatchSchedule, Teacher, User } from "@prisma/client";
import { NextClassCountdown } from "@/components/student/NextClassCountdown";

export const metadata: Metadata = {
  title: "Home",
};

type ScheduleWithTeacher = BatchSchedule & { teacher: (Teacher & { user: User }) | null };

const TYPE_LABELS: Record<string, string> = {
  LIVE_CLASS: "Live Class",
  TEST: "Test",
  DPP: "DPP",
  DOUBT_SESSION: "Doubt Session",
  OTHER: "Session",
};

// Rotating accent so batch cards without a cover image don't all look identical —
// deterministic by index, not random (avoids Math.random() flicker between renders).
const CARD_ACCENTS = [
  "from-primary/25 via-primary/10 to-transparent",
  "from-secondary/25 via-secondary/10 to-transparent",
  "from-error/20 via-error/5 to-transparent",
  "from-primary/15 via-secondary/15 to-transparent",
];

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

  const enrolledBatchIds = enrollments.map((e) => e.batch.id);

  const allUpcoming: ScheduleWithTeacher[] = enrollments
    .flatMap((e) => e.batch.schedules as ScheduleWithTeacher[])
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const nextClass = allUpcoming[0] ?? null;
  const todaysSchedule = allUpcoming.filter((s) => isToday(s.startsAt)).slice(0, 5);

  const [openDoubtsCount, recentDoubts, popularBatches] = await Promise.all([
    prisma.doubt.count({ where: { studentId: student.id, status: "OPEN" } }),
    prisma.doubt.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.batch.findMany({
      where: {
        status: { in: ["ACTIVE", "UPCOMING"] },
        id: { notIn: enrolledBatchIds },
      },
      include: {
        course: { select: { title: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { enrollments: { _count: "desc" } },
      take: 6,
    }),
  ]);

  const firstName = student.user.name.split(" ")[0];
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-stack-lg max-w-7xl">
      {/* Hero: greeting + real XP/streak (no invented numbers — same fields the
          gamification API reads from Student.xp / .level / .currentStreakDays) */}
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
        <div className="flex items-center gap-3 z-10">
          <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 px-4 py-2 rounded-full shadow-sm">
            <span className="material-symbols-outlined text-error text-xl">local_fire_department</span>
            <span className="font-label-lg text-label-lg text-on-surface">{student.currentStreakDays}</span>
            <span className="text-label-sm text-on-surface-variant">day streak</span>
          </div>
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 px-4 py-2 rounded-full shadow-sm hover:border-primary/40 transition-colors"
          >
            <span className="material-symbols-outlined text-primary text-xl">military_tech</span>
            <span className="font-label-lg text-label-lg text-on-surface">Lvl {student.level}</span>
            <span className="text-label-sm text-on-surface-variant">· {student.xp} XP</span>
          </Link>
        </div>
      </section>

      {enrollments.length === 0 && popularBatches.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          Once the team enrolls you into a batch, your classes, schedule, and progress will show up
          here. In the meantime, you can still raise a doubt from the{" "}
          <Link href="/doubts" className="text-primary hover:underline">
            Doubt Portal
          </Link>
          .
        </div>
      ) : (
        <>
          {/* Continue Learning spotlight — bigger promo treatment of the same
              next-class data the old page showed in a small side card. */}
          {nextClass && (
            <section className="glass-card rounded-2xl p-6 relative overflow-hidden bg-gradient-to-br from-primary/15 via-surface-container-lowest to-surface-container-lowest">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="font-label-sm text-label-sm text-primary uppercase tracking-wide">
                    Continue Learning · {TYPE_LABELS[nextClass.type] ?? nextClass.type}
                  </span>
                  <h2 className="font-headline-md text-headline-md text-on-surface mt-1">{nextClass.title}</h2>
                  {nextClass.teacher && (
                    <p className="text-body-sm text-on-surface-variant mt-1">{nextClass.teacher.user.name}</p>
                  )}
                  <div className="mt-3">
                    <NextClassCountdown startsAtIso={nextClass.startsAt.toISOString()} />
                  </div>
                </div>
                {nextClass.type === "LIVE_CLASS" ? (
                  <Link
                    href={`/live-class/${nextClass.id}`}
                    className="shrink-0 text-center bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
                  >
                    Go to Live Class
                  </Link>
                ) : (
                  <Link
                    href="/schedule"
                    className="shrink-0 text-center border border-primary text-primary font-label-md text-label-md px-6 py-3 rounded-full hover:bg-primary/5 transition-colors"
                  >
                    View in Schedule
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* Quick stats as a horizontal chip row instead of a fixed 4-box grid */}
          <section className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {[
              { icon: "groups", value: enrollments.length, label: "My Batches", color: "text-primary" },
              { icon: "today", value: todaysSchedule.length, label: "Today's Classes", color: "text-secondary" },
              { icon: "live_help", value: openDoubtsCount, label: "Open Doubts", color: "text-error" },
              { icon: "event_upcoming", value: allUpcoming.length, label: "Upcoming Sessions", color: "text-secondary" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="glass-card px-4 py-3 rounded-xl flex items-center gap-3 shrink-0 min-w-[160px]"
              >
                <span className={`material-symbols-outlined text-2xl ${stat.color}`}>{stat.icon}</span>
                <div>
                  <span className="font-headline-sm text-headline-sm text-on-surface block leading-tight">
                    {stat.value}
                  </span>
                  <span className="text-label-sm text-on-surface-variant">{stat.label}</span>
                </div>
              </div>
            ))}
          </section>

          {/* My Batches — horizontal-scroll cards (real enrolled batches, no placeholders) */}
          {enrollments.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="font-headline-md text-headline-md text-on-surface">My Batches</h2>
                <Link href="/courses" className="font-label-md text-label-md text-primary hover:underline">
                  View all
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                {enrollments.map((e, i) => (
                  <Link
                    key={e.id}
                    href={`/courses/${e.batch.id}`}
                    className={`shrink-0 w-64 rounded-2xl p-5 border border-outline-variant/30 bg-gradient-to-br ${CARD_ACCENTS[i % CARD_ACCENTS.length]} bg-surface-container-lowest hover:border-primary/40 transition-colors`}
                  >
                    <span className="material-symbols-outlined text-on-surface text-2xl">science</span>
                    <h3 className="font-label-lg text-label-lg text-on-surface mt-3 line-clamp-2">
                      {e.batch.name}
                    </h3>
                    <p className="text-label-sm text-on-surface-variant mt-1 truncate">
                      {e.batch.course?.title ?? "General"}
                    </p>
                    <p className="text-label-sm text-on-surface-variant mt-3">
                      {e.batch.teachers.length} faculty · {e.batch.schedules.length} upcoming
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Popular Batches — real upsell data, ranked by actual enrollment count
              (Batch._count.enrollments), excludes batches the student is already
              in. No enroll flow exists yet, so these route to /subscription
              (the existing plans/upgrade page) rather than a dead "Enroll" button. */}
          {popularBatches.length > 0 && (
            <section>
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="font-headline-md text-headline-md text-on-surface">Popular Batches</h2>
                <Link href="/subscription" className="font-label-md text-label-md text-primary hover:underline">
                  See plans
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                {popularBatches.map((b, i) => (
                  <Link
                    key={b.id}
                    href="/subscription"
                    className={`shrink-0 w-64 rounded-2xl p-5 border border-outline-variant/30 bg-gradient-to-br ${CARD_ACCENTS[(i + 2) % CARD_ACCENTS.length]} bg-surface-container-lowest hover:border-primary/40 transition-colors`}
                  >
                    <span className="material-symbols-outlined text-on-surface text-2xl">auto_stories</span>
                    <h3 className="font-label-lg text-label-lg text-on-surface mt-3 line-clamp-2">{b.name}</h3>
                    <p className="text-label-sm text-on-surface-variant mt-1 truncate">
                      {b.course?.title ?? b.targetExam ?? "General"}
                    </p>
                    <p className="text-label-sm text-on-surface-variant mt-3">
                      {b._count.enrollments} student{b._count.enrollments === 1 ? "" : "s"} enrolled
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg">
            {/* Today's schedule */}
            <div className="lg:col-span-8">
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

            {/* Right column — Doubt Portal shortcut + recent doubts */}
            <div className="lg:col-span-4 space-y-stack-lg">
              <Link
                href="/doubts"
                className="glass-card rounded-2xl p-5 flex items-center gap-4 hover:border-primary/40 border border-transparent transition-colors block"
              >
                <span className="material-symbols-outlined text-primary text-3xl">forum</span>
                <div>
                  <h3 className="font-label-lg text-label-lg text-on-surface">Doubt Portal</h3>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">
                    {openDoubtsCount > 0
                      ? `${openDoubtsCount} doubt${openDoubtsCount === 1 ? "" : "s"} awaiting an answer`
                      : "Stuck on something? Ask now."}
                  </p>
                </div>
              </Link>

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
        </>
      )}
    </div>
  );
}
