import "server-only";
import { prisma } from "@/lib/db";
import { canStudentJoinClass, getEffectiveScheduleStatus } from "@/lib/schedule/access-rules";
import { areResultsReleased } from "@/lib/tests/schedule-rules";

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
  teacherPhotoUrl: string | null;
  dateKey: string; // YYYY-MM-DD
  startsAt: string;
  endsAt: string | null;
  status: AcademicEventStatus;
  actionLabel: string;
  actionHref: string | null;
  score: number | null;
  maxScore?: number | null;
  durationMin: number | null;
  questionCount: number | null;
  pdfUrl: string | null;
  notesPdfUrl: string | null;
};

export type BatchClassItem = {
  id: string;
  title: string;
  subject: string | null;
  teacherName: string | null;
  teacherPhotoUrl: string | null;
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

export type BatchLectureItem = {
  id: string;
  title: string;
  duration: number;
  videoUrl?: string | null;
  slidesUrl?: string | null;
  order: number;
};

export type BatchChapterItem = {
  id: string;
  title: string;
  subjectId: string;
  subject: string;
  lectures: number;
  dpps: number;
  tests: number;
  lectureList?: BatchLectureItem[];
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
  isUpcoming: boolean;
  attemptStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  score: number | null;
  maxScore: number | null;
  accuracy: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  unattemptedCount: number | null;
  questionPdfUrl: string | null;
  solutionPdfUrl: string | null;
  actionLabel: string;
  actionHref: string | null;
  submittedAt?: string | null;
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
  isAttempted: boolean;
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  unattemptedCount: number | null;
  accuracy: number | null;
  timeTakenSec: number | null;
  opensAt: string | null;
  submittedAt: string | null;
  pdfUrl: string | null;
  href: string | null;
  actionLabel: string;
};

export type BatchPdfCategory = "ALL" | "CLASS_NOTES" | "DPP" | "TESTS" | "MODULES" | "SYLLABUS" | "PLANNER";

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
  department?: string | null;
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
  status: "OPEN" | "BOOKED" | "COMPLETED";
  isBooked: boolean;
};

