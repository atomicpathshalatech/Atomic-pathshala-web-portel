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
      userId: true,
      user: { select: { name: true, email: true, lastLoginAt: true } },
      batchEnrollments: { select: { status: true, batch: { select: { id: true, name: true } } } },
    },
  });
  if (!student) return null;
  const activeBatchIds = student.batchEnrollments.filter((e) => e.status === "ACTIVE").map((e) => e.batch.id);
  const now = new Date();

  const [attempts, live, watches, heldClasses, guruAttempts, recordedAvailable] = await Promise.all([
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
          select: {
            title: true,
            actualStartedAt: true,
            actualEndedAt: true,
            batchSchedule: {
              select: { id: true, title: true, subject: true, startsAt: true, teacher: { select: { id: true, displayName: true, user: { select: { name: true } } } } },
            },
          },
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
        lecture: {
          select: {
            title: true,
            teacher: { select: { id: true, displayName: true, user: { select: { name: true } } } },
            chapter: { select: { title: true, subject: { select: { title: true } } } },
          },
        },
        batchSchedule: { select: { title: true, subject: true } },
      },
    }), []),
    // Every live class of the student's batches that has already taken place (the "out of" for attendance).
    activeBatchIds.length
      ? prisma.batchSchedule.findMany({
          where: { batchId: { in: activeBatchIds }, type: "LIVE_CLASS", isTest: false, endsAt: { lt: now }, status: { not: "CANCELLED" } },
          orderBy: { startsAt: "desc" },
          select: {
            id: true,
            title: true,
            subject: true,
            startsAt: true,
            teacher: { select: { id: true, displayName: true, user: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    // Atomic Guru quizzes the student generated and took.
    missingTableAsEmpty(prisma.quizAttempt.findMany({
      where: { userId: student.userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        subject: true,
        topic: true,
        totalQuestions: true,
        correct: true,
        wrong: true,
        unattempted: true,
        score: true,
        accuracy: true,
        timeTakenSec: true,
        createdAt: true,
        quiz: { select: { quizCode: true, sourceModule: true, chapter: true, difficulty: true } },
      },
    }), []),
    // Recorded lectures this student is allowed to watch (chapters they were ticked for).
    missingTableAsEmpty(
      prisma.recordedChapterViewer.findMany({ where: { studentId }, select: { chapterId: true } }).then((rows) =>
        rows.length
          ? prisma.lecture.count({ where: { chapterId: { in: Array.from(new Set(rows.map((r) => r.chapterId))) }, recordedMedia: { uploadStatus: "READY" } } })
          : 0
      ),
      0
    ),
  ]);
  const teacherName = (t: { displayName: string | null; user: { name: string } | null } | null | undefined) => t?.displayName || t?.user?.name || "—";

  const practice = attempts.map((a) => {
    const answered = a.answers.filter((x) => isAnswered(x.selectedOptionIds));
    const correct = answered.filter((x) => x.isCorrect === true).length;
    const wrong = answered.filter((x) => x.isCorrect === false).length;
    const totalQuestions = a.dpp ? a.dpp._count.questions : a.answers.length;
    return {
      attemptId: a.id,
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
    const minutesPresent = Math.round(l.activeDurationSec / 60);
    return {
      scheduleId: s.batchSchedule?.id ?? null,
      title: s.batchSchedule?.title ?? s.title,
      subject: s.batchSchedule?.subject ?? null,
      teacher: teacherName(s.batchSchedule?.teacher),
      date: s.actualStartedAt ?? s.batchSchedule?.startsAt ?? l.joinedAt,
      minutesPresent,
      classMinutes: classMin,
      percent: classMin ? Math.min(100, Math.round((minutesPresent / classMin) * 100)) : null,
      interactions: l.interactionCount,
    };
  });

  // Classes held for the student's batches vs attended — overall and per teacher.
  const attendedIds = new Set(liveClasses.map((l) => l.scheduleId).filter(Boolean));
  const missedClasses = heldClasses
    .filter((c) => !attendedIds.has(c.id))
    .map((c) => ({ title: c.title, subject: c.subject, teacher: teacherName(c.teacher), date: c.startsAt }));
  const byTeacher = new Map<string, { teacher: string; held: number; attended: number; percentSum: number; percentCount: number; recordedMinutes: number; recordedCount: number }>();
  const teacherRow = (name: string) => {
    let row = byTeacher.get(name);
    if (!row) {
      row = { teacher: name, held: 0, attended: 0, percentSum: 0, percentCount: 0, recordedMinutes: 0, recordedCount: 0 };
      byTeacher.set(name, row);
    }
    return row;
  };
  for (const c of heldClasses) teacherRow(teacherName(c.teacher)).held += 1;
  for (const l of liveClasses) {
    const row = teacherRow(l.teacher);
    row.attended += 1;
    if (l.percent !== null) {
      row.percentSum += l.percent;
      row.percentCount += 1;
    }
  }

  const recorded = watches.map((w) => ({
    teacher: w.lecture ? teacherName(w.lecture.teacher) : null,
    title: w.lecture?.title ?? w.batchSchedule?.title ?? "—",
    subject: w.lecture?.chapter.subject.title ?? w.batchSchedule?.subject ?? null,
    chapter: w.lecture?.chapter.title ?? null,
    minutesWatched: Math.round(w.watchedSec / 60),
    videoMinutes: w.durationSec ? Math.round(w.durationSec / 60) : null,
    percent: w.durationSec ? Math.min(100, Math.round((w.watchedSec / w.durationSec) * 100)) : null,
    firstWatchedAt: w.firstWatchedAt,
    lastWatchedAt: w.lastWatchedAt,
  }));

  for (const r of recorded) {
    if (!r.teacher) continue;
    const row = teacherRow(r.teacher);
    row.recordedMinutes += r.minutesWatched;
    row.recordedCount += 1;
  }
  const teachers = Array.from(byTeacher.values())
    .map((t) => ({
      teacher: t.teacher,
      held: t.held,
      attended: t.attended,
      attendancePercent: t.held ? Math.round((Math.min(t.attended, t.held) / t.held) * 100) : null,
      avgPresentPercent: t.percentCount ? Math.round(t.percentSum / t.percentCount) : null,
      recordedCount: t.recordedCount,
      recordedMinutes: t.recordedMinutes,
    }))
    .sort((a, b) => b.held + b.recordedCount - (a.held + a.recordedCount));

  const guruQuizzes = guruAttempts.map((q) => ({
    id: q.id,
    code: q.quiz?.quizCode ?? null,
    source: q.quiz?.sourceModule ?? null,
    subject: q.subject,
    chapter: q.quiz?.chapter ?? null,
    topic: q.topic,
    difficulty: q.quiz?.difficulty ?? null,
    totalQuestions: q.totalQuestions,
    correct: q.correct,
    wrong: q.wrong,
    unattempted: q.unattempted,
    accuracy: q.accuracy,
    score: q.score,
    timeSec: q.timeTakenSec,
    date: q.createdAt,
  }));

  const recordedCompleted = recorded.filter((r) => (r.percent ?? 0) >= 90).length;
  const attendedHeld = heldClasses.filter((c) => attendedIds.has(c.id)).length;

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
      classesHeld: heldClasses.length,
      classesAttended: attendedHeld,
      classesMissed: heldClasses.length - attendedHeld,
      attendancePercent: heldClasses.length ? Math.round((attendedHeld / heldClasses.length) * 100) : null,
      avgPresentPercent: (() => {
        const ps = liveClasses.map((l) => l.percent).filter((x): x is number => x !== null);
        return ps.length ? Math.round(ps.reduce((n, x) => n + x, 0) / ps.length) : null;
      })(),
      recordedAvailable,
      recordedWatched: recorded.filter((r) => r.minutesWatched > 0).length,
      recordedCompleted,
      guruQuizzes: guruQuizzes.length,
      guruAccuracy: guruQuizzes.length ? Math.round(guruQuizzes.reduce((n, q) => n + q.accuracy, 0) / guruQuizzes.length) : null,
    },
    practice,
    liveClasses,
    missedClasses,
    teachers,
    recorded,
    guruQuizzes,
  };
}

type ReviewOption = { id: string; text: string };

/** Options stored as ["…"], [{id,text}] or [{key,label}] — one shape for the review page. */
function normaliseOptions(raw: unknown): ReviewOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o, i) => {
    const letter = String.fromCharCode(65 + i);
    if (typeof o === "string") return { id: letter, text: o };
    const r = (o ?? {}) as Record<string, unknown>;
    return { id: String(r.id ?? r.key ?? letter), text: String(r.text ?? r.label ?? r.value ?? "") };
  });
}

