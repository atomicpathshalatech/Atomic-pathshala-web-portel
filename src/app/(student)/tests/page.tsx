import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  AtomicPracticeTestArena,
  type SubjectChapterwiseTests,
  type TestSeriesBoxItem,
} from "@/components/student/AtomicPracticeTestArena";

export const metadata: Metadata = {
  title: "Atomic Test Series | Atomic Pathshala",
};

export default async function StudentTestsPage() {
  const { student } = await requireStudentSession();
  const now = new Date();

  // 1. Fetch Student's Active Batch Enrollments
  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    select: { batchId: true },
  });
  const batchIds = enrollments.map((e) => e.batchId);

  // 2. Fetch All Subjects & Chapters for Category 1: Chapterwise Practice Tests
  let dbSubjects: any[] = [];
  try {
    dbSubjects = await prisma.subject.findMany({
      include: {
        chapters: {
          where: { status: { in: ["PUBLISHED", "READY_TO_PUBLISH", "LECTURES_COMPLETE", "DRAFT"] } },
          include: {
            tests: {
              where: { status: "PUBLISHED" },
              include: {
                attempts: {
                  where: { studentId: student.id },
                  select: { id: true, status: true, score: true },
                },
                sections: {
                  select: { _count: { select: { questions: true } } },
                },
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    // Exclude Mathematics if student is targeting NEET
    const isNeet = !student.targetExam || student.targetExam.toUpperCase().includes("NEET");
    if (isNeet) {
      dbSubjects = dbSubjects.filter(
        (s) => !s.title?.toLowerCase().includes("math")
      );
    }
  } catch (err) {
    console.error("Error fetching subject tests:", err);
  }

  const SUBJECT_CONFIGS: Record<string, { icon: string; color: string; gradient: string }> = {
    Physics: { icon: "bolt", color: "text-blue-500", gradient: "from-blue-600 to-indigo-600" },
    Chemistry: { icon: "science", color: "text-amber-500", gradient: "from-amber-500 to-orange-600" },
    Biology: { icon: "biotech", color: "text-emerald-500", gradient: "from-emerald-500 to-teal-600" },
    Mathematics: { icon: "functions", color: "text-purple-500", gradient: "from-purple-600 to-indigo-600" },
  };

  const subjectTestsMap: Record<string, SubjectChapterwiseTests> = {};

  for (const subj of dbSubjects) {
    const subjName = subj.title || "Physics";
    const config = SUBJECT_CONFIGS[subjName] || {
      icon: "science",
      color: "text-primary",
      gradient: "from-primary to-primary-container",
    };

    const chapters = (subj.chapters || []).map((ch: any, cIdx: number) => {
      const tests = (ch.tests || []).map((t: any) => {
        const attempt = t.attempts?.[0];
        const status: "PENDING" | "IN_PROGRESS" | "COMPLETED" = attempt
          ? attempt.status === "IN_PROGRESS"
            ? "IN_PROGRESS"
            : "COMPLETED"
          : "PENDING";
        const qCount = t.sections?.reduce((sum: number, s: any) => sum + (s._count?.questions || 0), 0) || 15;

        return {
          id: t.id,
          name: t.name,
          durationMin: t.durationMin || 45,
          questionCount: qCount,
          totalMarks: qCount * (t.correctMarks || 4),
          status,
          score: attempt?.score ?? null,
        };
      });

      return {
        id: ch.id || `ch-${cIdx}`,
        chapterNumber: cIdx + 1,
        title: ch.title,
        tests,
      };
    });

    subjectTestsMap[subjName] = {
      id: subj.id,
      name: subjName,
      icon: config.icon,
      color: config.color,
      gradient: config.gradient,
      chapters,
    };
  }

  // 3. Fetch Category 2: Test Series & Batch Test Series Boxes
  let dbTestSeries: any[] = [];
  try {
    dbTestSeries = await prisma.testSeries.findMany({
      include: {
        tests: {
          where: { status: "PUBLISHED" },
          include: {
            attempts: {
              where: { studentId: student.id },
              select: { id: true, status: true, score: true },
            },
            sections: {
              select: { _count: { select: { questions: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("Error fetching test series:", err);
  }

  // Also fetch scheduled batch tests and group them if associated with batch
  let batchSchedules: any[] = [];
  if (batchIds.length > 0) {
    try {
      batchSchedules = await prisma.batchSchedule.findMany({
        where: {
          batchId: { in: batchIds },
          test: { isNot: null },
        },
        include: {
          batch: { select: { id: true, name: true, code: true } },
          test: {
            include: {
              attempts: {
                where: { studentId: student.id },
                select: { id: true, status: true, score: true },
              },
              sections: {
                select: { _count: { select: { questions: true } } },
              },
            },
          },
        },
        orderBy: { startsAt: "asc" },
      });
    } catch (err) {
      console.error("Error fetching batch scheduled tests:", err);
    }
  }

  const testSeriesBoxes: TestSeriesBoxItem[] = [];

  // Map standalone & enrolled TestSeries into boxes
  for (const ts of dbTestSeries) {
    const testsList = (ts.tests || []).map((t: any) => {
      const attempt = t.attempts?.[0];
      const qCount = t.sections?.reduce((sum: number, s: any) => sum + (s._count?.questions || 0), 0) || 15;
      const isCompleted = attempt && attempt.status !== "IN_PROGRESS";
      const inProg = attempt?.status === "IN_PROGRESS";

      return {
        id: t.id,
        name: t.name,
        durationMin: t.durationMin || 180,
        questionCount: qCount,
        totalMarks: qCount * (t.correctMarks || 4),
        statusLabel: isCompleted
          ? `Completed · ${attempt.score ?? 0} Marks`
          : inProg
          ? "In Progress"
          : "Available Now",
        tone: isCompleted
          ? "bg-primary/15 text-primary border border-primary/30"
          : inProg
          ? "bg-secondary/15 text-secondary border border-secondary/30"
          : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
        canAttempt: !isCompleted && !inProg,
        canResume: inProg,
        canViewResult: isCompleted,
        isClosed: false,
        score: attempt?.score ?? null,
      };
    });

    testSeriesBoxes.push({
      id: ts.id,
      code: ts.code,
      name: ts.name,
      examType: ts.examType || "NEET / JEE",
      description: ts.description,
      targetBatch: ts.targetBatch || ts.course || null,
      isEnrolled: true,
      tests: testsList,
    });
  }

  // If batch schedules have tests, group them into Batch Test Series Boxes
  const batchScheduleGroups: Record<string, { batchName: string; batchCode: string; tests: any[] }> = {};
  for (const bs of batchSchedules) {
    if (!bs.test) continue;
    const bId = bs.batchId;
    if (!batchScheduleGroups[bId]) {
      batchScheduleGroups[bId] = {
        batchName: bs.batch.name,
        batchCode: bs.batch.code,
        tests: [],
      };
    }

    const t = bs.test;
    const attempt = t.attempts?.[0];
    const qCount = t.sections?.reduce((sum: number, s: any) => sum + (s._count?.questions || 0), 0) || 15;
    const isCompleted = attempt && attempt.status !== "IN_PROGRESS";
    const inProg = attempt?.status === "IN_PROGRESS";

    batchScheduleGroups[bId].tests.push({
      id: t.id,
      name: t.name || bs.title,
      durationMin: t.durationMin || 180,
      questionCount: qCount,
      totalMarks: qCount * (t.correctMarks || 4),
      statusLabel: isCompleted
        ? `Completed · ${attempt.score ?? 0} Marks`
        : inProg
        ? "In Progress"
        : now < bs.startsAt
        ? "Opens Soon"
        : now > bs.endsAt
        ? "Closed"
        : "Live Now",
      tone: isCompleted
        ? "bg-primary/15 text-primary border border-primary/30"
        : inProg
        ? "bg-secondary/15 text-secondary border border-secondary/30"
        : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
      canAttempt: !isCompleted && !inProg && now >= bs.startsAt && now <= bs.endsAt,
      canResume: inProg && now <= bs.endsAt,
      canViewResult: isCompleted,
      isClosed: now > bs.endsAt,
      score: attempt?.score ?? null,
      startsAt: bs.startsAt?.toISOString(),
      endsAt: bs.endsAt?.toISOString(),
    });
  }

  for (const [bId, group] of Object.entries(batchScheduleGroups)) {
    testSeriesBoxes.push({
      id: `batch-ts-${bId}`,
      code: group.batchCode,
      name: `${group.batchName} — Scheduled Test Series`,
      examType: "Batch Series",
      description: "Official scheduled test papers and mock assessments for your batch.",
      targetBatch: group.batchName,
      isEnrolled: true,
      tests: group.tests,
    });
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <header className="space-y-1.5 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-50 text-orange-600 border border-orange-200">
            NTA CBT STANDARD &middot; ATOMIC TEST SERIES
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Atomic Test Series
        </h1>
        <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
          Chapterwise practice tests categorized automatically by batch subjects, plus enrolled All-India Test Series with direct PDF downloads, instant solutions and rank analytics.
        </p>
      </header>

      {/* 2-Category Interactive Arena */}
      <AtomicPracticeTestArena
        subjectTests={Object.values(subjectTestsMap)}
        testSeriesBoxes={testSeriesBoxes}
      />
    </div>
  );
}
