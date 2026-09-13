import "server-only";
import { prisma } from "@/lib/db";
import { hasActiveSubscription } from "@/lib/subscription/guard";
import type { ChapterStat } from "@/lib/test-engine/analysis-engine";

/**
 * Aggregated "student 360" profile — built because no such aggregator
 * existed at all (the admin Student Management console only ever showed a
 * batch-access modal, never academic data; there was no student-detail
 * page to open in the first place). Every number here is computed from
 * real rows already in the database (Attempt/TestAttemptAnalysis,
 * LiveClassAttendance, LectureProgress, Doubt, Subscription,
 * BatchEnrollment) — nothing is invented, and a metric with too little
 * data to be meaningful reports `insufficient: true` instead of a
 * fabricated number, per the "don't invent analytics" requirement this
 * was built against.
 */

export interface StudentZone {
  subject: string;
  chapter: string;
  attempted: number;
  accuracy: number;
}

export interface StudentCompleteProfile {
  student: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    studentIdCode: string;
    enrollmentNumber: string;
    class: string;
    targetExam: string;
    createdAt: Date;
  };
  subscription: {
    status: string;
    plan: string;
    isActive: boolean;
    currentPeriodEnd: Date;
  } | null;
  batches: { id: string; name: string; status: string; enrolledAt: Date }[];
  tests: {
    totalAttempts: number;
    averageAccuracy: number | null;
    averageScore: number | null;
    bestScore: number | null;
    recent: { testId: string; score: number; percentage: number; accuracy: number; submittedAt: Date | null }[];
    insufficient: boolean;
  };
  lectures: {
    assignedCount: number;
    completedCount: number;
    completionPercentage: number | null;
    insufficient: boolean;
  };
  attendance: {
    classesJoined: number;
    classesHeld: number;
    attendancePercentage: number | null;
    insufficient: boolean;
  };
  doubts: {
    totalAsked: number;
    resolved: number;
    open: number;
  };
  strongZones: StudentZone[];
  weakZones: StudentZone[];
}

const MIN_ATTEMPTS_FOR_ZONE = 3;
const STRONG_ACCURACY_THRESHOLD = 75;
const WEAK_ACCURACY_THRESHOLD = 50;

