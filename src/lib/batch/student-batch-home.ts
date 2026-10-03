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
  /** Whiteboard session whose class-notes PDF is ready (All PDF → Class Notes). */
  notesSessionId: string | null;
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
  /** Set for a chapter test (All Content → Subject → Chapter). */
  chapterId: string | null;
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
  /** The batch chapter it belongs to (null when only its chapter name is known). */
  chapterId: string | null;
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

/** A teacher's note on one of the batch's chapters. */
export type BatchAnnouncement = { id: string; title: string; body: string; createdAt: string; chapterId: string; chapterTitle: string; author: string | null };

/** A PDF file from the batch's materials (class notes, test syllabus …). */
export type BatchPdfFile = { id: string; title: string; sizeBytes: number; subject: string | null };

export type StudentBatchHomeData = {
  batch: { id: string; name: string; code: string; exam: string | null; thumbnailUrl: string | null; teachers: string[]; teacherCards: BatchTeacherCard[] };
  classes: BatchClassItem[];
  chapters: BatchChapterItem[];
  tests: BatchTestItem[];
  dpps: BatchDppItem[];
  folders: BatchFolderNode[];
  notices: BatchNotice[];
  announcements: BatchAnnouncement[];
  /** Files filed under the auto-made "Class Notes" / "Test Syllabus" folders (shown in All PDF, not in Notes & Module). */
  classNoteFiles: BatchPdfFile[];
  syllabusFiles: BatchPdfFile[];
};

/** Folders the app fills itself; their files are listed in All PDF instead of Notes & Module. */
export const AUTO_PDF_FOLDER = /^(class notes|test syllabus|test series)$/i;

/** "Isomerism (समावयवता)" → "isomerism" — chapter names typed in the DPP form vs. the chapter list. */
const looseName = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
    .trim();

