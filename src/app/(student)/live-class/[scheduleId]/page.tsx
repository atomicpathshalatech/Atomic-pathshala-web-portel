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
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const { student } = await requireStudentSession();
  const resolvedParams = await Promise.resolve(params);
  const scheduleId = resolvedParams?.scheduleId;

  if (!scheduleId) notFound();

  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      batch: true,
      teacher: { include: { user: true } },
      liveWhiteboardSession: true,
    },
  });
  if (!schedule) notFound();
  if (schedule.type !== "LIVE_CLASS") redirect("/schedule");

  let enrollment = await prisma.batchEnrollment.findFirst({
    where: { studentId: student.id, batchId: schedule.batchId },
  });

  if (enrollment) {
    if (enrollment.status !== "ACTIVE") {
      enrollment = await prisma.batchEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "ACTIVE" },
      });
    }
  } else {
    try {
      enrollment = await prisma.batchEnrollment.create({
        data: {
          studentId: student.id,
          batchId: schedule.batchId,
          status: "ACTIVE",
        },
      });
    } catch {
      // If batch enrollment fails, continue safely
    }
  }

  // Server-authoritative 15-minute access boundary check
  const { canStudentJoin } = await import("@/lib/schedule/access-rules");
  const accessEval = canStudentJoin(schedule, new Date());
  if (!accessEval.allowed) {
    redirect(`/schedule?blocked=1&reason=${encodeURIComponent(accessEval.reason || "Class is not accessible yet.")}`);
  }

  return (
    <StudentLiveClassRoom
      batchScheduleId={schedule.id}
      scheduleTitle={schedule.title}
      batchName={schedule.batch?.name || "Live Classroom"}
      teacherName={schedule.teacher?.user?.name ?? null}
      currentUserId={student.userId}
    />
  );
}
