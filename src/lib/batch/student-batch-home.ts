import "server-only";
import { prisma } from "@/lib/db";
import { canStudentJoinClass, getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";

const IST = "Asia/Kolkata";
const dayKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const timeFmt = (d: string | Date) =>
  new Date(d).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });

export type AcademicEventType = "LIVE_CLASS" | "TEST" | "DPP" | "OTHER";

export type AcademicEventStatus =
  | "LIVE_NOW"
  | "UPCOMING"
  | "COMPLETED"
  | "AVAILABLE"
  | "ATTEMPTED"
  | "SUBMITTED"
  | "CANCELLED";

export type AcademicEvent = {
  id: string;
  type: AcademicEventType;
  title: string;
  subject: string;
  chapter: string | null;
  teacherName: string | null;
  dateKey: string; // YYYY-MM-DD
  startsAt: string;
  endsAt: string | null;
  status: AcademicEventStatus;
  actionLabel: string;
  actionHref: string | null;
  score: number | null;
  durationMin: number | null;
  questionCount: number | null;
  pdfUrl: string | null;
};

export type BatchClassItem = {
  id: string;
  title: string;
  subject: string | null;
  teacherName: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  type: string;
  liveWhiteboardSession: { id?: string; status?: string; livePhase?: string; youtubeVideoId?: string | null } | null;
  chapterId: string | null;
  chapterTitle: string | null;
  subjectName: string;
  notesPdfUrl?: string | null;
};

export type BatchChapterItem = {
  id: string;
  title: string;
  subjectId: string;
  subject: string;
  lectures: number;
  dpps: number;
  tests: number;
};

export type BatchTestItem = {
  id: string;
  name: string;
  subject: string;
  chapter: string | null;
  durationMin: number;
  totalMarks: number;
  openTime: string | null;
  closeTime: string | null;
  attemptStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  score: number | null;
  maxScore: number | null;
  accuracy: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  questionPdfUrl: string | null;
  solutionPdfUrl: string | null;
};

export type BatchDppItem = {
  id: string;
  code: string;
  title: string;
  subject: string;
  chapter: string;
  chapterId: string | null;
  questionCount: number;
  durationMin: number;
  status: "AVAILABLE" | "UPCOMING" | "LOCKED" | "IN_PROGRESS" | "COMPLETED";
  score: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  accuracy: number | null;
  opensAt: string | null;
  pdfUrl: string | null;
  href: string | null;
};

export type BatchPdfCategory = "CLASS_NOTES" | "DPP" | "TESTS" | "MODULES" | "SYLLABUS";

export type BatchPdfItem = {
  id: string;
  title: string;
  category: BatchPdfCategory;
  subject: string;
  chapter: string | null;
  fileUrl: string;
  fileName: string;
  sizeBytes: number;
  allowDownload: boolean;
  createdAt: string;
  sourceType: "CLASS_ATTACHMENT" | "DPP_PDF" | "TEST_PDF" | "MODULE" | "BATCH_FILE";
};

export type BatchModuleItem = {
  id: string;
  code: string;
  title: string;
  subject: string;
  chapter: string | null;
  facultyName: string | null;
  pageCount: number;
  fileUrl: string;
  fileName: string;
  allowDownload: boolean;
  createdAt: string;
};

export type BatchTeacherCard = {
  id: string;
  name: string;
  photoUrl: string | null;
  subjects: string[];
  experienceYears: string | null;
  bio: string | null;
};

export type BatchDoubtSlotItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherPhotoUrl: string | null;
  subject: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  isBooked: boolean;
};

export type StudentDoubtBookingItem = {
  id: string;
  teacherName: string;
  topic: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  meetingUrl: string | null;
};

export type BatchFolderNode = {
  id: string;
  parentId: string | null;
  name: string;
  files: { id: string; title: string; fileName: string; sizeBytes: number; allowDownload?: boolean }[];
};

export type BatchNotice = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  deepLink: string | null;
};

export type StudentBatchHomeData = {
  batch: {
    id: string;
    name: string;
    code: string;
    exam: string | null;
    thumbnailUrl: string | null;
    teachers: string[];
    teacherCards: BatchTeacherCard[];
  };
  timelineEvents: AcademicEvent[];
  classes: BatchClassItem[];
  chapters: BatchChapterItem[];
  tests: BatchTestItem[];
  dpps: BatchDppItem[];
  allPdfs: BatchPdfItem[];
  modules: BatchModuleItem[];
  doubtSlots: BatchDoubtSlotItem[];
  studentBookings: StudentDoubtBookingItem[];
  folders: BatchFolderNode[];
  notices: BatchNotice[];
};