export async function loadStudentBatchHome(batchId: string, studentId: string, _userId: string): Promise<StudentBatchHomeData | null> {
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
  const [schedules, assigned, courseChapters, seriesLinks, folders, broadcasts] = await Promise.all([
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
        liveWhiteboardSession: { select: { id: true, status: true, livePhase: true, pdfStatus: true } },
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
  // practice DPPs written for this batch's chapters (by chapter, or by
  // subject + chapter name for DPPs saved without a chapter link).
  const now = new Date();
  const batchSubjects = Array.from(new Set([...chapterMap.values()].map((c) => c.subject)));
  const chapterByName = new Map<string, BatchChapterItem & { order: number }>();
  for (const c of chapterMap.values()) chapterByName.set(`${c.subject.toLowerCase()}|${looseName(c.title)}`, c);
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
        chapter: { select: { id: true, title: true, subject: { select: { title: true } } } },
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
          where: {
            status: { in: ["PUBLISHED", "ACTIVE"] },
            OR: [
              { chapterId: { in: [...chapterMap.keys()] } },
              // DPPs made from the DPP page keep their chapter by name only (no chapterId).
              { chapterId: null, subject: { in: batchSubjects, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            subject: true,
            chapter: true,
            estimatedTimeMin: true,
            questionTargetCount: true,
            chapterId: true,
            _count: { select: { questions: true } },
            attempts: { where: { studentId }, orderBy: { startedAt: "desc" }, take: 1, select: { status: true, score: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  // Chapter DPPs are attempted through their backing test (code DPPT-<id>).
  const dppBacking = chapterDpps.length
    ? await prisma.test.findMany({
        where: { code: { in: chapterDpps.map((d) => `DPPT-${d.id}`) } },
        select: { id: true, code: true, attempts: { where: { studentId }, orderBy: { startedAt: "desc" }, take: 1, select: { status: true, score: true } } },
      })
    : [];
  const backingByDpp = new Map(dppBacking.map((t) => [String(t.code).slice(5), t]));
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
        chapterId: d.chapter?.id ?? null,
        questionCount,
        durationMin: t?.durationMin ?? 0,
        status,
        score: a?.score ?? null,
        opensAt: d.startsAt.toISOString(),
        href: status === "UPCOMING" || status === "LOCKED" || !t ? null : status === "COMPLETED" ? `/tests/${t.id}/result` : `/tests/${t.id}/attempt`,
        // DPP solutions open once the student has submitted it.
        pdfHref: status === "COMPLETED" && t && a?.status !== "IN_PROGRESS" ? `/api/tests/${t.id}/pdf` : null,
      };
    }),
    ...chapterDpps.map((d): BatchDppItem => {
      const ch =
        (d.chapterId ? chapterMap.get(d.chapterId) : undefined) ??
        chapterByName.get(`${d.subject.toLowerCase()}|${looseName(d.chapter)}`) ??
        null;
      const subjectTitle = ch?.subject ?? batchSubjects.find((t) => t.toLowerCase() === d.subject.toLowerCase()) ?? d.subject;
      const ready = d._count.questions > 0;
      const backing = backingByDpp.get(d.id);
      const a = backing?.attempts[0] ?? d.attempts[0];
      const status = !ready ? "LOCKED" : attemptStatus(a);
      return {
        id: d.id,
        title: d.name,
        subject: subjectTitle,
        chapter: ch?.title ?? (d.chapter || "Other DPPs"),
        chapterId: ch?.id ?? null,
        questionCount: d._count.questions || d.questionTargetCount,
        durationMin: d.estimatedTimeMin,
        status,
        score: a?.score ?? null,
        opensAt: null,
        href: !ready ? null : status === "COMPLETED" && backing ? `/tests/${backing.id}/result` : `/dpp/${d.id}/attempt`,
        // Question sheet + solutions once the student has submitted it.
        pdfHref: status === "COMPLETED" && backing ? `/api/tests/${backing.id}/pdf` : null,
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
        // Chapter tests of the batch's chapters.
        ...(chapterMap.size ? [{ chapterId: { in: [...chapterMap.keys()] } }] : []),
      ],
    },
    orderBy: [{ openTime: "desc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      name: true,
      code: true,
      chapterId: true,
      durationMin: true,
      openTime: true,
      closeTime: true,
      batchSchedule: { select: { startsAt: true, endsAt: true, type: true } },
      attempts: { where: { studentId }, select: { status: true } },
    },
  });

  // Notice: only what staff announced to this batch — automatic
  // notifications (class reminders, results …) stay in the app's bell.
  const seen = new Set<string>();
  const notices: BatchNotice[] = [];
  for (const n of broadcasts.map((b) => ({ id: `b_${b.id}`, title: b.title, body: b.body, createdAt: b.createdAt, deepLink: null as string | null }))) {
    const key = `${n.title}|${n.body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    notices.push({ ...n, createdAt: n.createdAt.toISOString() });
  }
  notices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const chapterNotices = chapterMap.size
    ? await prisma.chapterNotice.findMany({
        where: { chapterId: { in: [...chapterMap.keys()] } },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 60,
        select: { id: true, chapterId: true, title: true, content: true, authorName: true, createdAt: true },
      })
    : [];

  // Auto-made PDF folders (with everything under them) → All PDF.
  const visibleFolders = folders.filter(visible);
  const underAuto = (f: (typeof folders)[number], depth = 0): string | null => {
    if (AUTO_PDF_FOLDER.test(f.name.trim())) return f.name.trim().toLowerCase();
    const parent = f.parentId ? byId.get(f.parentId) : undefined;
    return parent && depth < 50 ? underAuto(parent, depth + 1) : null;
  };
  const classNoteFiles: BatchPdfFile[] = [];
  const syllabusFiles: BatchPdfFile[] = [];
  for (const f of visibleFolders) {
    const kind = underAuto(f);
    if (!kind) continue;
    const subject = AUTO_PDF_FOLDER.test(f.name.trim()) ? null : f.name;
    for (const file of f.files) {
      (kind === "class notes" ? classNoteFiles : syllabusFiles).push({ id: file.id, title: file.title, sizeBytes: file.sizeBytes, subject });
    }
  }

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
      notesSessionId: s.liveWhiteboardSession?.pdfStatus === "READY" ? s.liveWhiteboardSession.id : null,
    })),
    chapters,
    tests: tests.filter((t) => !String(t.code ?? "").startsWith("DPPT-")).map((t) => {
      const st = t.attempts[0]?.status;
      return {
        id: t.id,
        name: t.name,
        durationMin: t.durationMin,
        openTime: t.openTime?.toISOString() ?? null,
        closeTime: t.closeTime?.toISOString() ?? null,
        attemptStatus: !st ? "NOT_STARTED" : st === "IN_PROGRESS" ? "IN_PROGRESS" : "SUBMITTED",
        // Same rule as the export route: everyone gets the paper once the test time is over.
        pdfHref: st && st !== "IN_PROGRESS" && areResultsReleased(t) ? `/api/tests/${t.id}/pdf` : null,
        chapterId: t.chapterId ?? null,
      };
    }),
    dpps,
    folders: visibleFolders.filter((f) => !underAuto(f)).map((f) => ({ id: f.id, parentId: f.parentId, name: f.name, files: f.files })),
    notices: notices.slice(0, 40),
    announcements: chapterNotices.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.content,
      createdAt: n.createdAt.toISOString(),
      chapterId: n.chapterId,
      chapterTitle: chapterMap.get(n.chapterId)?.title ?? "Chapter",
      author: n.authorName ?? null,
    })),
    classNoteFiles,
    syllabusFiles,
  };
}
