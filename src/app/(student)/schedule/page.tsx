import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { HorizontalScheduleCalendar, type ScheduleItem, type BatchOption } from "@/components/schedule/HorizontalScheduleCalendar";

export const metadata: Metadata = {
  title: "My Schedule",
};

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: { batch?: string };
}) {
  const { student } = await requireStudentSession();

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    include: {
      batch: {
        include: {
          schedules: {
            orderBy: { startsAt: "asc" },
            include: {
              batch: true,
              teacher: { include: { user: true } },
              liveWhiteboardSession: {
                select: { id: true, status: true, livePhase: true },
              },
            },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  if (enrollments.length === 0) {
    return (
      <div className="max-w-6xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 md:p-10 shadow-sm">
        <header>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Schedule
          </h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1">
            Track your learning journey and classroom timetable.
          </p>
        </header>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-12 text-center text-slate-500 text-xs md:text-sm">
          You are not enrolled in a batch yet — once enrolled, your live timetable, DPPs, and tests will appear here.
        </div>
      </div>
    );
  }

  // Collect unique batches for filter
  const batches: BatchOption[] = enrollments.map((e) => ({
    id: e.batch.id,
    name: e.batch.name,
    code: e.batch.code,
  }));

  // Flatten all schedules WITHOUT filtering out past, completed or cancelled
  const allSchedules: ScheduleItem[] = enrollments
    .flatMap((e) => e.batch.schedules)
    .map((s) => ({
      id: s.id,
      title: s.title,
      subject: s.subject,
      type: s.type,
      status: s.status,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      batchId: s.batchId,
      batch: {
        id: s.batch.id,
        name: s.batch.name,
        code: s.batch.code,
      },
      teacher: s.teacher
        ? {
            id: s.teacher.id,
            user: {
              name: s.teacher.user.name,
              email: s.teacher.user.email,
            },
          }
        : null,
      liveWhiteboardSession: s.liveWhiteboardSession
        ? {
            id: s.liveWhiteboardSession.id,
            status: s.liveWhiteboardSession.status,
            livePhase: s.liveWhiteboardSession.livePhase,
          }
        : null,
    }));

  return (
    <HorizontalScheduleCalendar
      schedules={allSchedules}
      batches={batches}
      role="STUDENT"
      title="My Schedule"
      subtitle={`${enrollments.length} Active Batch${enrollments.length === 1 ? "" : "es"} • Live Classrooms & Tests`}
    />
  );
}
