import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TeacherLiveClassRoom } from "@/components/live-class/TeacherLiveClassRoom";

export const metadata: Metadata = {
  title: "Live Class",
};

/**
 * Teacher-side entry point for one scheduled class's live whiteboard. This
 * page only resolves "should this teacher even see the room shell" —
 * ownership is re-checked independently (and authoritatively) by every API
 * call the room makes, via resolveTeacherForSchedule/resolveWhiteboardAccess
 * in src/lib/whiteboard/access.ts. This page-level check exists purely so a
 * teacher who isn't assigned gets redirected instead of staring at a room
 * that immediately 403s on every action.
 */
export default async function TeacherLiveClassPage({
  params,
}: {
  params: { scheduleId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!canAccess) redirect("/team");

  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: params.scheduleId },
    include: { batch: true },
  });
  if (!schedule) notFound();

  if (schedule.type !== "LIVE_CLASS") {
    redirect(`/team/batches/${schedule.batchId}`);
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

  return (
    <TeacherLiveClassRoom
      batchScheduleId={schedule.id}
      scheduleTitle={schedule.title}
      batchName={schedule.batch.name}
      currentUserId={session.user.id}
      endsAt={schedule.endsAt.toISOString()}
    />
  );
}