function idList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw === "string" && raw) return [raw];
  return [];
}

/**
 * One DPP / test attempt of a student, question by question: the question,
 * its options, what the student chose, the right answer, right / wrong / not
 * answered, and the time spent. A DPP lists all its questions (also the ones
 * never opened); a test lists the questions the student reached.
 */
export async function studentAttemptReview(studentId: string, attemptId: string) {
  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      score: true,
      student: { select: { id: true, studentIdCode: true, user: { select: { name: true } } } },
      dpp: {
        select: {
          name: true,
          subject: true,
          chapter: true,
          questions: { orderBy: { order: "asc" }, select: { questionId: true } },
        },
      },
      test: { select: { name: true } },
      answers: { select: { questionId: true, selectedOptionIds: true, isCorrect: true, timeTakenSec: true } },
    },
  });
  if (!attempt) return null;

  const order = attempt.dpp ? attempt.dpp.questions.map((q) => q.questionId) : attempt.answers.map((a) => a.questionId);
  const questionIds = Array.from(new Set([...order, ...attempt.answers.map((a) => a.questionId)]));
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      imageUrl: true,
      solution: true,
      translations: { select: { language: true, statement: true, options: true, correctOptionIds: true, solution: true } },
    },
  });
  const qById = new Map(questions.map((q) => [q.id, q]));
  const aById = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const rows = questionIds.map((id, i) => {
    const q = qById.get(id);
    const t = q?.translations.find((x) => /^en/i.test(x.language)) ?? q?.translations[0];
    const a = aById.get(id);
    const answered = isAnswered(a?.selectedOptionIds);
    return {
      number: i + 1,
      questionId: id,
      statement: t?.statement ?? "(question text not available)",
      imageUrl: q?.imageUrl ?? null,
      options: normaliseOptions(t?.options),
      correctOptionIds: idList(t?.correctOptionIds),
      chosenOptionIds: idList(a?.selectedOptionIds),
      result: !answered
        ? ("NOT_ANSWERED" as const)
        : a?.isCorrect === true
        ? ("CORRECT" as const)
        : a?.isCorrect === false
        ? ("WRONG" as const)
        : ("UNCHECKED" as const),
      timeSec: a?.timeTakenSec ?? 0,
      solution: t?.solution ?? q?.solution ?? null,
    };
  });

  return {
    attemptId: attempt.id,
    kind: attempt.dpp ? ("DPP" as const) : ("TEST" as const),
    title: attempt.dpp?.name ?? attempt.test?.name ?? "—",
    subject: attempt.dpp?.subject ?? null,
    chapter: attempt.dpp?.chapter ?? null,
    status: attempt.status as string,
    date: attempt.submittedAt ?? attempt.startedAt,
    score: attempt.score,
    student: { id: attempt.student.id, name: attempt.student.user?.name ?? "Student", code: attempt.student.studentIdCode },
    summary: {
      total: rows.length,
      correct: rows.filter((r) => r.result === "CORRECT").length,
      wrong: rows.filter((r) => r.result === "WRONG").length,
      notAnswered: rows.filter((r) => r.result === "NOT_ANSWERED").length,
    },
    rows,
  };
}