export type StudentDoubtBookingItem = {
  id: string;
  teacherName: string;
  topic: string | null;
  startsAt: string;
  endsAt: string;
  status: string; // "CONFIRMED" | "COMPLETED" | "CANCELLED"
  meetingUrl: string | null;
  createdAt: string;
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
    description: string | null;
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
      description: true,
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
              department: true,
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
      include: {
        chapter: {
          include: {
            subject: { select: { id: true, title: true } },
            lectures: {
              where: { status: "PUBLISHED" },
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                durationMin: true,
                videoUrl: true,
                slidesUrl: true,
                order: true,
              },
            },
            _count: { select: { lectures: true, dpps: true, tests: true } },
          },
        },
      },
    }),
    batch.courseId
      ? prisma.chapter.findMany({
          where: { subject: { courseId: batch.courseId } },
          include: {
            subject: { select: { id: true, title: true } },
            lectures: {
              where: { status: "PUBLISHED" },
              orderBy: { order: "asc" },
              select: {
                id: true,
                title: true,
                durationMin: true,
                videoUrl: true,
                slidesUrl: true,
                order: true,
              },
            },
            _count: { select: { lectures: true, dpps: true, tests: true } },
          },
        })
      : Promise.resolve([]),
    prisma.batchSchedule.findMany({
      where: { batchId, type: "LIVE_CLASS" },
      orderBy: { startsAt: "desc" },
      include: {
        teacher: {
          select: {
            displayName: true,
            user: { select: { name: true, photoUrl: true } },
          },
        },
        liveWhiteboardSession: {
          select: {
            id: true,
            status: true,
            livePhase: true,
            youtubeVideoId: true,
            presentationUrl: true,
            pdfStatus: true,
          },
        },
        chapter: { select: { id: true, title: true, subject: { select: { title: true } } } },
        lecture: { select: { id: true, slidesUrl: true } },
      },
    }),
    prisma.batchSchedule.findMany({
      where: {
        batchId,
        type: "DPP",
        status: { not: "CANCELLED" },
        test: {
          status: { in: ["PUBLISHED", "APPROVED"] },
          sections: { some: { questions: { some: {} } } },
        },
      },
      orderBy: { startsAt: "desc" },
      take: 100,
      include: {
        chapter: { select: { id: true, title: true, subject: { select: { title: true } } } },
        test: {
          include: {
            sections: { select: { targetCount: true, _count: { select: { questions: true } } } },
            attempts: {
              where: { studentId },
              orderBy: { startedAt: "desc" },
              take: 1,
              select: {
                status: true,
                score: true,
                submittedAt: true,
                answers: { select: { isCorrect: true, timeTakenSec: true } },
              },
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
      lectureList: (c.lectures || []).map((l) => ({
        id: l.id,
        title: l.title,
        duration: l.durationMin || 45,
        videoUrl: l.videoUrl,
        slidesUrl: l.slidesUrl,
        order: l.order,
      })),
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
    include: {
      subject: { select: { id: true, title: true } },
      lectures: {
        where: { status: "PUBLISHED" },
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          durationMin: true,
          videoUrl: true,
          slidesUrl: true,
          order: true,
        },
      },
      _count: { select: { lectures: true, dpps: true, tests: true } },
    },
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
        lectureList: (c.lectures || []).map((l) => ({
          id: l.id,
          title: l.title,
          duration: l.durationMin || 45,
          videoUrl: l.videoUrl,
          slidesUrl: l.slidesUrl,
          order: l.order,
        })),
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
    // Direct Chapter DPPs (Only published with actual questions)
    prisma.dpp.findMany({
      where: {
        status: { in: ["PUBLISHED", "ACTIVE"] },
        questions: { some: {} },
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
          select: {
            id: true,
            status: true,
            score: true,
            startedAt: true,
            submittedAt: true,
            answers: {
              select: {
                isCorrect: true,
                timeTakenSec: true,
              },
            },
          },
        },
      },
    }),

    // Batch Tests (Assigned via test series, batch schedule, or chapters)
    prisma.test.findMany({
      where: {
        archived: false,
        status: { in: ["PUBLISHED", "APPROVED"] },
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
        batchSchedule: { select: { startsAt: true, endsAt: true, type: true } },
        chapter: { select: { title: true, subject: { select: { title: true } } } },
        sections: { select: { marksPerQuestion: true, targetCount: true, _count: { select: { questions: true } } } },
        attempts: {
          where: { studentId },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            score: true,
            submittedAt: true,
            answers: {
              select: {
                isCorrect: true,
                timeTakenSec: true,
              },
            },
          },
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
          take: 30,
          include: {
            teacher: {
              select: {
                id: true,
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
      },
      orderBy: { createdAt: "desc" },
      take: 20,
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

  // 4. Transform DPPs with Attempt Data Preservation
  const dppItems: BatchDppItem[] = [];
  const seenDppIds = new Set<string>();

  for (const d of chapterDpps) {
    if (seenDppIds.has(d.id)) continue;
    seenDppIds.add(d.id);

    const att = d.attempts[0];
    const qCount = d._count.questions || d.questionTargetCount || 10;
    const isSubmitted = att?.status === "SUBMITTED" || att?.status === "AUTO_SUBMITTED";
    const status = isSubmitted
      ? "COMPLETED"
      : att?.status === "IN_PROGRESS"
      ? "IN_PROGRESS"
      : "AVAILABLE";

    const answers = att?.answers || [];
    const correctCount = isSubmitted ? answers.filter((a) => a.isCorrect === true).length : null;
    const incorrectCount = isSubmitted ? answers.filter((a) => a.isCorrect === false).length : null;
    const unattemptedCount = isSubmitted ? Math.max(0, qCount - answers.length) : null;
    const totalAttempted = (correctCount || 0) + (incorrectCount || 0);
    const accuracy = isSubmitted && totalAttempted > 0 ? Math.round(((correctCount || 0) / totalAttempted) * 100) : null;
    const timeTakenSec = isSubmitted ? answers.reduce((s, a) => s + (a.timeTakenSec || 0), 0) : null;

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
      isAttempted: isSubmitted,
      score: att?.score ?? null,
      maxScore: qCount * (d.correctMarks || 4),
      correctCount,
      incorrectCount,
      unattemptedCount,
      accuracy,
      timeTakenSec,
      opensAt: null,
      submittedAt: att?.submittedAt ? att.submittedAt.toISOString() : null,
      pdfUrl: isSubmitted ? `/api/dpp/${d.id}/pdf` : null,
      href: `/dpp/${d.id}/attempt`,
      actionLabel: isSubmitted ? "View Result" : att?.status === "IN_PROGRESS" ? "Resume DPP" : "Attempt DPP",
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
    const isSubmitted = a?.status === "SUBMITTED" || a?.status === "AUTO_SUBMITTED";
    const isUpcoming = d.startsAt > now;
    const status = isUpcoming
      ? "UPCOMING"
      : isSubmitted
      ? "COMPLETED"
      : a?.status === "IN_PROGRESS"
      ? "IN_PROGRESS"
      : "AVAILABLE";

    const answers = a?.answers || [];
    const correctCount = isSubmitted ? answers.filter((ans) => ans.isCorrect === true).length : null;
    const incorrectCount = isSubmitted ? answers.filter((ans) => ans.isCorrect === false).length : null;
    const unattemptedCount = isSubmitted ? Math.max(0, qCount - answers.length) : null;
    const totalAttempted = (correctCount || 0) + (incorrectCount || 0);
    const accuracy = isSubmitted && totalAttempted > 0 ? Math.round(((correctCount || 0) / totalAttempted) * 100) : null;

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
      isAttempted: isSubmitted,
      score: a?.score ?? null,
      maxScore: qCount * 4,
      correctCount,
      incorrectCount,
      unattemptedCount,
      accuracy,
      timeTakenSec: null,
      opensAt: d.startsAt.toISOString(),
      submittedAt: a?.submittedAt ? a.submittedAt.toISOString() : null,
      pdfUrl: isSubmitted && t ? `/api/tests/${t.id}/pdf` : null,
      href: status === "UPCOMING" || !t ? null : `/tests/${t.id}/attempt`,
      actionLabel: isSubmitted ? "View Result" : status === "UPCOMING" ? `Opens at ${timeFmt(d.startsAt)}` : "Attempt DPP",
    });
  }

  // 5. Transform Tests (Both Upcoming and Completed)
  const testItems: BatchTestItem[] = rawTests.map((t) => {
    const a = t.attempts[0];
    const totalMarks = t.sections.reduce((acc, s) => acc + (s.targetCount || s._count.questions || 1) * (s.marksPerQuestion || 4), 0);
    const isSubmitted = a?.status === "SUBMITTED" || a?.status === "AUTO_SUBMITTED";
    const attemptStatus = !a ? "NOT_STARTED" : a.status === "IN_PROGRESS" ? "IN_PROGRESS" : "SUBMITTED";
    const isUpcoming = !!t.openTime && new Date(t.openTime) > now;
    const answers = a?.answers || [];
    const correctCount = isSubmitted ? answers.filter((ans) => ans.isCorrect === true).length : null;
    const incorrectCount = isSubmitted ? answers.filter((ans) => ans.isCorrect === false).length : null;
    const totalQuestions = t.sections.reduce((acc, s) => acc + (s.targetCount || s._count.questions || 0), 0);
    const unattemptedCount = isSubmitted ? Math.max(0, totalQuestions - answers.length) : null;
    const totalAttempted = (correctCount || 0) + (incorrectCount || 0);
    const accuracy = isSubmitted && totalAttempted > 0 ? Math.round(((correctCount || 0) / totalAttempted) * 100) : null;

    let actionLabel = "Start Test";
    let actionHref: string | null = `/tests/${t.id}/attempt`;

    if (isSubmitted) {
      actionLabel = "Review Attempt";
      actionHref = `/tests/${t.id}/result`;
    } else if (isUpcoming) {
      actionLabel = `Opens at ${timeFmt(t.openTime!)}`;
      actionHref = null;
    } else if (attemptStatus === "IN_PROGRESS") {
      actionLabel = "Resume Test";
      actionHref = `/tests/${t.id}/attempt`;
    }

    return {
      id: t.id,
      name: t.name,
      subject: t.chapter?.subject.title ?? "Comprehensive Test",
      chapter: t.chapter?.title ?? null,
      durationMin: t.durationMin,
      totalMarks: totalMarks || 720,
      openTime: t.openTime ? t.openTime.toISOString() : null,
      closeTime: t.closeTime ? t.closeTime.toISOString() : null,
      isUpcoming,
      attemptStatus,
      score: a?.score ?? null,
      maxScore: totalMarks || 720,
      accuracy,
      correctCount,
      incorrectCount,
      unattemptedCount,
      questionPdfUrl: isSubmitted ? `/api/tests/${t.id}/pdf` : null,
      solutionPdfUrl: isSubmitted ? `/api/tests/${t.id}/solutions-pdf` : null,
      actionLabel,
      actionHref,
      submittedAt: a?.submittedAt ? a.submittedAt.toISOString() : null,
    };
  });

  // 6. Transform Live & Scheduled Classes
  const classItems: BatchClassItem[] = schedules.map((s) => {
    const effectiveStatus = getEffectiveScheduleStatus(s, now);
    const subjName = s.chapter?.subject.title || s.subject || "Class";
    const chTitle = s.chapter?.title || s.topic || null;
    const notesPdfUrl = s.lecture?.slidesUrl || s.liveWhiteboardSession?.presentationUrl || null;

    return {
      id: s.id,
      title: s.title,
      subject: s.subject,
      teacherName: s.teacher?.displayName || s.teacher?.user.name || "Faculty",
      teacherPhotoUrl: s.teacher?.user.photoUrl || null,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      status: effectiveStatus,
      type: s.type,
      liveWhiteboardSession: s.liveWhiteboardSession,
      chapterId: s.chapterId,
      chapterTitle: chTitle,
      subjectName: subjName,
      notesPdfUrl,
    };
  });

  // 7. Assemble Unified Timeline Events for the "Schedule" Tab
  const timelineEvents: AcademicEvent[] = [];

  // 7.1 Classes -> timeline events
  for (const c of classItems) {
    const effectiveStatus = c.status;
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
      teacherPhotoUrl: c.teacherPhotoUrl,
      dateKey: dayKey(c.startsAt),
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      status: isLive ? "LIVE_NOW" : isCompleted ? "COMPLETED" : isCancelled ? "CANCELLED" : "UPCOMING",
      actionLabel: isLive ? "Join Live Class" : isCompleted ? "Play Class" : joinRule.allowed ? "Enter Class" : timeFmt(c.startsAt),
      actionHref: isCompleted ? `/watch/${c.id}` : `/live-class/${c.id}`,
      score: null,
      durationMin: Math.round((new Date(c.endsAt).getTime() - new Date(c.startsAt).getTime()) / 60000) || 60,
      questionCount: null,
      pdfUrl: c.notesPdfUrl ?? null,
      notesPdfUrl: c.notesPdfUrl ?? null,
    });
  }

  // 7.2 Scheduled Tests -> timeline events (Ensures Tests also appear in Schedule!)
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
      teacherPhotoUrl: null,
      dateKey: dayKey(testDate),
      startsAt: testDate,
      endsAt: t.closeTime,
      status: isSubmitted ? "SUBMITTED" : t.isUpcoming ? "UPCOMING" : "AVAILABLE",
      actionLabel: isSubmitted ? "Test Analysis" : isInProgress ? "Resume Test" : t.isUpcoming ? `Opens at ${timeFmt(testDate)}` : "Start Test",
      actionHref: isSubmitted ? `/tests/${t.id}/result` : t.isUpcoming ? null : `/tests/${t.id}/attempt`,
      score: t.score,
      maxScore: t.maxScore,
      durationMin: t.durationMin,
      questionCount: null,
      pdfUrl: t.questionPdfUrl,
      notesPdfUrl: null,
    });
  }

  // Sort timeline chronologically descending (newest on top, older below)
  timelineEvents.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  // 8. Build Centralized "All PDFs" Library
  const allPdfs: BatchPdfItem[] = [];

  // 8.0 Class Notes PDFs
  for (const c of classItems) {
    if (!c.notesPdfUrl) continue;
    allPdfs.push({
      id: `pdf_notes_${c.id}`,
      title: `${c.title} (Class Notes)`,
      category: "CLASS_NOTES",
      subject: c.subjectName,
      chapter: c.chapterTitle,
      fileUrl: c.notesPdfUrl,
      fileName: `${c.title}-Notes.pdf`,
      sizeBytes: 150000,
      allowDownload: true,
      createdAt: c.startsAt,
      sourceType: "CLASS_ATTACHMENT",
    });
  }

  // 8.1 DPP PDFs
  for (const d of dppItems) {
    if (!d.pdfUrl) continue;
    allPdfs.push({
      id: `pdf_dpp_${d.id}`,
      title: `${d.title} (Practice Sheet)`,
      category: "DPP",
      subject: d.subject,
      chapter: d.chapter,
      fileUrl: d.pdfUrl,
      fileName: `${d.code || "DPP"}.pdf`,
      sizeBytes: 150000,
      allowDownload: true,
      createdAt: d.opensAt || new Date().toISOString(),
      sourceType: "DPP_PDF",
    });
  }

  // 8.2 Test PDFs
  for (const t of testItems) {
    if (t.questionPdfUrl) {
      allPdfs.push({
        id: `pdf_test_${t.id}`,
        title: `${t.name} (Question Paper)`,
        category: "TESTS",
        subject: t.subject,
        chapter: t.chapter,
        fileUrl: t.questionPdfUrl,
        fileName: `${t.name}.pdf`,
        sizeBytes: 250000,
        allowDownload: true,
        createdAt: t.openTime || new Date().toISOString(),
        sourceType: "TEST_PDF",
      });
    }

    if (t.solutionPdfUrl) {
      allPdfs.push({
        id: `pdf_test_sol_${t.id}`,
        title: `${t.name} (Solutions & Key)`,
        category: "TESTS",
        subject: t.subject,
        chapter: t.chapter,
        fileUrl: t.solutionPdfUrl,
        fileName: `${t.name}-Solutions.pdf`,
        sizeBytes: 300000,
        allowDownload: true,
        createdAt: t.openTime || new Date().toISOString(),
        sourceType: "TEST_PDF",
      });
    }
  }

  // 8.3 Module PDFs
  const moduleItems: BatchModuleItem[] = [];
  for (const m of modules) {
    const exp = m.exportHistory[0];
    if (exp?.fileUrl) {
      moduleItems.push({
        id: m.id,
        code: m.code,
        title: m.title,
        subject: m.subject || "Academic Resource",
        chapter: m.chapter || null,
        facultyName: m.facultyName || null,
        pageCount: 1,
        fileUrl: exp.fileUrl,
        fileName: exp.fileName || `${m.title}.pdf`,
        allowDownload: true,
        createdAt: m.createdAt.toISOString(),
      });

      allPdfs.push({
        id: `pdf_mod_${m.id}`,
        title: `${m.title} (Module)`,
        category: "MODULES",
        subject: m.subject || "Study Material",
        chapter: m.chapter || null,
        fileUrl: exp.fileUrl,
        fileName: exp.fileName || `${m.title}.pdf`,
        sizeBytes: exp.fileSize || 500000,
        allowDownload: true,
        createdAt: m.createdAt.toISOString(),
        sourceType: "MODULE",
      });
    }
  }

  // 9. Transform Teachers
  const teacherCards: BatchTeacherCard[] = batch.teachers.map((t) => ({
    id: t.teacher.id,
    name: t.teacher.displayName || t.teacher.user.name,
    photoUrl: t.teacher.user.photoUrl,
    subjects: t.teacher.subjects || [],
    experienceYears: t.teacher.experienceYears ? `${t.teacher.experienceYears} Years` : null,
    bio: t.teacher.bio || null,
    department: t.teacher.department || null,
  }));

  // 10. Transform Mentorship Slots
  const transformedDoubtSlots: BatchDoubtSlotItem[] = doubtSlots.map((slot) => {
    const durationMinutes = Math.round((slot.endTime.getTime() - slot.startTime.getTime()) / 60000) || 15;
    return {
      id: slot.id,
      teacherId: slot.teacherId,
      teacherName: slot.teacher.displayName || slot.teacher.user.name,
      teacherPhotoUrl: slot.teacher.user.photoUrl,
      subject: (slot.teacher.subjects && slot.teacher.subjects[0]) || "Academic Mentorship",
      startsAt: slot.startTime.toISOString(),
      endsAt: slot.endTime.toISOString(),
      durationMinutes,
      status: slot.status as any,
      isBooked: slot.status === "BOOKED",
    };
  });

  // 11. Transform Student Doubt Bookings
  const transformedBookings: StudentDoubtBookingItem[] = studentBookings.map((b) => ({
    id: b.id,
    teacherName: b.teacher.displayName || b.teacher.user.name,
    topic: b.topic || "Academic Mentorship",
    startsAt: b.slot.startTime.toISOString(),
    endsAt: b.slot.endTime.toISOString(),
    status: b.status,
    meetingUrl: b.status === "CONFIRMED" ? `/api/doubt-booking/bookings/${b.id}/join` : null,
    createdAt: b.createdAt.toISOString(),
  }));

  // 12. Transform Notices
  const notices: BatchNotice[] = [
    ...notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      deepLink: n.deepLink,
    })),
    ...broadcasts.map((b) => ({
      id: b.id,
      title: b.title,
      body: b.body,
      createdAt: b.createdAt.toISOString(),
      deepLink: null,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    batch: {
      id: batch.id,
      name: batch.name,
      code: batch.code,
      exam: batch.targetExam,
      description: batch.description,
      thumbnailUrl: batch.thumbnailUrl,
      teachers: teacherCards.map((t) => t.name),
      teacherCards,
    },
    timelineEvents,
    classes: classItems,
    chapters,
    tests: testItems,
    dpps: dppItems,
    allPdfs,
    modules: moduleItems,
    doubtSlots: transformedDoubtSlots,
    studentBookings: transformedBookings,
    folders,
    notices,
  };
}
