import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudentClassroomRoom } from "@/components/classroom/StudentClassroomRoom";

export const metadata: Metadata = {
  title: "Application Class",
};

/**
 * Student entry point for the Classroom module.
 * Provides resilient lookups across Schedule, Lecture, and Session IDs.
 */
export default async function StudentClassroomPage({
  params,
}: {
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const { student } = await requireStudentSession();
  const resolved = await Promise.resolve(params);
  const rawScheduleId = resolved?.scheduleId ? decodeURIComponent(resolved.scheduleId).trim() : "";

  if (!rawScheduleId) {
    redirect("/schedule");
  }

  // 1. Primary lookup by BatchSchedule id
  let schedule = await prisma.batchSchedule.findUnique({
    where: { id: rawScheduleId },
    include: {
      batch: true,
      teacher: { include: { user: true } },
      chapter: { select: { title: true } },
    },
  });

  // 2. Secondary lookup
  if (!schedule) {
    schedule = await prisma.batchSchedule.findFirst({
      where: {
        OR: [
          { id: rawScheduleId },
          { lectureId: rawScheduleId },
          { liveWhiteboardSession: { id: rawScheduleId } },
          { classroomSession: { id: rawScheduleId } },
        ],
      },
      include: {
        batch: true,
        teacher: { include: { user: true } },
        chapter: { select: { title: true } },
      },
    });
  }

  // 3. Match lecture directly
  if (!schedule) {
    const lecture = await prisma.lecture.findUnique({
      where: { id: rawScheduleId },
    });
    if (lecture) {
      schedule = await prisma.batchSchedule.findFirst({
        where: {
          OR: [{ id: lecture.id }, { lectureId: lecture.id }],
        },
        include: {
          batch: true,
          teacher: { include: { user: true } },
          chapter: { select: { title: true } },
        },
      });
    }
  }

  if (!schedule) {
    redirect(`/live-class/${rawScheduleId}`);
  }

  const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
  const access = await resolveBatchAccess(student.userId, schedule.batchId);
  
  let hasAccess =
    access.status === "ACTIVE_ENROLLMENT" ||
    access.status === "ACTIVE_SUBSCRIPTION" ||
    access.status === "ADMIN_GRANTED";

  if (!hasAccess) {
    const activeEnrollmentCount = await prisma.batchEnrollment.count({
      where: { studentId: student.id, status: "ACTIVE" },
    });
    if (activeEnrollmentCount > 0) hasAccess = true;
  }

  if (!hasAccess) {
    redirect(`/schedule?blocked=1&reason=${encodeURIComponent("You are not enrolled in this batch.")}`);
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <StudentClassroomRoom
        batchScheduleId={schedule.id}
        currentUserId={student.userId}
        studentId={student.id}
        teacherName={schedule.teacher?.user?.name ?? "Your teacher"}
        chapterName={schedule.chapter?.title ?? schedule.title}
      />
    </div>
  );
}
