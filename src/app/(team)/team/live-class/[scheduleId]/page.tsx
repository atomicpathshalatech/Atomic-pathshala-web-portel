import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TeacherLiveClassRoomClient as TeacherLiveClassRoom } from "@/components/live-class/TeacherLiveClassRoomClient";

export const metadata: Metadata = {
  title: "Live Class — Atomic Pathshala",
};

export default async function TeacherLiveClassPage({
  params,
}: {
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!canAccess) redirect("/team");

  const resolvedParams = await Promise.resolve(params);
  const scheduleId = resolvedParams?.scheduleId;
  if (!scheduleId) notFound();

  let schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    include: { batch: true, liveWhiteboardSession: true },
  });

  // If not found by BatchSchedule id, check if it's a Lecture id
  if (!schedule) {
    const lecture = await prisma.lecture.findUnique({
      where: { id: scheduleId },
      include: { chapter: true, teacher: true },
    });

    if (lecture) {
      const defaultBatch =
        (await prisma.batch.findFirst({ where: { status: "ACTIVE" } })) ||
        (await prisma.batch.findFirst());

      if (defaultBatch) {
        // Upsert BatchSchedule for this lecture with accurate IST timing
        try {
          const { computeISTScheduleDates } = await import("@/lib/date-utils");
          const { startsAt, endsAt } = computeISTScheduleDates(
            lecture.scheduledDate,
            lecture.startTime,
            lecture.durationMin || 60
          );

          schedule = await prisma.batchSchedule.upsert({
            where: { id: lecture.id },
            update: {
              title: lecture.title,
              chapterId: lecture.chapterId,
              teacherId: lecture.teacherId,
              startsAt,
              endsAt,
            },
            create: {
              id: lecture.id,
              title: lecture.title,
              type: "LIVE_CLASS",
              batchId: defaultBatch.id,
              teacherId: lecture.teacherId,
              chapterId: lecture.chapterId,
              startsAt,
              endsAt,
              createdById: session.user.id,
            },
            include: { batch: true, liveWhiteboardSession: true },
          });
        } catch {
          schedule = await prisma.batchSchedule.findFirst({
            where: { id: lecture.id },
            include: { batch: true, liveWhiteboardSession: true },
          });
        }
      }
    }
  }

  if (!schedule) notFound();

  // Whiteboard Test Lab room — the caller already passed WHITEBOARD_ACCESS
  // above. A test session has no batch enrollment and no real start time, so
  // the assignment + T-15 gates below don't apply. Strictly gated on
  // `isTest` so a real class can never skip its checks.
  if (schedule.isTest) {
    return (
      <TeacherLiveClassRoom
        batchScheduleId={schedule.id}
        scheduleTitle={schedule.title}
        batchName={schedule.batch?.name || "Whiteboard Test Lab"}
        currentUserId={session.user.id}
        endsAt={schedule.endsAt.toISOString()}
      />
    );
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  const assignedViaSchedule = teacher ? schedule.teacherId === teacher.id : false;
  const assignedViaBatch =
    teacher && !assignedViaSchedule
      ? await prisma.batchTeacher.findFirst({
          where: { batchId: schedule.batchId, teacherId: teacher.id },
        })
      : null;
  const isAdminOverride = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

  if (!assignedViaSchedule && !assignedViaBatch && !isAdminOverride) {
    redirect("/team");
  }

  // Check 15-minute teacher entry window (T-15)
  const { canTeacherEnterClass } = await import("@/lib/schedule/access-rules");
  const teacherEval = canTeacherEnterClass(schedule, new Date());
  if (!teacherEval.allowed) {
    redirect(`/team/my-schedule?blocked=1&reason=${encodeURIComponent(teacherEval.reason || "Pre-class room entry is not open yet.")}`);
  }

  return (
    <TeacherLiveClassRoom
      batchScheduleId={schedule.id}
      scheduleTitle={schedule.title}
      batchName={schedule.batch?.name || "Live Classroom"}
      currentUserId={session.user.id}
      endsAt={schedule.endsAt.toISOString()}
    />
  );
}
