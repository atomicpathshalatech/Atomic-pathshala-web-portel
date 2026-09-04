import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { HorizontalScheduleCalendar, type ScheduleItem, type BatchOption } from "@/components/schedule/HorizontalScheduleCalendar";

export const metadata: Metadata = {
  title: "My Teaching Schedule",
};

export default async function TeacherMySchedulePage() {
  const { user } = await requireTeamSession();
  const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });

  if (!teacher) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <header>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            My Schedule
          </h1>
        </header>
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500">
          This account does not have a teacher profile, so there is no teaching timetable to show here.
        </div>
      </div>
    );
  }

  // Fetch all schedules for this teacher without filtering out past dates
  const rawSchedules = await prisma.batchSchedule.findMany({
    where: {
      OR: [
        { teacherId: teacher.id },
        { batch: { teachers: { some: { teacherId: teacher.id } } } },
      ],
    },
    orderBy: { startsAt: "asc" },
    include: {
      batch: true,
      teacher: { include: { user: true } },
      liveWhiteboardSession: {
        select: { id: true, status: true, livePhase: true },
      },
    },
  });

  if (rawSchedules.length === 0) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <header>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            My Teaching Schedule
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Every class across the batches you teach, in one place.
          </p>
        </header>
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-12 text-center text-slate-500 text-xs md:text-sm">
          Nothing scheduled for you yet — once a batch adds you to its timetable, your classes will show up here.
        </div>
      </div>
    );
  }

  // Unique batches for filter tab
  const batchMap = new Map<string, BatchOption>();
  for (const s of rawSchedules) {
    if (!batchMap.has(s.batch.id)) {
      batchMap.set(s.batch.id, {
        id: s.batch.id,
        name: s.batch.name,
        code: s.batch.code,
      });
    }
  }
  const batches = Array.from(batchMap.values());

  const allSchedules: ScheduleItem[] = rawSchedules.map((s) => ({
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
      role="TEACHER"
      title="My Teaching Schedule"
      subtitle={`${batches.length} Batch${batches.length === 1 ? "" : "es"} • Manage & Start Live Classrooms`}
    />
  );
}
