import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { missingTableAsEmpty } from "@/lib/teaching/stats";
import { matchesActivity, pickSort, sortRows, type ActivityFilter, type SortDir, type SortSpec } from "@/lib/performance/sort";

/**
 * Student performance for the Super Admin board — everything is what the
 * student actually did: DPPs/tests attempted (questions answered, left,
 * right, wrong), live classes attended (minutes present) and recorded
 * classes watched (minutes played).
 */

/** An answer counts as attempted only if an option was actually chosen. */
export function isAnswered(selectedOptionIds: unknown): boolean {
  return Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0;
}

export interface StudentRow {
  studentId: string;
  name: string;
  email: string;
  code: string;
  batches: string[];
  dppsAttempted: number;
  questionsAnswered: number;
  questionsCorrect: number;
  testsAttempted: number;
  liveClasses: number;
  liveMinutes: number;
  recordedMinutes: number;
  lecturesCompleted: number;
  lastActiveAt: Date | null;
}

export const STUDENT_SORT: SortSpec<StudentRow> = {
  name: (r) => r.name,
  batch: (r) => r.batches.join(", ") || null,
  dpps: (r) => r.dppsAttempted,
  tests: (r) => r.testsAttempted,
  questions: (r) => r.questionsAnswered,
  correct: (r) => r.questionsCorrect,
  accuracy: (r) => (r.questionsAnswered > 0 ? r.questionsCorrect / r.questionsAnswered : null),
  liveClasses: (r) => r.liveClasses,
  liveTime: (r) => r.liveMinutes,
  recorded: (r) => r.recordedMinutes,
  lectures: (r) => r.lecturesCompleted,
  lastActive: (r) => r.lastActiveAt,
};

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * Every matching student with their numbers, then filtered, sorted and
 * paged — so sorting ("top to bottom") covers ALL students, not just the
 * page on screen.
 */
