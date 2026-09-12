import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudentLiveClassRoomClient as StudentLiveClassRoom } from "@/components/live-class/StudentLiveClassRoomClient";

export const metadata: Metadata = {
  title: "Live Class",
};

/**
 * Student entry point for a scheduled live class. Access (real, existing
 * entitlement to the batch this schedule belongs to — active enrollment,
 * active subscription, or an admin grant) is re-checked independently — and
 * authoritatively — by every API call the room makes (see
 * resolveWhiteboardAccess/resolveStudentForSchedule in
 * src/lib/whiteboard/access.ts, both backed by resolveBatchAccess). This
 * page-level check is read-only and just avoids showing the room shell to a
 * student who has no access — it must never itself grant access by creating
 * an enrollment row.
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

  const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
  const access = await resolveBatchAccess(student.userId, schedule.batchId);
  if (
    access.status !== "ACTIVE_ENROLLMENT" &&
    access.status !== "ACTIVE_SUBSCRIPTION" &&
    access.status !== "ADMIN_GRANTED"
  ) {
    redirect(
      `/schedule?blocked=1&reason=${encodeURIComponent("You are not enrolled in this batch.")}`
    );
  }

  // Server-authoritative 15-minute access boundary check
  const { canStudentJoinClass } = await import("@/lib/schedule/access-rules");
  const accessEval = canStudentJoinClass(schedule, new Date());
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
