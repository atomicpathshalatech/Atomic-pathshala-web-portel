import "server-only";
import { prisma } from "@/lib/db";

/**
 * Everything an enrolled student's batch page shows, in one place (PW/Allen
 * style): classes (live, upcoming, recorded) + chapters, the batch's tests,
 * its study-material folders, and its announcements.
 */

export type BatchClassItem = {
  id: string;
  title: string;
  subject: string | null;
  teacherName: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  type: string;
  liveWhiteboardSession: { status?: string; livePhase?: string } | null;
};

export type BatchChapterItem = { id: string; title: string; subjectId: string; subject: string; lectures: number; dpps: number };

export type BatchTestItem = {
  id: string;
  name: string;
  durationMin: number;
  openTime: string | null;
  closeTime: string | null;
  attemptStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
};

export type BatchFolderNode = {
  id: string;
  parentId: string | null;
  name: string;
  files: { id: string; title: string; fileName: string; sizeBytes: number }[];
};

export type BatchNotice = { id: string; title: string; body: string; createdAt: string; deepLink: string | null };

export type StudentBatchHomeData = {
  batch: { id: string; name: string; code: string; exam: string | null; thumbnailUrl: string | null; teachers: string[] };
  classes: BatchClassItem[];
  chapters: BatchChapterItem[];
  tests: BatchTestItem[];
  folders: BatchFolderNode[];
  notices: BatchNotice[];
};

export async function loadStudentBatchHome(batchId: string, studentId: string, userId: string): Promise<StudentBatchHomeData | null> {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      name: true,
      code: true,
      targetExam: true,
      thumbnailUrl: true,
      courseId: true,
      teachers: { select: { teacher: { select: { user: { select: { name: true } } } } } },
    },
  });
  if (!batch) return null;

  const visibleChapter = { status: { in: ["PUBLISHED" as const, "APPROVED" as const] } };
  const [schedules, assigned, courseChapters, seriesLinks, folders, notifications, broadcasts] = await Promise.all([
    prisma.batchSchedule.findMany({
      where: { batchId, type: "LIVE_CLASS", status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        title: true,
        subject: true,
        startsAt: true,
        endsAt: true,
        status: true,
        type: true,
        teacher: { select: { user: { select: { name: true } } } },
        liveWhiteboardSession: { select: { status: true, livePhase: true } },
      },
    }),
    prisma.batchChapter.findMany({
      where: { batchId, chapter: visibleChapter },
      select: { chapter: { select: { id: true, title: true, order: true, subject: { select: { id: true, title: true } }, _count: { select: { lectures: true, dpps: true } } } } },
    }),
    batch.courseId
      ? prisma.chapter.findMany({
          where: { ...visibleChapter, subject: { courseId: batch.courseId } },
          select: { id: true, title: true, order: true, subject: { select: { id: true, title: true } }, _count: { select: { lectures: true, dpps: true } } },
        })
      : Promise.resolve([]),
    prisma.batchTestSeries.findMany({ where: { batchId }, select: { testSeriesId: true } }),
    prisma.batchFolder.findMany({
      where: { batchId, isPublished: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        parentId: true,
        name: true,
        files: {
          where: { isPublished: true },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, fileName: true, sizeBytes: true },
        },
      },
    }),
    prisma.notification.findMany({
      where: { userId, batchId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, body: true, createdAt: true, deepLink: true },
    }),
    prisma.notificationBroadcast.findMany({
      where: { segmentType: "BATCH", segmentValue: batchId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, body: true, createdAt: true },
    }),
  ]);

  // A folder is visible only if every folder above it is published too.
  const byId = new Map(folders.map((f) => [f.id, f]));
  // (byId holds only published folders, so an unpublished ancestor breaks the chain.)
  const visible = (f: (typeof folders)[number], depth = 0): boolean => {
    if (!f.parentId) return true;
    const parent = byId.get(f.parentId);
    return Boolean(parent) && depth < 50 && visible(parent!, depth + 1);
  };

  const chapterMap = new Map<string, BatchChapterItem & { order: number }>();
  for (const c of [...assigned.map((a) => a.chapter), ...courseChapters]) {
    if (chapterMap.has(c.id)) continue;
    chapterMap.set(c.id, { id: c.id, title: c.title, subjectId: c.subject.id, subject: c.subject.title, lectures: c._count.lectures, dpps: c._count.dpps, order: c.order ?? 0 });
  }
  const chapters = [...chapterMap.values()]
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.order - b.order || a.title.localeCompare(b.title))
    .map(({ order: _order, ...c }) => c);

  const tests = await prisma.test.findMany({
    where: {
      archived: false,
      status: { in: ["PUBLISHED", "APPROVED"] },
      OR: [
        { batchSchedule: { batchId, type: { not: "DPP" } } },
        ...(seriesLinks.length ? [{ testSeriesId: { in: seriesLinks.map((s) => s.testSeriesId) } }] : []),
      ],
    },
    orderBy: [{ openTime: "desc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      name: true,
      durationMin: true,
      openTime: true,
      closeTime: true,
      attempts: { where: { studentId }, select: { status: true } },
    },
  });

  const seen = new Set<string>();
  const notices: BatchNotice[] = [];
  for (const n of [
    ...broadcasts.map((b) => ({ id: `b_${b.id}`, title: b.title, body: b.body, createdAt: b.createdAt, deepLink: null as string | null })),
    ...notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt, deepLink: n.deepLink })),
  ]) {
    const key = `${n.title}|${n.body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    notices.push({ ...n, createdAt: n.createdAt.toISOString() });
  }
  notices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    batch: {
      id: batch.id,
      name: batch.name,
      code: batch.code,
      exam: batch.targetExam ?? null,
      thumbnailUrl: batch.thumbnailUrl ?? null,
      teachers: batch.teachers.map((t) => t.teacher.user.name).filter(Boolean),
    },
    classes: schedules.map((s) => ({
      id: s.id,
      title: s.title,
      subject: s.subject,
      teacherName: s.teacher?.user.name ?? null,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      status: s.status,
      type: s.type,
      liveWhiteboardSession: s.liveWhiteboardSession,
    })),
    chapters,
    tests: tests.map((t) => {
      const st = t.attempts[0]?.status;
      return {
        id: t.id,
        name: t.name,
        durationMin: t.durationMin,
        openTime: t.openTime?.toISOString() ?? null,
        closeTime: t.closeTime?.toISOString() ?? null,
        attemptStatus: !st ? "NOT_STARTED" : st === "IN_PROGRESS" ? "IN_PROGRESS" : "SUBMITTED",
      };
    }),
    folders: folders.filter(visible).map((f) => ({ id: f.id, parentId: f.parentId, name: f.name, files: f.files })),
    notices: notices.slice(0, 40),
  };
}