export async function getStudentCompleteProfile(studentId: string): Promise<StudentCompleteProfile | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      subscription: true,
      batchEnrollments: {
        where: { status: "ACTIVE" },
        include: { batch: { select: { id: true, name: true, status: true } } },
        orderBy: { enrolledAt: "desc" },
      },
    },
  });
  if (!student) return null;

  const [attempts, doubts, subscriptionIsActive] = await Promise.all([
    prisma.attempt.findMany({
      where: { studentId, status: "SUBMITTED" },
      include: { analysis: true },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.doubt.findMany({ where: { studentId }, select: { status: true } }),
    hasActiveSubscription(studentId),
  ]);

  // ---- Tests ----------------------------------------------------------
  const withAnalysis = attempts.filter((a) => a.analysis);
  const totalAttempts = attempts.length;
  const averageAccuracy = withAnalysis.length
    ? withAnalysis.reduce((s, a) => s + (a.analysis!.accuracy || 0), 0) / withAnalysis.length
    : null;
  const scores = attempts.map((a) => a.score).filter((s): s is number => typeof s === "number");
  const averageScore = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
  const bestScore = scores.length ? Math.max(...scores) : null;

  // ---- Strong / weak zones — aggregated across every test's chapterStats
  // snapshot (already computed per-attempt by the test analysis engine),
  // not recomputed from scratch here. ------------------------------------
  const chapterAgg = new Map<string, { subject: string; chapter: string; attempted: number; correct: number }>();
  for (const a of withAnalysis) {
    const stats = (a.analysis!.chapterStats as unknown as ChapterStat[]) || [];
    for (const cs of stats) {
      const key = `${cs.subject}::${cs.chapter}`;
      const entry = chapterAgg.get(key) || { subject: cs.subject, chapter: cs.chapter, attempted: 0, correct: 0 };
      entry.attempted += cs.attempted;
      entry.correct += cs.correct;
      chapterAgg.set(key, entry);
    }
  }
  const zoneCandidates = Array.from(chapterAgg.values())
    .filter((c) => c.attempted >= MIN_ATTEMPTS_FOR_ZONE)
    .map((c) => ({ subject: c.subject, chapter: c.chapter, attempted: c.attempted, accuracy: (c.correct / c.attempted) * 100 }));
  const strongZones = zoneCandidates.filter((z) => z.accuracy >= STRONG_ACCURACY_THRESHOLD).sort((a, b) => b.accuracy - a.accuracy).slice(0, 10);
  const weakZones = zoneCandidates.filter((z) => z.accuracy < WEAK_ACCURACY_THRESHOLD).sort((a, b) => a.accuracy - b.accuracy).slice(0, 10);

  // ---- Lecture progress — assigned = real Lectures under chapters
  // explicitly assigned (BatchChapter) to any batch this student is
  // actively enrolled in, matching the same "My Lectures" scoping this
  // session's content-isolation fix introduced. ------------------------
  const batchIds = student.batchEnrollments.map((e) => e.batchId);
  let assignedCount = 0;
  let completedCount = 0;
  if (batchIds.length > 0) {
    const assignedChapterIds = await prisma.batchChapter
      .findMany({ where: { batchId: { in: batchIds } }, select: { chapterId: true }, distinct: ["chapterId"] })
      .then((rows) => rows.map((r) => r.chapterId));

    if (assignedChapterIds.length > 0) {
      const [total, completed] = await Promise.all([
        prisma.lecture.count({ where: { chapterId: { in: assignedChapterIds }, status: "PUBLISHED" } }),
        prisma.lectureProgress.count({
          where: { studentId, lecture: { chapterId: { in: assignedChapterIds }, status: "PUBLISHED" } },
        }),
      ]);
      assignedCount = total;
      completedCount = completed;
    }
  }

  // ---- Attendance — a simplified but real aggregate: how many classes
  // this student has an attendance row for (joined at all) versus how many
  // classes were actually held (ended) across their enrolled batches. Not
  // the same PRESENT/PARTIAL/ABSENT-by-active-duration threshold the
  // single-session attendance route uses (that's a richer per-class
  // computation); this is a coarser but genuine cross-history number. -----
  const attendanceRows = await prisma.liveClassAttendance.findMany({
    where: { studentId },
    select: { whiteboardSessionId: true },
  });
  const classesJoined = attendanceRows.length;
  const classesHeld =
    batchIds.length > 0
      ? await prisma.whiteboardSession.count({
          where: { batchSchedule: { batchId: { in: batchIds } }, status: "ENDED", isTest: false },
        })
      : 0;

  return {
    student: {
      id: student.id,
      name: student.user.name,
      email: student.user.email,
      phone: student.user.phone,
      studentIdCode: student.studentIdCode,
      enrollmentNumber: student.enrollmentNumber,
      class: student.class,
      targetExam: student.targetExam,
      createdAt: student.createdAt,
    },
    subscription: student.subscription
      ? {
          status: student.subscription.status,
          plan: student.subscription.plan,
          isActive: subscriptionIsActive,
          currentPeriodEnd: student.subscription.currentPeriodEnd,
        }
      : null,
    batches: student.batchEnrollments.map((e) => ({
      id: e.batch.id,
      name: e.batch.name,
      status: e.batch.status,
      enrolledAt: e.enrolledAt,
    })),
    tests: {
      totalAttempts,
      averageAccuracy,
      averageScore,
      bestScore,
      recent: attempts.slice(0, 10).map((a) => ({
        testId: a.testId || a.id,
        score: a.score ?? 0,
        percentage: a.analysis?.percentage ?? 0,
        accuracy: a.analysis?.accuracy ?? 0,
        submittedAt: a.submittedAt,
      })),
      insufficient: totalAttempts === 0,
    },
    lectures: {
      assignedCount,
      completedCount,
      completionPercentage: assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : null,
      insufficient: assignedCount === 0,
    },
    attendance: {
      classesJoined,
      classesHeld,
      attendancePercentage: classesHeld > 0 ? Math.round((classesJoined / classesHeld) * 100) : null,
      insufficient: classesHeld === 0,
    },
    doubts: {
      totalAsked: doubts.length,
      resolved: doubts.filter((d) => d.status === "RESOLVED").length,
      open: doubts.filter((d) => d.status !== "RESOLVED").length,
    },
    strongZones,
    weakZones,
  };
}
