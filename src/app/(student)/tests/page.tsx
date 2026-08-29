import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudentTestListClient, type TestListItem } from "@/components/student/StudentTestListClient";

export const metadata: Metadata = {
  title: "Test Portal & AIR Test Series | Atomic Pathshala",
};

function getStatusDetails(
  now: Date,
  startsAt: Date,
  endsAt: Date,
  myAttempt: { status: string; score: number | null } | null
) {
  if (myAttempt) {
    if (myAttempt.status === "IN_PROGRESS") {
      return {
        label: "In Progress",
        tone: "bg-secondary/15 text-secondary border border-secondary/30",
        canAttempt: false,
        canResume: now <= endsAt,
        canViewResult: false,
        isClosed: now > endsAt,
      };
    }
    return {
      label: `Completed · ${myAttempt.score ?? 0} Marks`,
      tone: "bg-primary/15 text-primary border border-primary/30",
      canAttempt: false,
      canResume: false,
      canViewResult: true,
      isClosed: false,
    };
  }
  if (now < startsAt) {
    return {
      label: "Opens Soon",
      tone: "bg-surface-container-high text-on-surface-variant",
      canAttempt: false,
      canResume: false,
      canViewResult: false,
      isClosed: false,
    };
  }
  if (now > endsAt) {
    return {
      label: "Closed",
      tone: "bg-outline-variant/30 text-on-surface-variant",
      canAttempt: false,
      canResume: false,
      canViewResult: false,
      isClosed: true,
    };
  }
  return {
    label: "● Live Now",
    tone: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
    canAttempt: true,
    canResume: false,
    canViewResult: false,
    isClosed: false,
  };
}

export default async function StudentTestsPage() {
  const { student } = await requireStudentSession();

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    select: { batchId: true },
  });
  const batchIds = enrollments.map((e) => e.batchId);

  const tests =
    batchIds.length === 0
      ? []
      : await prisma.test.findMany({
          where: { status: "PUBLISHED", batchSchedule: { batchId: { in: batchIds } } },
          include: {
            batchSchedule: { include: { batch: { select: { name: true } } } },
            sections: { select: { _count: { select: { questions: true } } } },
            attempts: { where: { studentId: student.id }, select: { status: true, score: true } },
          },
          orderBy: { batchSchedule: { startsAt: "asc" } },
        });

  const now = new Date();

  // Standalone TestSeries tests (no batchSchedule) aren't part of this
  // batch-timetable flow yet — filtered out rather than crashing on a null.
  const testList: TestListItem[] = tests
    .filter((t) => t.batchSchedule)
    .map((t) => {
      const batchSchedule = t.batchSchedule!;
      const myAttempt = t.attempts[0] ?? null;
      const st = getStatusDetails(now, batchSchedule.startsAt, batchSchedule.endsAt, myAttempt);
      const questionCount = t.sections.reduce((sum, s) => sum + s._count.questions, 0);

      return {
        id: t.id,
        title: t.name,
        subject: batchSchedule.subject || "General",
        batchName: batchSchedule.batch.name,
        durationMin: t.durationMin,
        questionCount,
        startsAt: batchSchedule.startsAt.toISOString(),
        endsAt: batchSchedule.endsAt.toISOString(),
        statusLabel: st.label,
        tone: st.tone,
        canAttempt: st.canAttempt,
        canResume: st.canResume,
        canViewResult: st.canViewResult,
        isClosed: st.isClosed,
        score: myAttempt?.score,
      };
    });

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
            NTA CBT Standard &middot; Real-Time AIR
          </span>
        </div>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg font-bold text-on-surface">
          Atomic Test Series &amp; Practice Arena
        </h1>
        <p className="text-xs md:text-sm text-on-surface-variant max-w-2xl leading-relaxed">
          Chapter tests, weekly part tests, and full syllabus All-India mock tests with real-time ranking, KaTeX formula solutions, and AI mistake diagnostic.
        </p>
      </header>

      <StudentTestListClient tests={testList} />
    </div>
  );
}
