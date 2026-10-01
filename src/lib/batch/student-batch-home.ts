import "server-only";
import { prisma } from "@/lib/db";
import { areResultsReleased } from "@/lib/tests/schedule-rules";

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
  /** For the Recorded folders: Subject → Chapter. */
  chapterId: string | null;
  chapterTitle: string | null;
  subjectName: string;
};

export type BatchChapterItem = { id: string; title: string; subjectId: string; subject: string; lectures: number; dpps: number };

export type BatchTestItem = {
  id: string;
  name: string;
  durationMin: number;
  openTime: string | null;
  closeTime: string | null;
  attemptStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  /** Paper + solutions PDF, once the export route will hand it out. */
  pdfHref: string | null;
};

export type BatchFolderNode = {
  id: string;
  parentId: string | null;
  name: string;
  files: { id: string; title: string; fileName: string; sizeBytes: number }[];
};

export type BatchDppItem = {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  questionCount: number;
  durationMin: number;
  /** UPCOMING = not open yet; LOCKED = published but no questions yet. */
  status: "UPCOMING" | "LOCKED" | "PENDING" | "IN_PROGRESS" | "COMPLETED";
  score: number | null;
  opensAt: string | null;
  /** Where Attempt / Result goes. */
  href: string | null;
  /** Questions + solutions PDF (submitted DPPs that are backed by a test). */
  pdfHref: string | null;
};

export type BatchTeacherCard = {
  id: string;
  name: string;
  photoUrl: string | null;
  subjects: string[];
  experienceYears: string | null;
  bio: string | null;
};

export type BatchNotice = { id: string; title: string; body: string; createdAt: string; deepLink: string | null };

export type StudentBatchHomeData = {
  batch: { id: string; name: string; code: string; exam: string | null; thumbnailUrl: string | null; teachers: string[]; teacherCards: BatchTeacherCard[] };
  classes: BatchClassItem[];
  chapters: BatchChapterItem[];
  tests: BatchTestItem[];
  dpps: BatchDppItem[];
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
      teachers: {
        select: {
          teacher: {
            select: {
              id: true,
              displayName: true,
              subjects: true,
              experienceYears: true,
              bio: true,
              user: { select: { name: true, photoUrl: true } },
            },
          },
        },
      },
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
        chapter: { select: { id: true, title: true, subject: { select: { title: true } } } },
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

  // DPPs: the batch's own DPP slots (each backed by a test) plus the
  // practice DPPs written for this batch's chapters.
  const now = new Date();
  const [dppSlots, chapterDpps] = await Promise.all([
    prisma.batchSchedule.findMany({
      where: { batchId, type: "DPP", status: { not: "CANCELLED" } },
      orderBy: { startsAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        subject: true,
        notes: true,
        startsAt: true,
        chapter: { select: { title: true, subject: { select: { title: true } } } },
        test: {
          select: {
            id: true,
            status: true,
            archived: true,
            durationMin: true,
            sections: { select: { targetCount: true, _count: { select: { questions: true } } } },
            attempts: { where: { studentId }, orderBy: { startedAt: "desc" }, take: 1, select: { status: true, score: true } },
          },
        },
      },
    }),
    chapterMap.size
      ? prisma.dpp.findMany({
          where: { chapterId: { in: [...chapterMap.keys()] }, status: { in: ["PUBLISHED", "ACTIVE"] } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            estimatedTimeMin: true,
            questionTargetCount: true,
            chapterId: true,
            _count: { select: { questions: true } },
            attempts: { where: { studentId }, orderBy: { startedAt: "desc" }, take: 1, select: { status: true, score: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const attemptStatus = (a: { status: string } | undefined) =>
    !a ? ("PENDING" as const) : a.status === "IN_PROGRESS" ? ("IN_PROGRESS" as const) : ("COMPLETED" as const);
  const dpps: BatchDppItem[] = [
    ...dppSlots.map((d): BatchDppItem => {
      const t = d.test;
      const questionCount = (t?.sections ?? []).reduce(
        (n, sec) => n + Math.min(sec.targetCount > 0 ? sec.targetCount : Infinity, sec._count.questions),
        0
      );
      const published = Boolean(t && t.status === "PUBLISHED" && !t.archived && questionCount > 0);
      const upcoming = d.startsAt > now;
      const a = t?.attempts[0];
      const status = upcoming ? "UPCOMING" : !published ? "LOCKED" : attemptStatus(a);
      return {
        id: d.id,
        title: d.title,
        subject: d.chapter?.subject.title ?? d.subject ?? "Practice",
        chapter: d.chapter?.title ?? d.notes ?? "Practice",
        questionCount,
        durationMin: t?.durationMin ?? 0,
        status,
        score: a?.score ?? null,
        opensAt: d.startsAt.toISOString(),
        href: status === "UPCOMING" || status === "LOCKED" || !t ? null : status === "COMPLETED" ? `/tests/${t.id}/result` : `/tests/${t.id}/attempt`,
        // DPP solutions open once the student has submitted it.
        pdfHref: status === "COMPLETED" && t && a?.status !== "IN_PROGRESS" ? `/api/tests/${t.id}/export?type=with-solution` : null,
      };
    }),
    ...chapterDpps.map((d): BatchDppItem => {
      const ch = chapterMap.get(d.chapterId!)!;
      const ready = d._count.questions > 0;
      const status = !ready ? "LOCKED" : attemptStatus(d.attempts[0]);
      return {
        id: d.id,
        title: d.name,
        subject: ch.subject,
        chapter: ch.title,
        questionCount: d._count.questions || d.questionTargetCount,
        durationMin: d.estimatedTimeMin,
        status,
        score: d.attempts[0]?.score ?? null,
        opensAt: null,
        href: ready ? `/practice?dppId=${d.id}` : null,
        pdfHref: null,
      };
    }),
  ];

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
      batchSchedule: { select: { startsAt: true, endsAt: true, type: true } },
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
      teacherCards: batch.teachers.map(({ teacher: t }) => ({
        id: t.id,
        name: t.displayName || t.user.name,
        photoUrl: t.user.photoUrl ?? null,
        subjects: t.subjects,
        experienceYears: t.experienceYears ?? null,
        bio: t.bio ?? null,
      })),
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
      chapterId: s.chapter?.id ?? null,
      chapterTitle: s.chapter?.title ?? null,
      subjectName: s.chapter?.subject.title ?? s.subject ?? "Other classes",
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
        // Same rule as the export route: everyone gets the paper once the test time is over.
        pdfHref: st && st !== "IN_PROGRESS" && areResultsReleased(t) ? `/api/tests/${t.id}/export?type=with-solution` : null,
      };
    }),
    dpps,
    folders: folders.filter(visible).map((f) => ({ id: f.id, parentId: f.parentId, name: f.name, files: f.files })),
    notices: notices.slice(0, 40),
  };
}