export async function loadStudentBatchHome(
  batchId: string,
  studentId: string,
  userId: string
): Promise<StudentBatchHomeData | null> {
  const now = new Date();

  // 1. Fetch Batch with Course, Teachers, TestSeries, and Schedules
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      name: true,
      code: true,
      targetExam: true,
      thumbnailUrl: true,
      courseId: true,
      testSeries: { select: { testSeriesId: true } },
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

  const teacherIds = batch.teachers.map((t) => t.teacher.id);
  const testSeriesIds = (batch.testSeries || []).map((ts) => ts.testSeriesId);

  // 2. Fetch Assigned Chapters, Course Chapters, & Batch Schedules in parallel
  const [assignedChapters, courseChapters, schedules, dppSchedules] = await Promise.all([
    prisma.batchChapter.findMany({
      where: { batchId },
      select: {
        chapter: {
          select: {
            id: true,
            title: true,
            order: true,
            status: true,
            subject: { select: { id: true, title: true } },
            _count: { select: { lectures: true, dpps: true, tests: true } },
          },
        },
      },
    }),
    batch.courseId
      ? prisma.chapter.findMany({
          where: { subject: { courseId: batch.courseId } },
          select: {
            id: true,
            title: true,
            order: true,
            status: true,
            subject: { select: { id: true, title: true } },
            _count: { select: { lectures: true, dpps: true, tests: true } },
          },
        })
      : Promise.resolve([]),
    prisma.batchSchedule.findMany({
      where: { batchId, type: "LIVE_CLASS" },
      orderBy: { startsAt: "desc" },
      include: {
        teacher: { select: { user: { select: { name: true } } } },
        liveWhiteboardSession: { select: { id: true, status: true, livePhase: true, youtubeVideoId: true } },
        chapter: { select: { id: true, title: true, subject: { select: { title: true } } } },
      },
    }),
    prisma.batchSchedule.findMany({
      where: { batchId, type: "DPP", status: { not: "CANCELLED" } },
      orderBy: { startsAt: "desc" },
      take: 100,
      include: {
        chapter: { select: { title: true, subject: { select: { title: true } } } },
        test: {
          include: {
            sections: { select: { targetCount: true, _count: { select: { questions: true } } } },
            attempts: {
              where: { studentId },
              orderBy: { startedAt: "desc" },
              take: 1,
              select: { status: true, score: true },
            },
          },
        },
      },
    }),
  ]);

  const chapterMap = new Map<string, BatchChapterItem & { order: number }>();
  for (const c of [...assignedChapters.map((a) => a.chapter), ...courseChapters]) {
    if (!c || chapterMap.has(c.id)) continue;
    chapterMap.set(c.id, {
      id: c.id,
      title: c.title,
      subjectId: c.subject.id,
      subject: c.subject.title,
      lectures: c._count.lectures,
      dpps: c._count.dpps,
      tests: c._count.tests,
      order: c.order ?? 0,
    });
  }

  const rawChapterIds = new Set<string>(chapterMap.keys());
  const rawChapterTitles = new Set<string>(Array.from(chapterMap.values()).map((c) => c.title));
  const rawSubjectTitles = new Set<string>(Array.from(chapterMap.values()).map((c) => c.subject));

  // Extract chapter titles, topics, and subjects from schedules as well
  for (const s of schedules) {
    if (s.chapterId) rawChapterIds.add(s.chapterId);
    if (s.subject) rawSubjectTitles.add(s.subject);
    if (s.topic) rawChapterTitles.add(s.topic);
    if (s.chapter?.title) rawChapterTitles.add(s.chapter.title);
    if (s.chapter?.subject?.title) rawSubjectTitles.add(s.chapter.subject.title);
    if (s.title.includes("—")) {
      const parsed = s.title.split("—")[0]?.trim();
      if (parsed) rawChapterTitles.add(parsed);
    }
  }

  for (const ds of dppSchedules) {
    if (ds.chapterId) rawChapterIds.add(ds.chapterId);
    if (ds.subject) rawSubjectTitles.add(ds.subject);
    if (ds.chapter?.title) rawChapterTitles.add(ds.chapter.title);
    if (ds.chapter?.subject?.title) rawSubjectTitles.add(ds.chapter.subject.title);
  }

  // Find any chapters in DB matching these titles to ensure all chapter IDs are resolved
  const matchedDbChapters = await prisma.chapter.findMany({
    where: {
      OR: [
        ...(rawChapterIds.size ? [{ id: { in: Array.from(rawChapterIds) } }] : []),
        ...(rawChapterTitles.size ? [{ title: { in: Array.from(rawChapterTitles) } }] : []),
      ],
    },
    select: { id: true, title: true, subject: { select: { id: true, title: true } }, _count: { select: { lectures: true, dpps: true, tests: true } } },
  });

  for (const c of matchedDbChapters) {
    rawChapterIds.add(c.id);
    rawChapterTitles.add(c.title);
    if (c.subject?.title) rawSubjectTitles.add(c.subject.title);
    if (!chapterMap.has(c.id)) {
      chapterMap.set(c.id, {
        id: c.id,
        title: c.title,
        subjectId: c.subject.id,
        subject: c.subject.title,
        lectures: c._count.lectures,
        dpps: c._count.dpps,
        tests: c._count.tests,
        order: 0,
      });
    }
  }

  const chapters = [...chapterMap.values()]
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.order - b.order || a.title.localeCompare(b.title))
    .map(({ order: _order, ...c }) => c);

  const chapterIds: string[] = Array.from(rawChapterIds);
  const chapterTitles: string[] = Array.from(rawChapterTitles);
  const subjectTitles: string[] = Array.from(rawSubjectTitles);

  // 3. Parallel Queries for DPPs, Tests, Folders, Modules, Doubts & Notifications
  const [
    chapterDpps,
    rawTests,
    folders,
    modules,
    doubtSlots,
    studentBookings,
    notifications,
    broadcasts,
  ] = await Promise.all([
    // Direct Chapter DPPs (Multi-relationship matching)
    prisma.dpp.findMany({
      where: {
        OR: [
          ...(chapterIds.length ? [{ chapterId: { in: chapterIds } }] : []),
          ...(chapterTitles.length ? [{ chapter: { in: chapterTitles } }] : []),
          ...(subjectTitles.length ? [{ subject: { in: subjectTitles } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        _count: { select: { questions: true } },
        attempts: {
          where: { studentId },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { status: true, score: true, startedAt: true, submittedAt: true },
        },
      },
    }),

    // Batch Tests (Assigned via test series, batch schedule, or chapters)
    prisma.test.findMany({
      where: {
        archived: false,
        OR: [
          { batchSchedule: { batchId } },
          ...(testSeriesIds.length ? [{ testSeriesId: { in: testSeriesIds } }] : []),
          ...(chapterIds.length ? [{ chapterId: { in: chapterIds } }] : []),
          ...(chapterTitles.length ? [{ chapter: { title: { in: chapterTitles } } }] : []),
          ...(batch.courseId ? [{ chapter: { subject: { courseId: batch.courseId } } }] : []),
        ],
      },
      orderBy: [{ openTime: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        chapter: { select: { title: true, subject: { select: { title: true } } } },
        sections: { select: { marksPerQuestion: true, targetCount: true, _count: { select: { questions: true } } } },
        attempts: {
          where: { studentId },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { status: true, score: true, submittedAt: true },
        },
      },
    }),

    // Batch Folders & Files
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

    // Modules & Notes assigned to this batch or subject/chapter
    prisma.module.findMany({
      where: {
        status: { in: ["READY", "PUBLISHED", "DRAFT"] },
        OR: [
          { batch: { in: [batch.id, batch.code, batch.name] } },
          ...(subjectTitles.length ? [{ subject: { in: subjectTitles } }] : []),
          ...(chapterTitles.length ? [{ chapter: { in: chapterTitles } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        exportHistory: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, fileUrl: true, fileName: true, fileSize: true },
        },
      },
    }),

    // Available Faculty Doubt Slots
    teacherIds.length
      ? prisma.doubtSlot.findMany({
          where: {
            teacherId: { in: teacherIds },
            status: "OPEN",
            startTime: { gte: now },
          },
          orderBy: { startTime: "asc" },
          take: 20,
          include: {
            teacher: {
              select: {
                displayName: true,
                subjects: true,
                user: { select: { name: true, photoUrl: true } },
              },
            },
          },
        })
      : Promise.resolve([]),

    // Student's Doubt Bookings
    prisma.doubtBooking.findMany({
      where: {
        studentId,
        status: "CONFIRMED",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        slot: { select: { startTime: true, endTime: true } },
        teacher: { select: { displayName: true, user: { select: { name: true } } } },
      },
    }),

    // In-app Notifications
    prisma.notification.findMany({
      where: { userId, batchId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, body: true, createdAt: true, deepLink: true },
    }),

    // Batch Broadcasts
    prisma.notificationBroadcast.findMany({
      where: { segmentType: "BATCH", segmentValue: batchId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, body: true, createdAt: true },
    }),
  ]);

  // 4. Transform DPPs
  const dppItems: BatchDppItem[] = [];
  const seenDppIds = new Set<string>();

  for (const d of chapterDpps) {
    if (seenDppIds.has(d.id)) continue;
    seenDppIds.add(d.id);

    const att = d.attempts[0];
    const qCount = d._count.questions || d.questionTargetCount || 10;
    const status = (att?.status === "SUBMITTED" || att?.status === "AUTO_SUBMITTED")
      ? "COMPLETED"
      : att?.status === "IN_PROGRESS"
      ? "IN_PROGRESS"
      : "AVAILABLE";

    dppItems.push({
      id: d.id,
      code: d.code,
      title: d.name,
      subject: d.subject || "Practice",
      chapter: d.chapter || "Chapter Practice",
      chapterId: d.chapterId,
      questionCount: qCount,
      durationMin: d.estimatedTimeMin || 30,
      status,
      score: att?.score ?? null,
      correctCount: null,
      incorrectCount: null,
      accuracy: null,
      opensAt: null,
      pdfUrl: `/api/team/dpp/${d.id}/pdf`,
      href: status === "COMPLETED" ? `/practice?dppId=${d.id}&result=1` : `/practice?dppId=${d.id}`,
    });
  }

  for (const d of dppSchedules) {
    if (seenDppIds.has(d.id)) continue;
    seenDppIds.add(d.id);

    const t = d.test;
    const qCount = (t?.sections ?? []).reduce(
      (n, sec) => n + Math.min(sec.targetCount > 0 ? sec.targetCount : Infinity, sec._count.questions),
      0
    );
    const a = t?.attempts[0];
    const isUpcoming = d.startsAt > now;
    const status = isUpcoming
      ? "UPCOMING"
      : a?.status === "SUBMITTED"
      ? "COMPLETED"
      : a?.status === "IN_PROGRESS"
      ? "IN_PROGRESS"
      : "AVAILABLE";

    dppItems.push({
      id: d.id,
      code: `DPP-${d.id.slice(-6).toUpperCase()}`,
      title: d.title,
      subject: d.chapter?.subject.title ?? d.subject ?? "Practice",
      chapter: d.chapter?.title ?? d.notes ?? "Practice",
      chapterId: null,
      questionCount: qCount,
      durationMin: t?.durationMin ?? 30,
      status,
      score: a?.score ?? null,
      correctCount: null,
      incorrectCount: null,
      accuracy: null,
      opensAt: d.startsAt.toISOString(),
      pdfUrl: null,
      href: status === "UPCOMING" || !t ? null : status === "COMPLETED" ? `/tests/${t.id}/result` : `/tests/${t.id}/attempt`,
    });
  }

  // 5. Transform Tests
  const testItems: BatchTestItem[] = rawTests.map((t) => {
    const a = t.attempts[0];
    const totalMarks = t.sections.reduce((acc, s) => acc + (s.targetCount || s._count.questions || 1) * (s.marksPerQuestion || 4), 0);
    const attemptStatus = !a ? "NOT_STARTED" : a.status === "IN_PROGRESS" ? "IN_PROGRESS" : "SUBMITTED";

    return {
      id: t.id,
      name: t.name,
      subject: t.chapter?.subject.title ?? "Comprehensive Test",
      chapter: t.chapter?.title ?? null,
      durationMin: t.durationMin,
      totalMarks: totalMarks || 720,
      openTime: t.openTime?.toISOString() ?? null,
      closeTime: t.closeTime?.toISOString() ?? null,
      attemptStatus,
      score: a?.score ?? null,
      maxScore: totalMarks || 720,
      accuracy: null,
      correctCount: null,
      incorrectCount: null,
      questionPdfUrl: `/api/team/tests/${t.id}/pdf`,
      solutionPdfUrl: attemptStatus === "SUBMITTED" ? `/api/team/tests/${t.id}/solution-pdf` : null,
    };
  });

  // 6. Transform Classes
  const classItems: BatchClassItem[] = schedules.map((s) => ({
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
    subjectName: s.chapter?.subject.title ?? s.subject ?? "General",
    notesPdfUrl: null,
  }));

  // 7. Build Unified Academic Events for Batch Timeline (Today & Upcoming)
  const timelineEvents: AcademicEvent[] = [];

  // Live classes -> timeline events
  for (const c of classItems) {
    const effectiveStatus = getEffectiveScheduleStatus(c, now);
    const joinRule = canStudentJoinClass(c, now);
    const isLive = effectiveStatus === "LIVE";
    const isCompleted = effectiveStatus === "COMPLETED";
    const isCancelled = effectiveStatus === "CANCELLED";

    timelineEvents.push({
      id: `class_${c.id}`,
      type: "LIVE_CLASS",
      title: c.title,
      subject: c.subjectName,
      chapter: c.chapterTitle,
      teacherName: c.teacherName,
      dateKey: dayKey(c.startsAt),
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      status: isLive ? "LIVE_NOW" : isCompleted ? "COMPLETED" : isCancelled ? "CANCELLED" : "UPCOMING",
      actionLabel: isLive ? "Join Live" : isCompleted ? "Watch Recording" : joinRule.allowed ? "Enter Class" : timeFmt(c.startsAt),
      actionHref: isCompleted ? `/watch/${c.id}` : `/live-class/${c.id}`,
      score: null,
      durationMin: Math.round((new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime()) / 60000) || 60,
      questionCount: null,
      pdfUrl: null,
    });
  }

  // Tests -> timeline events
  for (const t of testItems) {
    const isSubmitted = t.attemptStatus === "SUBMITTED";
    const isInProgress = t.attemptStatus === "IN_PROGRESS";
    const testDate = t.openTime || new Date().toISOString();

    timelineEvents.push({
      id: `test_${t.id}`,
      type: "TEST",
      title: t.name,
      subject: t.subject,
      chapter: t.chapter,
      teacherName: "Examination Cell",
      dateKey: dayKey(testDate),
      startsAt: testDate,
      endsAt: t.closeTime,
      status: isSubmitted ? "SUBMITTED" : isInProgress ? "AVAILABLE" : "AVAILABLE",
      actionLabel: isSubmitted ? "View Result" : isInProgress ? "Resume Test" : "Start Test",
      actionHref: isSubmitted ? `/tests/${t.id}/result` : `/tests/${t.id}/attempt`,
      score: t.score,
      durationMin: t.durationMin,
      questionCount: null,
      pdfUrl: t.questionPdfUrl,
    });
  }

  // DPPs -> timeline events
  for (const d of dppItems) {
    const dppDate = d.opensAt || new Date().toISOString();
    const isCompleted = d.status === "COMPLETED";
    const isInProgress = d.status === "IN_PROGRESS";

    timelineEvents.push({
      id: `dpp_${d.id}`,
      type: "DPP",
      title: d.title,
      subject: d.subject,
      chapter: d.chapter,
      teacherName: null,
      dateKey: dayKey(dppDate),
      startsAt: dppDate,
      endsAt: null,
      status: isCompleted ? "SUBMITTED" : isInProgress ? "AVAILABLE" : "AVAILABLE",
      actionLabel: isCompleted ? "View Result" : isInProgress ? "Resume DPP" : "Attempt DPP",
      actionHref: d.href,
      score: d.score,
      durationMin: d.durationMin,
      questionCount: d.questionCount,
      pdfUrl: d.pdfUrl,
    });
  }

  // Sort timeline chronologically descending (newest on top, older below)
  timelineEvents.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  // 8. Build Centralized "All PDFs" Library
  const allPdfs: BatchPdfItem[] = [];

  // 8.1 DPP PDFs
  for (const d of dppItems) {
    allPdfs.push({
      id: `pdf_dpp_${d.id}`,
      title: `${d.title} (Practice Sheet)`,
      category: "DPP",
      subject: d.subject,
      chapter: d.chapter,
      fileUrl: d.pdfUrl || `/api/team/dpp/${d.id}/pdf`,
      fileName: `${d.code || "DPP"}.pdf`,
      sizeBytes: 150000,
      allowDownload: true,
      createdAt: d.opensAt || new Date().toISOString(),
      sourceType: "DPP_PDF",
    });
  }

  // 8.2 Test PDFs
  for (const t of testItems) {
    allPdfs.push({
      id: `pdf_test_${t.id}`,
      title: `${t.name} (Question Paper)`,
      category: "TESTS",
      subject: t.subject,
      chapter: t.chapter,
      fileUrl: t.questionPdfUrl || `/api/team/tests/${t.id}/pdf`,
      fileName: `${t.name}.pdf`,
      sizeBytes: 250000,
      allowDownload: true,
      createdAt: t.openTime || new Date().toISOString(),
      sourceType: "TEST_PDF",
    });

    if (t.solutionPdfUrl) {
      allPdfs.push({
        id: `pdf_test_sol_${t.id}`,
        title: `${t.name} (Solutions & Key)`,
        category: "TESTS",
        subject: t.subject,
        chapter: t.chapter,
        fileUrl: t.solutionPdfUrl,
        fileName: `${t.name}-Solutions.pdf`,
        sizeBytes: 350000,
        allowDownload: true,
        createdAt: t.openTime || new Date().toISOString(),
        sourceType: "TEST_PDF",
      });
    }
  }

  // 8.3 Modules & Notes
  const moduleItems: BatchModuleItem[] = modules.map((m) => {
    const exportFile = m.exportHistory[0];
    const fileUrl = exportFile?.fileUrl || m.originalFileUrl;
    const fileName = exportFile?.fileName || m.originalFileName || `${m.code}.pdf`;

    allPdfs.push({
      id: `pdf_mod_${m.id}`,
      title: `${m.title} (Module)`,
      category: "MODULES",
      subject: m.subject || "All Subjects",
      chapter: m.chapter || null,
      fileUrl,
      fileName,
      sizeBytes: exportFile?.fileSize || m.originalFileSize || 1000000,
      allowDownload: true,
      createdAt: m.createdAt.toISOString(),
      sourceType: "MODULE",
    });

    return {
      id: m.id,
      code: m.code,
      title: m.title,
      subject: m.subject || "General",
      chapter: m.chapter || null,
      facultyName: m.facultyName || null,
      pageCount: m.pageCount || 1,
      fileUrl,
      fileName,
      allowDownload: true,
      createdAt: m.createdAt.toISOString(),
    };
  });

  // 8.4 Batch Folder Files (Syllabus, Brochure, Class Notes)
  for (const f of folders) {
    const isSyllabus = /syllabus|schedule|brochure|planner/i.test(f.name);
    for (const file of f.files) {
      allPdfs.push({
        id: `pdf_file_${file.id}`,
        title: file.title || file.fileName,
        category: isSyllabus ? "SYLLABUS" : "CLASS_NOTES",
        subject: f.name,
        chapter: null,
        fileUrl: `/api/batch-materials/${file.id}?inline=1`,
        fileName: file.fileName,
        sizeBytes: file.sizeBytes,
        allowDownload: true,
        createdAt: new Date().toISOString(),
        sourceType: "BATCH_FILE",
      });
    }
  }

  // 9. Transform Doubt Slots & Bookings
  const doubtSlotItems: BatchDoubtSlotItem[] = doubtSlots.map((s) => ({
    id: s.id,
    teacherId: s.teacherId,
    teacherName: s.teacher.displayName || s.teacher.user.name,
    teacherPhotoUrl: s.teacher.user.photoUrl ?? null,
    subject: s.teacher.subjects[0] || "Academic Doubt",
    startsAt: s.startTime.toISOString(),
    endsAt: s.endTime.toISOString(),
    durationMinutes: Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000) || 15,
    isBooked: s.status === "BOOKED",
  }));

  const studentBookingItems: StudentDoubtBookingItem[] = studentBookings.map((b) => ({
    id: b.id,
    teacherName: b.teacher.displayName || b.teacher.user.name,
    topic: b.topic || "1-to-1 Academic Doubt Session",
    startsAt: b.slot.startTime.toISOString(),
    endsAt: b.slot.endTime.toISOString(),
    status: b.status,
    meetingUrl: `/api/doubt-booking/bookings/${b.id}/join`,
  }));

  // 10. Transform Notices
  const seenNotices = new Set<string>();
  const notices: BatchNotice[] = [];
  for (const n of [
    ...broadcasts.map((b) => ({ id: `b_${b.id}`, title: b.title, body: b.body, createdAt: b.createdAt, deepLink: null as string | null })),
    ...notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt, deepLink: n.deepLink })),
  ]) {
    const key = `${n.title}|${n.body}`;
    if (seenNotices.has(key)) continue;
    seenNotices.add(key);
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
    timelineEvents,
    classes: classItems,
    chapters,
    tests: testItems,
    dpps: dppItems,
    allPdfs,
    modules: moduleItems,
    doubtSlots: doubtSlotItems,
    studentBookings: studentBookingItems,
    folders: folders.map((f) => ({ id: f.id, parentId: f.parentId, name: f.name, files: f.files })),
    notices: notices.slice(0, 40),
  };
}
