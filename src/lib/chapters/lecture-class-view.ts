import "server-only";
import { prisma } from "@/lib/db";
import { getEffectiveScheduleStatus, type NormalizedScheduleStatus } from "@/lib/schedule/access-rules";
import { istClock } from "@/lib/batch/past-classes";

type LectureLike = {
  id: string;
  title: string;
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
  /** The batch class this lecture runs as (Start Class opens exactly this one). */
  scheduleId: string | null;
};

/** A class in the batch timetable for this chapter that no lecture stands for. */
export type TimetableOnlyClass = LectureAsScheduled & { scheduleId: string; title: string };

const classSelect = {
  id: true,
  title: true,
  lectureId: true,
  batchId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  type: true,
  classMode: true,
  liveWhiteboardSession: { select: { status: true, livePhase: true, actualStartedAt: true } },
} as const;

/** Held beats running beats still ahead beats not held — the row that says what really happened. */
const EVIDENCE: Record<string, number> = { COMPLETED: 4, LIVE: 3, READY: 2, TEACHER_ENTRY_OPEN: 2, SCHEDULED: 1, CANCELLED: 0 };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * The class each lecture actually runs as in the batch timetable — its date,
 * time and state are what the chapter shows, so the chapter page and My
 * Schedule agree.
 *
 * Classes can reach the timetable two ways: from the chapter (linked to the
 * lecture) or added straight to the batch timetable with only the chapter set
 * (no lecture). A lecture therefore also stands for a timetable-only class of
 * its chapter with the same title, or at an overlapping time in the same
 * batch — otherwise a class the teacher really took showed "Cancelled" here
 * (the chapter's own row was never started). Among several rows the one that
 * was held wins, then the batch order. Timetable-only classes that match no
 * lecture are returned too, so every class of the chapter is listed.
 */
export async function lecturesAsScheduled(
  lectures: LectureLike[],
  batchOrder: string[],
  now: Date = new Date(),
  chapterId?: string
): Promise<{ byLecture: Map<string, LectureAsScheduled>; timetableOnly: TimetableOnlyClass[] }> {
  const byLecture = new Map<string, LectureAsScheduled>();
  const own = (l: LectureLike): LectureAsScheduled => ({
    scheduledDate: l.scheduledDate,
    startTime: l.startTime,
    endTime: l.endTime,
    durationMin: l.durationMin,
    status: l.status,
    scheduleId: null,
  });

  const [linked, unlinked] = await Promise.all([
    lectures.length
      ? prisma.batchSchedule.findMany({
          where: { lectureId: { in: lectures.map((l) => l.id) }, type: "LIVE_CLASS" },
          orderBy: { startsAt: "asc" },
          select: classSelect,
        })
      : Promise.resolve([]),
    chapterId
      ? prisma.batchSchedule.findMany({
          where: {
            chapterId,
            lectureId: null,
            type: "LIVE_CLASS",
            ...(batchOrder.length ? { batchId: { in: batchOrder } } : {}),
          },
          orderBy: { startsAt: "asc" },
          select: classSelect,
        })
      : Promise.resolve([]),
  ]);
  type Row = (typeof linked)[number];

  const rank = new Map(batchOrder.map((id, i) => [id, i]));
  const stateOf = new Map<string, NormalizedScheduleStatus>();
  const state = (c: Row) => {
    let s = stateOf.get(c.id);
    if (!s) {
      s = getEffectiveScheduleStatus(c, now);
      stateOf.set(c.id, s);
    }
    return s;
  };
  const better = (a: Row, b: Row) => {
    const ea = EVIDENCE[state(a)] ?? 1;
    const eb = EVIDENCE[state(b)] ?? 1;
    if (ea !== eb) return ea > eb;
    return (rank.get(a.batchId) ?? 999) < (rank.get(b.batchId) ?? 999);
  };

  const used = new Set<string>();
  for (const l of lectures) {
    const mine = linked.filter((c) => c.lectureId === l.id);
    let best: Row | undefined = mine.reduce<Row | undefined>((acc, c) => (!acc || better(c, acc) ? c : acc), undefined);

    // A timetable-only class of this chapter that is the same class.
    const title = norm(l.title);
    const twin = unlinked
      .filter((u) => !used.has(u.id))
      .filter((u) => {
        if (title && norm(u.title) === title) return true;
        return mine.some((c) => c.batchId === u.batchId && u.startsAt < c.endsAt && c.startsAt < u.endsAt);
      })
      .reduce<Row | undefined>((acc, u) => (!acc || better(u, acc) ? u : acc), undefined);
    if (twin) {
      used.add(twin.id);
      if (!best || better(twin, best)) best = twin;
    }

    if (!best) {
      byLecture.set(l.id, own(l));
      continue;
    }
    const s = state(best);
    byLecture.set(l.id, {
      scheduledDate: best.startsAt,
      startTime: istClock(best.startsAt),
      endTime: istClock(best.endsAt),
      durationMin: Math.max(1, Math.round((best.endsAt.getTime() - best.startsAt.getTime()) / 60000)),
      // A lecture already marked done never turns "cancelled" because one of its rows wasn't started.
      status:
        s === "COMPLETED" || s === "LIVE" || (s === "CANCELLED" && !["COMPLETED", "RECORDED"].includes(l.status)) ? s : l.status,
      scheduleId: best.id,
    });
  }

  // One entry per timetable-only class (the first batch's when the same class is in several).
  const seen = new Set<string>();
  const timetableOnly: TimetableOnlyClass[] = [];
  for (const u of [...unlinked].sort((a, b) => (rank.get(a.batchId) ?? 999) - (rank.get(b.batchId) ?? 999))) {
    if (used.has(u.id)) continue;
    const key = `${norm(u.title)}|${u.startsAt.toISOString().slice(0, 16)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = state(u);
    timetableOnly.push({
      scheduleId: u.id,
      title: u.title,
      scheduledDate: u.startsAt,
      startTime: istClock(u.startsAt),
      endTime: istClock(u.endsAt),
      durationMin: Math.max(1, Math.round((u.endsAt.getTime() - u.startsAt.getTime()) / 60000)),
      status: s === "COMPLETED" || s === "LIVE" || s === "CANCELLED" ? s : "SCHEDULED",
    });
  }
  timetableOnly.sort((a, b) => a.scheduledDate!.getTime() - b.scheduledDate!.getTime());
  return { byLecture, timetableOnly };
}