export async function listStudentPerformance(
  opts: { search?: string; batchId?: string; activity?: ActivityFilter; sort?: string; dir?: SortDir; skip?: number; take?: number } = {}
) {
  const q = opts.search?.trim();
  const where: Prisma.StudentWhereInput = {
    ...(q && {
      OR: [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { studentIdCode: { contains: q, mode: "insensitive" } },
        { enrollmentNumber: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(opts.batchId && { batchEnrollments: { some: { batchId: opts.batchId, status: "ACTIVE" } } }),
  };
  const students = await prisma.student.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      studentIdCode: true,
      user: { select: { name: true, email: true, lastLoginAt: true } },
      batchEnrollments: { where: { status: "ACTIVE" }, select: { batch: { select: { name: true } } } },
    },
  });
  const ids = students.map((s) => s.id);
  let rows: StudentRow[] = [];
  if (ids.length > 0) {
    const inIds = { in: ids };
    const [attempts, answerChunks, live, watches, completed] = await Promise.all([
      prisma.attempt.groupBy({ by: ["studentId", "dppId", "testId"], where: { studentId: inIds, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } }, _count: { _all: true } }),
      // Counted in the database: a student can have thousands of answers.
      Promise.all(
        chunk(ids, 5000).map(
          (part) => prisma.$queryRaw<Array<{ studentId: string; answered: bigint; correct: bigint }>>`
            SELECT a."studentId",
                   COUNT(*) FILTER (WHERE jsonb_typeof(aa."selectedOptionIds") = 'array' AND jsonb_array_length(aa."selectedOptionIds") > 0) AS answered,
                   COUNT(*) FILTER (WHERE jsonb_typeof(aa."selectedOptionIds") = 'array' AND jsonb_array_length(aa."selectedOptionIds") > 0 AND aa."isCorrect" = true) AS correct
            FROM attempt_answers aa JOIN attempts a ON a.id = aa."attemptId"
            WHERE a."studentId" IN (${Prisma.join(part)})
            GROUP BY a."studentId"`
        )
      ),
      prisma.liveClassAttendance.groupBy({ by: ["studentId"], where: { studentId: inIds }, _count: { _all: true }, _sum: { activeDurationSec: true }, _max: { lastSeenAt: true } }),
      missingTableAsEmpty(prisma.videoWatch.groupBy({ by: ["studentId"], where: { studentId: inIds }, _sum: { watchedSec: true }, _max: { lastWatchedAt: true } }), []),
      prisma.lectureProgress.groupBy({ by: ["studentId"], where: { studentId: inIds }, _count: { _all: true } }),
    ]);
    const practice = new Map<string, { dpps: number; tests: number }>();
    for (const a of attempts) {
      const p = practice.get(a.studentId) ?? { dpps: 0, tests: 0 };
      if (a.dppId) p.dpps += 1;
      if (a.testId) p.tests += 1;
      practice.set(a.studentId, p);
    }
    const answers = new Map(answerChunks.flat().map((a) => [a.studentId, a]));
    const liveBy = new Map(live.map((l) => [l.studentId, l]));
    const watchBy = new Map(watches.map((w) => [w.studentId, w]));
    const doneBy = new Map(completed.map((c) => [c.studentId, c._count._all]));

    rows = students.map<StudentRow>((s) => {
      const ans = answers.get(s.id);
      const l = liveBy.get(s.id);
      const w = watchBy.get(s.id);
      const last =
        [s.user.lastLoginAt, l?._max.lastSeenAt ?? null, w?._max.lastWatchedAt ?? null]
          .filter((d): d is Date => Boolean(d))
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      return {
        studentId: s.id,
        name: s.user.name,
        email: s.user.email,
        code: s.studentIdCode,
        batches: s.batchEnrollments.map((e) => e.batch.name),
        dppsAttempted: practice.get(s.id)?.dpps ?? 0,
        testsAttempted: practice.get(s.id)?.tests ?? 0,
        questionsAnswered: Number(ans?.answered ?? 0),
        questionsCorrect: Number(ans?.correct ?? 0),
        liveClasses: l?._count._all ?? 0,
        liveMinutes: Math.round((l?._sum.activeDurationSec ?? 0) / 60),
        recordedMinutes: Math.round((w?._sum.watchedSec ?? 0) / 60),
        lecturesCompleted: doneBy.get(s.id) ?? 0,
        lastActiveAt: last,
      };
    });
  }

  const activity = opts.activity ?? "all";
  const filtered = rows.filter((r) => matchesActivity(r.lastActiveAt, activity));
  // Top performers first by default: most questions answered correctly.
  const sortKey = pickSort(STUDENT_SORT, opts.sort, "correct");
  const sorted = sortRows(filtered, STUDENT_SORT, sortKey, opts.dir ?? "desc");
  const skip = opts.skip ?? 0;
  const take = Math.min(opts.take ?? 50, 200);
  return { total: filtered.length, rows: sorted.slice(skip, skip + take), sort: sortKey };
}

