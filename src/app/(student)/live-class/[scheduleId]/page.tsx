import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudentLiveClassRoom } from "@/components/live-class/StudentLiveClassRoom";

export const metadata: Metadata = {
  title: "Live Class",
};

/**
 * Student entry point for a scheduled live class. Ownership (must be
 * ACTIVELY enrolled in the batch this schedule belongs to) is re-checked
 * independently — and authoritatively — by every API call the room makes
 * (see resolveWhiteboardAccess/resolveStudentForSchedule in
 * src/lib/whiteboard/access.ts). This page-level check just avoids showing
 * the room shell to a student who isn't enrolled.
 */
export default async function StudentLiveClassPage({
  params,
}: {
  params: { scheduleId: string };
}) {
  const { student } = await requireStudentSession();

  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: params.scheduleId },
    include: { batch: true, teacher: { include: { user: true } } },
  });
  if (!schedule) notFound();
  if (schedule.type !== "LIVE_CLASS") redirect("/schedule");

  const enrollment = await prisma.batchEnrollment.findFirst({
    where: { studentId: student.id, batchId: schedule.batchId, status: "ACTIVE" },
  });
  if (!enrollment) redirect("/schedule");

  return (
    <StudentLiveClassRoom
      batchScheduleId={schedule.id}
      scheduleTitle={schedule.title}
      batchName={schedule.batch.name}
      teacherName={schedule.teacher?.user.name ?? null}
      currentUserId={student.userId}
    />
  );
}
