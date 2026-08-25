import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { BatchSchedule, Teacher, User, Batch } from "@prisma/client";

export const metadata: Metadata = {
  title: "Live Classes",
};

type ScheduleWithRefs = BatchSchedule & {
  teacher: (Teacher & { user: User }) | null;
  batch: Batch;
};

/**
 * Listing page only — clicking a live/upcoming class links to
 * `/live-class/[scheduleId]`, the real whiteboard + video classroom, which
 * is built in a separate update package (live-whiteboard / tests-video).
 * This page works standalone (it's just reading BatchSchedule), but the
 * "Join"/"Enter Class" links 404 until that package is also merged — see
 * the README for this update.
 */
export default async function LiveClassesListPage() {
  const { student } = await requireStudentSession();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    select: { batchId: true },
  });
  const batchIds = enrollments.map((e) => e.batchId);

  const schedules = (batchIds.length === 0
    ? []
    : await prisma.batchSchedule.findMany({
        where: {
          batchId: { in: batchIds },
          type: "LIVE_CLASS",
          endsAt: { gte: dayAgo },
        },
        orderBy: { startsAt: "asc" },
        include: { teacher: { include: { user: true } }, batch: true },
      })) as ScheduleWithRefs[];

  const live = schedules.filter((s) => s.status === "LIVE" || (s.startsAt <= now && s.endsAt >= now));
  const upcoming = schedules.filter((s) => !live.includes(s) && s.startsAt > now);
  const recentlyEnded = schedules.filter((s) => !live.includes(s) && s.endsAt < now);

  function ScheduleRow({ s, isLive }: { s: ScheduleWithRefs; isLive: boolean }) {
    return (
      <div
        className={`glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${
          isLive ? "border-2 border-primary" : ""
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isLive ? (
              <span className="flex items-center gap-1 bg-error/10 text-error text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                Live Now
              </span>
            ) : (
              <span className="text-label-sm text-on-surface-variant">
                {s.startsAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ·{" "}
                {s.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <h3 className="font-label-md text-label-md font-semibold text-on-surface truncate">{s.title}</h3>
          <p className="text-label-sm text-on-surface-variant truncate">
            {s.batch.name}
            {s.teacher ? ` · ${s.teacher.user.name}` : ""}
          </p>
        </div>
        <Link
          href={`/live-class/${s.id}`}
          className={`shrink-0 text-center px-5 py-2 rounded-full font-label-md text-label-md transition-colors ${
            isLive
              ? "bg-primary text-on-primary hover:opacity-90"
              : "border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          {isLive ? "Join Class" : "View Details"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <header>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">Live Classes</h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Join a class that&apos;s live now, or see what&apos;s coming up next.
        </p>
      </header>

      {schedules.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No live classes scheduled right now.
        </div>
      ) : (
        <div className="space-y-stack-lg">
          {live.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-headline-md text-headline-md text-on-surface">Live Now</h2>
              {live.map((s) => (
                <ScheduleRow key={s.id} s={s} isLive />
              ))}
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-headline-md text-headline-md text-on-surface">Upcoming</h2>
              {upcoming.map((s) => (
                <ScheduleRow key={s.id} s={s} isLive={false} />
              ))}
            </section>
          )}
          {recentlyEnded.length > 0 && (
            <section className="space-y-3 opacity-70">
              <h2 className="font-headline-md text-headline-md text-on-surface">Recently Ended</h2>
              {recentlyEnded.map((s) => (
                <ScheduleRow key={s.id} s={s} isLive={false} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