/** Batches for the students filter. */
export async function batchOptions() {
  return prisma.batch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function studentPerformanceDetail(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      studentIdCode: true,
      enrollmentNumber: true,
      user: { select: { name: true, email: true, lastLoginAt: true } },
      batchEnrollments: { select: { status: true, batch: { select: { id: true, name: true } } } },
    },
  });
  if (!student) return null;

  const [attempts, live, watches] = await Promise.all([
    prisma.attempt.findMany({
      where: { studentId },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        dpp: { select: { id: true, name: true, subject: true, chapter: true, level: true, _count: { select: { questions: true } } } },
        test: { select: { id: true, name: true } },
        answers: { select: { selectedOptionIds: true, isCorrect: true, timeTakenSec: true } },
      },
    }),
    prisma.liveClassAttendance.findMany({
      where: { studentId },
      orderBy: { joinedAt: "desc" },
      select: {
        joinedAt: true,
        activeDurationSec: true,
        interactionCount: true,
        whiteboardSession: {
          select: { title: true, actualStartedAt: true, actualEndedAt: true, batchSchedule: { select: { title: true, subject: true, startsAt: true } } },
        },
      },
    }),
    missingTableAsEmpty(prisma.videoWatch.findMany({
      where: { studentId },
      orderBy: { lastWatchedAt: "desc" },
      select: {
        watchedSec: true,
        durationSec: true,
        lastWatchedAt: true,
        firstWatchedAt: true,
        lecture: { select: { title: true, chapter: { select: { title: true, subject: { select: { title: true } } } } } },
        batchSchedule: { select: { title: true, subject: true } },
      },
    }), []),
  ]);

  const practice = attempts.map((a) => {
    const answered = a.answers.filter((x) => isAnswered(x.selectedOptionIds));
    const correct = answered.filter((x) => x.isCorrect === true).length;
    const wrong = answered.filter((x) => x.isCorrect === false).length;
    const totalQuestions = a.dpp ? a.dpp._count.questions : a.answers.length;
    return {
      kind: a.dpp ? ("DPP" as const) : ("TEST" as const),
      title: a.dpp?.name ?? a.test?.name ?? "—",
      subject: a.dpp?.subject ?? null,
      chapter: a.dpp?.chapter ?? null,
      status: a.status,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      score: a.score,
      totalQuestions,
      answered: answered.length,
      notAnswered: Math.max(0, totalQuestions - answered.length),
      correct,
      wrong,
      timeSec: a.answers.reduce((n, x) => n + (x.timeTakenSec || 0), 0),
    };
  });

  const liveClasses = live.map((l) => {
    const s = l.whiteboardSession;
    const classMin = s.actualStartedAt && s.actualEndedAt ? Math.round((s.actualEndedAt.getTime() - s.actualStartedAt.getTime()) / 60_000) : null;
    return {
      title: s.batchSchedule?.title ?? s.title,
      subject: s.batchSchedule?.subject ?? null,
      date: s.actualStartedAt ?? s.batchSchedule?.startsAt ?? l.joinedAt,
      minutesPresent: Math.round(l.activeDurationSec / 60),
      classMinutes: classMin,
      interactions: l.interactionCount,
    };
  });

  const recorded = watches.map((w) => ({
    title: w.lecture?.title ?? w.batchSchedule?.title ?? "—",
    subject: w.lecture?.chapter.subject.title ?? w.batchSchedule?.subject ?? null,
    chapter: w.lecture?.chapter.title ?? null,
    minutesWatched: Math.round(w.watchedSec / 60),
    videoMinutes: w.durationSec ? Math.round(w.durationSec / 60) : null,
    percent: w.durationSec ? Math.min(100, Math.round((w.watchedSec / w.durationSec) * 100)) : null,
    firstWatchedAt: w.firstWatchedAt,
    lastWatchedAt: w.lastWatchedAt,
  }));

  return {
    student: {
      id: student.id,
      name: student.user.name,
      email: student.user.email,
      code: student.studentIdCode,
      enrollmentNumber: student.enrollmentNumber,
      lastLoginAt: student.user.lastLoginAt,
      batches: student.batchEnrollments.map((e) => ({ id: e.batch.id, name: e.batch.name, status: e.status })),
    },
    totals: {
      dpps: practice.filter((p) => p.kind === "DPP").length,
      tests: practice.filter((p) => p.kind === "TEST").length,
      questionsAnswered: practice.reduce((n, p) => n + p.answered, 0),
      questionsLeft: practice.reduce((n, p) => n + p.notAnswered, 0),
      correct: practice.reduce((n, p) => n + p.correct, 0),
      wrong: practice.reduce((n, p) => n + p.wrong, 0),
      liveClasses: liveClasses.length,
      liveMinutes: liveClasses.reduce((n, l) => n + l.minutesPresent, 0),
      recordedMinutes: recorded.reduce((n, r) => n + r.minutesWatched, 0),
    },
    practice,
    liveClasses,
    recorded,
  };
}
