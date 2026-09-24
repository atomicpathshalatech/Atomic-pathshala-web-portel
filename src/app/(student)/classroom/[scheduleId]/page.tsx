import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudentClassroomRoom } from "@/components/classroom/StudentClassroomRoom";

export const metadata: Metadata = {
  title: "Application Class",
};

/**
 * Student entry point for the new Classroom module — a NEW, independent
 * route from /live-class/[scheduleId] (Whiteboard's student room). Unlike
 * that page, this one does NOT redirect a student away before the T-15 join
 * window: per the Classroom spec, a student should be able to open Classroom
 * any time and see a proper "Class starts at HH:MM" waiting card rather than
 * being bounced back to /schedule — StudentClassroomRoom's own state machine
 * renders every time-based state. Real access (enrollment) is still checked
 * here AND independently, authoritatively, by every API call the room makes
 * (resolveClassroomAccess, backed by resolveBatchAccess) — this check is
 * read-only and never grants access itself.
 */
export default async function StudentClassroomPage({
  params,
}: {
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const { student } = await requireStudentSession();
  const { scheduleId } = await Promise.resolve(params);
  if (!scheduleId) notFound();

  let schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    include: { batch: true, teacher: { include: { user: true } }, chapter: { select: { title: true } } },
  });

  if (!schedule) {
    schedule = await prisma.batchSchedule.findFirst({
      where: {
        OR: [
          { lectureId: scheduleId },
          { liveWhiteboardSession: { id: scheduleId } },
        ],
      },
      include: { batch: true, teacher: { include: { user: true } }, chapter: { select: { title: true } } },
    });
  }

  if (!schedule) notFound();
  if (schedule.type !== "LIVE_CLASS") redirect("/schedule");

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
