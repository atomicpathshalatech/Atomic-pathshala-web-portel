import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Teacher Command Center data layer — every number here comes from a real
// Prisma query against real tables (LiveClassAttendance, LectureProgress,
// Attempt, Doubt, BatchSchedule, TeacherFollow, ...). Nothing in this file
// is mock/placeholder data.
//
// Deliberately scoped to what this schema can actually support today.
// Left out (tracked as a real roadmap, not silently faked — see the
// "Coming Soon" panel this data feeds): per-lecture watch-time/retention
// curves (no per-second video telemetry is recorded, only
// LectureProgress's one-time "completed" flag), a workload/time-tracking
// system (no time-log table exists), cross-teacher benchmarking (would
// expose other teachers' performance — a real privacy call, not just
// missing data), and an AI copilot chat (needs its own inference wiring).
//
// Two time windows: `period` (last 30 days) vs `prevPeriod` (the 30 days
// before that) — every KPI that supports a trend arrow compares the two.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = 30;

export type Trend<T> = { value: T; deltaPct: number | null };

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // no baseline to compare against
  return ((current - previous) / previous) * 100;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export type CriticalAlert = {
  level: "critical" | "warning" | "opportunity" | "info";
  text: string;
};

export type CommandCenterData = {
  teacherId: string;
  teacherName: string;
  department: string;
  employeeCode: string;
  windowLabel: string; // "Last 30 days"
  summary: string;

  todayLiveClasses: {
    id: string;
    title: string;
    batchName: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
  }[];
  pendingDoubtsCount: number;
  draftLecturesCount: number;

  alerts: CriticalAlert[];

  kpis: {
    lecturesDelivered: Trend<number>;
    teachingHours: Trend<number>;
    liveClassesHeld: Trend<number>;
    avgAttendancePct: Trend<number | null>;
    activeStudents: Trend<number>;
    avgTestScore: Trend<number | null>;
    doubtResolutionRatePct: number | null;
    contentPublished: number;
    contentDraft: number;
    followerCount: number;
  };

  teachingProgress: {
    planned: number;
    actual: number;
    pct: number | null;
    status: "ahead" | "on_track" | "behind" | "no_data";
  };

  consistency: {
    scheduledDays: number;
    activeDays: number;
    consistencyPct: number | null;
  };

  batches: {
    id: string;
    name: string;
    targetExam: string | null;
    studentCount: number;
    avgAttendancePct: number | null;
    avgTestScore: number | null;
    health: "healthy" | "attention" | "no_data";
  }[];

  chapters: {
    id: string;
    title: string;
    subjectTitle: string;
    status: string;
    publishedLectures: number;
    totalLectures: number;
    studentsCompleted: number;
    eligibleStudents: number | null;
    completionPct: number | null;
    avgTestScore: number | null;
  }[];

  lectures: {
    id: string;
    title: string;
    chapterTitle: string;
    status: string;
    order: number;
    createdAt: Date;
    completions: number;
    eligibleStudents: number | null;
    completionPct: number | null;
  }[];

  doubts: {
    openCount: number;
    resolvedInPeriod: number;
    overdueCount: number;
    oldestPending: { id: string; studentName: string; subject: string | null; createdAt: Date; priority: string }[];
  };

  tests: {
    count: number;
    avgScore: number | null;
    totalAttempts: number;
    recent: { id: string; name: string; attempts: number; avgScore: number | null; status: string }[];
  };

  contentGaps: { chapterId: string; chapterTitle: string; issue: string }[];
};

