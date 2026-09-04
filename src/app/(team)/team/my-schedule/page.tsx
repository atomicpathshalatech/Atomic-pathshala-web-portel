import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { BatchSchedule, Batch } from "@prisma/client";

export const metadata: Metadata = {
  title: "My Schedule",
};

// A teacher can start a class up to 15 minutes before its scheduled start —
// same join window the student side uses (see (student)/schedule/page.tsx)
// so "class starts in X" and "you can enter now" line up on both sides of
// the same class.
const JOIN_WINDOW_MS = 15 * 60 * 1000;

type ScheduleWithBatch = BatchSchedule & { batch: Batch };

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
  OTHER: "border-l-tertiary",
};

import {
  formatISTTime,
  formatISTDayLabel,
  getISTDayKey,
} from "@/lib/date-utils";

/**
 * Teacher's own class timetable — every schedule entry across every batch
 * this teacher actually teaches, whether assigned directly on the schedule
 * (BatchSchedule.teacherId) or via the batch's teacher roster
 * (BatchTeacher). Mirrors (student)/schedule/page.tsx's shape/behavior on
 * the teacher side, and reuses the same access logic the live-class room
 * page itself already enforces (see (team)/team/live-class/[scheduleId]/
 * page.tsx) — a teacher only ever sees classes they're actually allowed
 * to start.
 */
export default async function TeacherMySchedulePage() {
  const { user } = await requireTeamSession();
  const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });

  if (!teacher) {
    return (
      <div className="space-y-stack-lg max-w-6xl">
        <header>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
            My Schedule
          </h1>
        </header>
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          This account doesn&apos;t have a teacher profile, so there&apos;s no teaching timetable to show
          here.
        </div>
      </div>
    );
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const schedules = (await prisma.batchSchedule.findMany({
    where: {
      endsAt: { gte: dayAgo },
      OR: [{ teacherId: teacher.id }, { batch: { teachers: { some: { teacherId: teacher.id } } } }],
    },
    orderBy: { startsAt: "asc" },
    include: { batch: true },
  })) as ScheduleWithBatch[];

  if (schedules.length === 0) {
    return (
      <div className="space-y-stack-lg max-w-6xl">
        <header>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
            My Schedule
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            Every class across the batches you teach, in one place.
          </p>
        </header>
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          Nothing scheduled for you yet — once a batch adds you to its timetable, your classes will
          show up here.
        </div>
      </div>
    );
  }

  const upcoming = schedules.filter((s) => s.endsAt >= now);
  const past = schedules.filter((s) => s.endsAt < now);

  const grouped = upcoming.reduce<Record<string, ScheduleWithBatch[]>>((acc, s) => {
    const key = getISTDayKey(s.startsAt);
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <header>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
          My Schedule
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Every class across the batches you teach — start a live class right from here.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg">
        <aside className="lg:col-span-4 space-y-stack-lg">
          <div className="glass-card rounded-xl p-stack-md">
            <h3 className="font-headline-md text-headline-md mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">analytics</span>
              Teaching Stats
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
        </aside>

        <section className="lg:col-span-8">
          {upcoming.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-on-surface-variant font-body-md">
              No upcoming sessions on your timetable right now.
            </div>
          ) : (
            <div className="relative pl-8 md:pl-12 space-y-stack-lg pb-4">
              <div className="absolute left-4 md:left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-secondary-container rounded-full opacity-20" />
              {Object.entries(grouped).map(([dayKey, entries]) => (
                <div key={dayKey} className="space-y-stack-md">
                  <div className="relative">
                    <div className="absolute -left-[22px] md:-left-[30px] top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full ring-4 ring-primary-container/20 z-10" />
                    <span className="text-label-sm font-bold text-primary uppercase tracking-wider">
                      {formatISTDayLabel(dayKey)}
                    </span>
                  </div>
                  {entries.map((s) => {
                    const isLiveNow = s.status === "LIVE" || (s.startsAt <= now && s.endsAt >= now);
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
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-lg">groups</span>
                                {s.batch.name}
                              </span>
                              <span className="flex items-center gap-1 font-mono">
                                <span className="material-symbols-outlined text-lg">schedule</span>
                                {formatISTTime(s.startsAt)} – {formatISTTime(s.endsAt)} (IST)
                              </span>
                            </div>
                          </div>
                          {s.type === "LIVE_CLASS" && (
                            <div className="shrink-0 w-full md:w-auto self-end md:self-center">
                              <Link
                                href={`/team/live-class/${s.id}`}
                                className={`block text-center w-full md:w-auto px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 ${
                                  isLiveNow
                                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25 animate-pulse"
                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25"
                                }`}
                              >
                                <span className="material-symbols-outlined text-base">videocam</span>
                                <span>{isLiveNow ? "🔴 Enter Live Class" : "🚀 Start Class"}</span>
                              </Link>
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
