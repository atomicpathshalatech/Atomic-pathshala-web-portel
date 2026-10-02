import "server-only";
import { prisma } from "@/lib/db";
import { getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";
import { istClock } from "@/lib/batch/past-classes";

type LectureLike = {
  id: string;
  scheduledDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  durationMin: number | null;
  status: string;
};

export type LectureAsScheduled = {
  scheduledDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  durationMin: number | null;
  /** The lecture's own status, or the class's: COMPLETED / LIVE / CANCELLED. */
  status: string;
};

/**
 * The class each lecture actually runs as in the batch timetable — its date,
 * time and state are what the chapter shows. The lecture's own saved date
 * drifted whenever the timetable was moved, so the chapter page and My
 * Schedule disagreed. With several batches, the first of `batchOrder` wins.
 */
export async function lecturesAsScheduled(
  lectures: LectureLike[],
  batchOrder: string[],
  now: Date = new Date()
): Promise<Map<string, LectureAsScheduled>> {
  const out = new Map<string, LectureAsScheduled>();
  const own = (l: LectureLike): LectureAsScheduled => ({
    scheduledDate: l.scheduledDate,
    startTime: l.startTime,
    endTime: l.endTime,
    durationMin: l.durationMin,
    status: l.status,
  });
  if (lectures.length === 0) return out;

  const classes = await prisma.batchSchedule.findMany({
    where: { lectureId: { in: lectures.map((l) => l.id) }, type: "LIVE_CLASS" },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      lectureId: true,
      batchId: true,
      startsAt: true,
      endsAt: true,
      status: true,
      type: true,
      liveWhiteboardSession: { select: { status: true, livePhase: true } },
    },
  });
  const rank = new Map(batchOrder.map((id, i) => [id, i]));
  const rankOf = (c: (typeof classes)[number]) => rank.get(c.batchId) ?? 999;
  const classOf = new Map<string, (typeof classes)[number]>();
  for (const c of classes) {
    if (!c.lectureId) continue;
    const prev = classOf.get(c.lectureId);
    if (!prev || rankOf(c) < rankOf(prev)) classOf.set(c.lectureId, c);
  }

  for (const l of lectures) {
    const c = classOf.get(l.id);
    if (!c) {
      out.set(l.id, own(l));
      continue;
    }
    const state = getEffectiveScheduleStatus(c, now);
    out.set(l.id, {
      scheduledDate: c.startsAt,
      startTime: istClock(c.startsAt),
      endTime: istClock(c.endsAt),
      durationMin: Math.max(1, Math.round((c.endsAt.getTime() - c.startsAt.getTime()) / 60000)),
      status: state === "COMPLETED" || state === "LIVE" || state === "CANCELLED" ? state : l.status,
    });
  }
  return out;
}