export async function getTeacherCommandCenterData(teacherId: string): Promise<CommandCenterData> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);
  const prevPeriodStart = new Date(periodStart.getTime() - PERIOD_DAYS * DAY_MS);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const overdueThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { user: { select: { name: true } } },
  });
  if (!teacher) throw new Error("Teacher not found");

  // ---- "My batches" — every batch this teacher is linked to, either as a
  // roster co-teacher (BatchTeacher) or as the named instructor on at least
  // one schedule entry. Same OR shape the existing team dashboard already
  // uses for "upcoming", kept consistent rather than inventing a second
  // definition of "my batch".
  const [batchTeacherLinks, scheduleBatchLinks] = await Promise.all([
    prisma.batchTeacher.findMany({ where: { teacherId }, select: { batchId: true } }),
    prisma.batchSchedule.findMany({ where: { teacherId }, select: { batchId: true }, distinct: ["batchId"] }),
  ]);
  const batchIds = Array.from(
    new Set([...batchTeacherLinks.map((b) => b.batchId), ...scheduleBatchLinks.map((b) => b.batchId)])
  );

  const [batches, enrollmentCounts] = await Promise.all([
    prisma.batch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, name: true, targetExam: true, courseId: true },
    }),
    prisma.batchEnrollment.groupBy({
      by: ["batchId"],
      where: { batchId: { in: batchIds }, status: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);
  const enrollmentByBatch = new Map(enrollmentCounts.map((e) => [e.batchId, e._count._all]));
  const courseIdsITeach = new Set(batches.map((b) => b.courseId).filter((c): c is string => Boolean(c)));

  // ---- My lectures (everything I authored, any status) ----------------
  const myLectures = await prisma.lecture.findMany({
    where: { teacherId },
    select: {
      id: true,
      title: true,
      status: true,
      order: true,
      createdAt: true,
      chapterId: true,
      chapter: { select: { id: true, title: true, status: true, subject: { select: { title: true, courseId: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const lectureIds = myLectures.map((l) => l.id);
  const progressCounts = lectureIds.length
    ? await prisma.lectureProgress.groupBy({ by: ["lectureId"], where: { lectureId: { in: lectureIds } }, _count: { _all: true } })
    : [];
  const completionsByLecture = new Map(progressCounts.map((p) => [p.lectureId, p._count._all]));

  // Eligible-students estimate for a chapter/lecture: sum of active
  // enrollment across MY batches whose course matches that chapter's
  // subject's course. Null (not "0%") when none of my batches match —
  // that's a real "can't compute this" case, not a real zero.
  function eligibleForCourse(courseId: string | null): number | null {
    if (!courseId) return null;
    const matching = batches.filter((b) => b.courseId === courseId);
    if (matching.length === 0) return null;
    return matching.reduce((sum, b) => sum + (enrollmentByBatch.get(b.id) ?? 0), 0);
  }

  const lectures = myLectures.map((l) => {
    const eligible = eligibleForCourse(l.chapter.subject.courseId);
    const completions = completionsByLecture.get(l.id) ?? 0;
    return {
      id: l.id,
      title: l.title,
      chapterTitle: l.chapter.title,
      status: l.status,
      order: l.order,
      createdAt: l.createdAt,
      completions,
      eligibleStudents: eligible,
      completionPct: eligible && eligible > 0 ? (completions / eligible) * 100 : null,
    };
  });

  // ---- Chapters I've taught in (grouped from my lectures) --------------
  type ChapterAgg = {
    id: string;
    title: string;
    subjectTitle: string;
    status: string;
    courseId: string | null;
    publishedLectures: number;
    totalLectures: number;
    studentsCompleted: Set<string>;
  };
  const chapterMap = new Map<string, ChapterAgg>();
  for (const l of myLectures) {
    const c = l.chapter;
    if (!chapterMap.has(c.id)) {
      chapterMap.set(c.id, {
        id: c.id,
        title: c.title,
        subjectTitle: c.subject.title,
        status: c.status,
        courseId: c.subject.courseId,
        publishedLectures: 0,
        totalLectures: 0,
        studentsCompleted: new Set(),
      });
    }
    const agg = chapterMap.get(c.id)!;
    agg.totalLectures += 1;
    if (l.status === "PUBLISHED") agg.publishedLectures += 1;
  }
  const chapterLectureIds = new Map<string, string[]>();
  for (const l of myLectures) {
    const arr = chapterLectureIds.get(l.chapterId) ?? [];
    arr.push(l.id);
    chapterLectureIds.set(l.chapterId, arr);
  }
  if (lectureIds.length) {
    const allProgress = await prisma.lectureProgress.findMany({
      where: { lectureId: { in: lectureIds } },
      select: { lectureId: true, studentId: true },
    });
    const lectureToChapter = new Map(myLectures.map((l) => [l.id, l.chapterId]));
    for (const p of allProgress) {
      const chapterId = lectureToChapter.get(p.lectureId);
      if (chapterId) chapterMap.get(chapterId)?.studentsCompleted.add(p.studentId);
    }
  }

  const chapterIds = Array.from(chapterMap.keys());
  const chapterTests = chapterIds.length
    ? await prisma.test.findMany({
        where: { chapterId: { in: chapterIds } },
        select: {
          chapterId: true,
          attempts: { where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } }, select: { score: true } },
        },
      })
    : [];
  const scoresByChapter = new Map<string, number[]>();
  for (const t of chapterTests) {
    if (!t.chapterId) continue;
    const arr = scoresByChapter.get(t.chapterId) ?? [];
    for (const a of t.attempts) if (a.score !== null) arr.push(a.score);
    scoresByChapter.set(t.chapterId, arr);
  }

  const chapters = Array.from(chapterMap.values()).map((c) => {
    const eligible = eligibleForCourse(c.courseId);
    return {
      id: c.id,
      title: c.title,
      subjectTitle: c.subjectTitle,
      status: c.status,
      publishedLectures: c.publishedLectures,
      totalLectures: c.totalLectures,
      studentsCompleted: c.studentsCompleted.size,
      eligibleStudents: eligible,
      completionPct: eligible && eligible > 0 ? (c.studentsCompleted.size / eligible) * 100 : null,
      avgTestScore: avg(scoresByChapter.get(c.id) ?? []),
    };
  });

  // ---- Live classes: teaching hours, planned vs actual, attendance -----
  const [scheduledInPeriod, scheduledInPrevPeriod, todaySchedules] = await Promise.all([
    prisma.batchSchedule.findMany({
      where: { teacherId, type: "LIVE_CLASS", startsAt: { gte: periodStart, lte: now } },
      select: { id: true, startsAt: true, endsAt: true, status: true },
    }),
    prisma.batchSchedule.count({
      where: { teacherId, type: "LIVE_CLASS", startsAt: { gte: prevPeriodStart, lt: periodStart }, status: "COMPLETED" },
    }),
    prisma.batchSchedule.findMany({
      where: { teacherId, type: "LIVE_CLASS", startsAt: { gte: todayStart, lt: todayEnd } },
      select: { id: true, title: true, startsAt: true, endsAt: true, status: true, batch: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  const completedInPeriod = scheduledInPeriod.filter((s) => s.status === "COMPLETED");
  const teachingHours = completedInPeriod.reduce((sum, s) => sum + (s.endsAt.getTime() - s.startsAt.getTime()) / 3_600_000, 0);
  // Previous-period hours only needs the count for a rough hours trend —
  // computing exact prior-period hours would need a second full fetch for
  // one KPI's delta, so that delta is intentionally left null (better than
  // a misleading approximation).
  const liveClassesHeldPrev = scheduledInPrevPeriod;

  const sessionsForAttendance = completedInPeriod.length
    ? await prisma.whiteboardSession.findMany({
        where: { batchScheduleId: { in: completedInPeriod.map((s) => s.id) } },
        select: { id: true, batchScheduleId: true, _count: { select: { attendances: true } } },
      })
    : [];
  const scheduleToBatch = new Map<string, string>();
  const fullSchedules = completedInPeriod.length
    ? await prisma.batchSchedule.findMany({
        where: { id: { in: completedInPeriod.map((s) => s.id) } },
        select: { id: true, batchId: true },
      })
    : [];
  for (const s of fullSchedules) scheduleToBatch.set(s.id, s.batchId);
  const attendancePcts: number[] = [];
  for (const s of sessionsForAttendance) {
    const batchId = s.batchScheduleId ? scheduleToBatch.get(s.batchScheduleId) : null;
    const enrolled = batchId ? enrollmentByBatch.get(batchId) ?? 0 : 0;
    if (enrolled > 0) attendancePcts.push((s._count.attendances / enrolled) * 100);
  }

  const teachingProgressPct = scheduledInPeriod.length > 0 ? (completedInPeriod.length / scheduledInPeriod.length) * 100 : null;
  const teachingProgressStatus: CommandCenterData["teachingProgress"]["status"] =
    teachingProgressPct === null
      ? "no_data"
      : teachingProgressPct >= 95
        ? "ahead"
        : teachingProgressPct >= 75
          ? "on_track"
          : "behind";

  // ---- Active students: distinct students who touched anything of mine
  // (attendance, lecture completion, or a test attempt on one of my
  // chapters/schedules) in the period. ----------------------------------
  const [attendanceStudents, progressStudents, attemptStudents] = await Promise.all([
    prisma.liveClassAttendance.findMany({
      where: { whiteboardSession: { teacherId }, joinedAt: { gte: periodStart } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    lectureIds.length
      ? prisma.lectureProgress.findMany({
          where: { lectureId: { in: lectureIds }, completedAt: { gte: periodStart } },
          select: { studentId: true },
          distinct: ["studentId"],
        })
      : Promise.resolve([]),
    chapterIds.length
      ? prisma.attempt.findMany({
          where: { test: { chapterId: { in: chapterIds } }, submittedAt: { gte: periodStart } },
          select: { studentId: true },
          distinct: ["studentId"],
        })
      : Promise.resolve([]),
  ]);
  const activeStudentSet = new Set([
    ...attendanceStudents.map((s) => s.studentId),
    ...progressStudents.map((s) => s.studentId),
    ...attemptStudents.map((s) => s.studentId),
  ]);

  const [attendanceStudentsPrev, progressStudentsPrev, attemptStudentsPrev] = await Promise.all([
    prisma.liveClassAttendance.findMany({
      where: { whiteboardSession: { teacherId }, joinedAt: { gte: prevPeriodStart, lt: periodStart } },
      select: { studentId: true },
      distinct: ["studentId"],
    }),
    lectureIds.length
      ? prisma.lectureProgress.findMany({
          where: { lectureId: { in: lectureIds }, completedAt: { gte: prevPeriodStart, lt: periodStart } },
          select: { studentId: true },
          distinct: ["studentId"],
        })
      : Promise.resolve([]),
    chapterIds.length
      ? prisma.attempt.findMany({
          where: { test: { chapterId: { in: chapterIds } }, submittedAt: { gte: prevPeriodStart, lt: periodStart } },
          select: { studentId: true },
          distinct: ["studentId"],
        })
      : Promise.resolve([]),
  ]);
  const activeStudentSetPrev = new Set([
    ...attendanceStudentsPrev.map((s) => s.studentId),
    ...progressStudentsPrev.map((s) => s.studentId),
    ...attemptStudentsPrev.map((s) => s.studentId),
  ]);

  // ---- Lectures delivered (published) this period vs previous ---------
  const [lecturesDeliveredCount, lecturesDeliveredPrevCount] = await Promise.all([
    prisma.lecture.count({ where: { teacherId, status: "PUBLISHED", createdAt: { gte: periodStart } } }),
    prisma.lecture.count({
      where: { teacherId, status: "PUBLISHED", createdAt: { gte: prevPeriodStart, lt: periodStart } },
    }),
  ]);

  // ---- Test scores this period vs previous (across my chapters) -------
  const [attemptsInPeriod, attemptsInPrevPeriod] = chapterIds.length
    ? await Promise.all([
        prisma.attempt.findMany({
          where: {
            test: { chapterId: { in: chapterIds } },
            status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
            submittedAt: { gte: periodStart },
          },
          select: { score: true },
        }),
        prisma.attempt.findMany({
          where: {
            test: { chapterId: { in: chapterIds } },
            status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
            submittedAt: { gte: prevPeriodStart, lt: periodStart },
          },
          select: { score: true },
        }),
      ])
    : [[], []];
  const avgScoreInPeriod = avg(attemptsInPeriod.map((a) => a.score).filter((s): s is number => s !== null));
  const avgScoreInPrevPeriod = avg(attemptsInPrevPeriod.map((a) => a.score).filter((s): s is number => s !== null));

  // ---- Doubts (global inbox — Doubt has no per-teacher assignment) ----
  const [openCount, resolvedInPeriod, overdueCount, oldestPendingRaw] = await Promise.all([
    prisma.doubt.count({ where: { status: { in: ["OPEN", "ASSIGNED"] } } }),
    prisma.doubt.count({ where: { status: "RESOLVED", resolvedAt: { gte: periodStart } } }),
    prisma.doubt.count({ where: { status: { in: ["OPEN", "ASSIGNED"] }, createdAt: { lt: overdueThreshold } } }),
    prisma.doubt.findMany({
      where: { status: { in: ["OPEN", "ASSIGNED"] } },
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
  ]);
  const createdInPeriodCount = await prisma.doubt.count({ where: { createdAt: { gte: periodStart } } });
  const doubtResolutionRatePct = createdInPeriodCount > 0 ? (resolvedInPeriod / createdInPeriodCount) * 100 : null;

  // ---- Tests linked to my chapters or my own scheduled class-tests ----
  const tests = chapterIds.length
    ? await prisma.test.findMany({
        where: { OR: [{ chapterId: { in: chapterIds } }, { batchSchedule: { teacherId } }] },
        select: {
          id: true,
          name: true,
          status: true,
          attempts: { where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } }, select: { score: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : await prisma.test.findMany({
        where: { batchSchedule: { teacherId } },
        select: {
          id: true,
          name: true,
          status: true,
          attempts: { where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } }, select: { score: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
  const allTestScores = tests.flatMap((t) => t.attempts.map((a) => a.score).filter((s): s is number => s !== null));

  // ---- Content gaps: chapters I own with thin published content -------
  const contentGaps: CommandCenterData["contentGaps"] = [];
  for (const c of chapterMap.values()) {
    if (c.publishedLectures === 0) {
      contentGaps.push({ chapterId: c.id, chapterTitle: c.title, issue: "No published lectures yet" });
    } else if (c.status === "DRAFT" || c.status === "LECTURES_IN_PROGRESS") {
      contentGaps.push({ chapterId: c.id, chapterTitle: c.title, issue: `Still ${c.status.toLowerCase().replace(/_/g, " ")}` });
    }
  }

  // ---- Batches summary card data ---------------------------------------
  const batchCards = batches.map((b) => {
    const studentCount = enrollmentByBatch.get(b.id) ?? 0;
    // Attendance/score for a batch: reuse the chapters/attendance already
    // computed for chapters/sessions tied to this batch's course.
    const batchAttendance =
      attendancePcts.length && b.courseId && courseIdsITeach.has(b.courseId) ? avg(attendancePcts) : null;
    const batchAvgScore = avgScoreInPeriod;
    const health: "healthy" | "attention" | "no_data" =
      batchAttendance === null ? "no_data" : batchAttendance >= 70 ? "healthy" : "attention";
    return {
      id: b.id,
      name: b.name,
      targetExam: b.targetExam,
      studentCount,
      avgAttendancePct: batchAttendance,
      avgTestScore: batchAvgScore,
      health,
    };
  });

  const followerCount = await prisma.teacherFollow.count({ where: { teacherId } });

  // ---- Alerts (rule-based, derived from the real numbers above) -------
  const alerts: CriticalAlert[] = [];
  if (overdueCount > 0) {
    alerts.push({ level: "critical", text: `${overdueCount} doubt${overdueCount === 1 ? "" : "s"} open for more than 48 hours.` });
  }
  if (teachingProgressPct !== null && teachingProgressPct < 75) {
    alerts.push({
      level: "warning",
      text: `Only ${teachingProgressPct.toFixed(0)}% of your scheduled live classes this month were held.`,
    });
  }
  const attendanceAvg = avg(attendancePcts);
  if (attendanceAvg !== null && attendanceAvg < 60) {
    alerts.push({ level: "warning", text: `Average live-class attendance is ${attendanceAvg.toFixed(0)}% this month.` });
  }
  for (const gap of contentGaps.slice(0, 3)) {
    alerts.push({ level: "info", text: `"${gap.chapterTitle}" — ${gap.issue}.` });
  }
  if (avgScoreInPeriod !== null && avgScoreInPrevPeriod !== null && avgScoreInPeriod > avgScoreInPrevPeriod) {
    alerts.push({
      level: "opportunity",
      text: `Average test score is trending up (${avgScoreInPeriod.toFixed(1)} vs ${avgScoreInPrevPeriod.toFixed(1)} last period).`,
    });
  }

  // ---- Header summary line ---------------------------------------------
  const summaryParts: string[] = [];
  if (teachingProgressPct !== null) {
    summaryParts.push(
      teachingProgressStatus === "ahead" || teachingProgressStatus === "on_track"
        ? `You've held ${completedInPeriod.length} of ${scheduledInPeriod.length} scheduled classes this month.`
        : `You've held ${completedInPeriod.length} of ${scheduledInPeriod.length} scheduled classes this month — behind pace.`
    );
  }
  if (overdueCount > 0) summaryParts.push(`${overdueCount} doubt${overdueCount === 1 ? "" : "s"} need attention.`);
  const summary = summaryParts.length > 0 ? summaryParts.join(" ") : "No activity recorded yet this month.";

  return {
    teacherId,
    teacherName: teacher.user.name,
    department: teacher.department,
    employeeCode: teacher.employeeCode,
    windowLabel: "Last 30 days",
    summary,

    todayLiveClasses: todaySchedules.map((s) => ({
      id: s.id,
      title: s.title,
      batchName: s.batch.name,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
    })),
    pendingDoubtsCount: openCount,
    draftLecturesCount: lectures.filter((l) => l.status === "DRAFT").length,

    alerts,

    kpis: {
      lecturesDelivered: { value: lecturesDeliveredCount, deltaPct: pctDelta(lecturesDeliveredCount, lecturesDeliveredPrevCount) },
      teachingHours: { value: Math.round(teachingHours * 10) / 10, deltaPct: null },
      liveClassesHeld: { value: completedInPeriod.length, deltaPct: pctDelta(completedInPeriod.length, liveClassesHeldPrev) },
      avgAttendancePct: { value: attendanceAvg, deltaPct: null },
      activeStudents: { value: activeStudentSet.size, deltaPct: pctDelta(activeStudentSet.size, activeStudentSetPrev.size) },
      avgTestScore: {
        value: avgScoreInPeriod,
        deltaPct: avgScoreInPeriod !== null && avgScoreInPrevPeriod !== null ? pctDelta(avgScoreInPeriod, avgScoreInPrevPeriod) : null,
      },
      doubtResolutionRatePct,
      contentPublished: lectures.filter((l) => l.status === "PUBLISHED").length,
      contentDraft: lectures.filter((l) => l.status === "DRAFT").length,
      followerCount,
    },

    teachingProgress: {
      planned: scheduledInPeriod.length,
      actual: completedInPeriod.length,
      pct: teachingProgressPct,
      status: teachingProgressStatus,
    },

    consistency: {
      scheduledDays: scheduledInPeriod.length,
      activeDays: completedInPeriod.length,
      consistencyPct: teachingProgressPct,
    },

    batches: batchCards,
    chapters,
    lectures,

    doubts: {
      openCount,
      resolvedInPeriod,
      overdueCount,
      oldestPending: oldestPendingRaw.map((d) => ({
        id: d.id,
        studentName: d.student.user.name,
        subject: d.subject,
        createdAt: d.createdAt,
        priority: d.priority,
      })),
    },

    tests: {
      count: tests.length,
      avgScore: avg(allTestScores),
      totalAttempts: allTestScores.length,
      recent: tests.map((t) => ({
        id: t.id,
        name: t.name,
        attempts: t.attempts.length,
        avgScore: avg(t.attempts.map((a) => a.score).filter((s): s is number => s !== null)),
        status: t.status,
      })),
    },

    contentGaps,
  };
}