/** One Atomic Guru quiz the student took, question by question (saved with the attempt). */
export async function studentGuruQuizReview(studentId: string, quizAttemptId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true, studentIdCode: true, user: { select: { name: true } } },
  });
  if (!student) return null;
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: quizAttemptId, userId: student.userId },
    select: {
      id: true,
      subject: true,
      topic: true,
      totalQuestions: true,
      correct: true,
      wrong: true,
      unattempted: true,
      accuracy: true,
      score: true,
      timeTakenSec: true,
      createdAt: true,
      quiz: {
        select: {
          quizCode: true,
          sourceModule: true,
          chapter: true,
          difficulty: true,
          questions: {
            orderBy: { order: "asc" },
            select: { questionId: true, text: true, options: true, correctIndex: true, explanation: true, solution: true },
          },
        },
      },
      answers: {
        orderBy: { answeredAt: "asc" },
        select: {
          questionId: true,
          selectedIndex: true,
          selectedAnswer: true,
          correctAnswer: true,
          isCorrect: true,
          timeTakenSec: true,
          questionText: true,
          options: true,
          solution: true,
        },
      },
    },
  });
  if (!attempt) return null;

  const answerBy = new Map(attempt.answers.map((a) => [a.questionId, a]));
  // The quiz's own questions while it exists (also the unanswered ones), else what the answers saved.
  const base = attempt.quiz?.questions.length
    ? attempt.quiz.questions.map((q) => ({
        questionId: q.questionId,
        text: q.text,
        options: q.options as unknown,
        correctIndex: q.correctIndex as number | null,
        solution: q.solution ?? q.explanation,
      }))
    : attempt.answers.map((a) => ({
        questionId: a.questionId,
        text: a.questionText ?? "",
        options: a.options as unknown,
        correctIndex: null as number | null,
        solution: a.solution,
      }));

  const rows = base.map((q, i) => {
    const a = answerBy.get(q.questionId);
    const options = normaliseOptions(q.options);
    const correctId =
      q.correctIndex !== null && q.correctIndex >= 0
        ? options[q.correctIndex]?.id ?? null
        : options.find((o) => o.text === a?.correctAnswer)?.id ?? null;
    const chosenId =
      a && a.selectedIndex !== null && a.selectedIndex >= 0
        ? options[a.selectedIndex]?.id ?? null
        : options.find((o) => o.text === a?.selectedAnswer)?.id ?? null;
    const answered = Boolean(a && (chosenId || a.selectedAnswer));
    return {
      number: i + 1,
      questionId: q.questionId,
      statement: q.text || a?.questionText || "(question text not available)",
      imageUrl: null as string | null,
      options,
      correctOptionIds: correctId ? [correctId] : [],
      chosenOptionIds: chosenId ? [chosenId] : [],
      result: !answered ? ("NOT_ANSWERED" as const) : a?.isCorrect ? ("CORRECT" as const) : ("WRONG" as const),
      timeSec: a?.timeTakenSec ?? 0,
      solution: q.solution ?? null,
    };
  });

  return {
    attemptId: attempt.id,
    kind: "GURU" as const,
    title: [attempt.subject, attempt.quiz?.chapter, attempt.topic].filter(Boolean).join(" · ") || "Atomic Guru quiz",
    subject: attempt.subject,
    chapter: attempt.quiz?.chapter ?? null,
    status: [attempt.quiz?.sourceModule, attempt.quiz?.quizCode, attempt.quiz?.difficulty].filter(Boolean).join(" · "),
    date: attempt.createdAt,
    score: attempt.score,
    student: { id: student.id, name: student.user?.name ?? "Student", code: student.studentIdCode },
    summary: { total: attempt.totalQuestions, correct: attempt.correct, wrong: attempt.wrong, notAnswered: attempt.unattempted },
    rows,
  };
}
