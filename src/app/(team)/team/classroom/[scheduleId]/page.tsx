import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TeacherClassroomRoom } from "@/components/classroom/TeacherClassroomRoom";

export const metadata: Metadata = {
  title: "Classroom — Atomic Pathshala",
};

/**
 * Teacher-facing Classroom control page — a NEW, independent route from
 * /team/live-class/[scheduleId] (Whiteboard's teacher room). Never renders
 * or imports Whiteboard's TeacherLiveClassRoom.
 */
export default async function TeacherClassroomPage({
  params,
}: {
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.CLASSROOM_ACCESS);
  if (!canAccess) redirect("/team");

  const { scheduleId } = await Promise.resolve(params);
  if (!scheduleId) notFound();

  const schedule = await prisma.batchSchedule.findUnique({ where: { id: scheduleId }, include: { batch: true } });
  if (!schedule) notFound();
  if (schedule.type !== "LIVE_CLASS") redirect(`/team/batches/${schedule.batchId}?tab=timetable`);

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
  const assignedViaSchedule = teacher ? schedule.teacherId === teacher.id : false;
  const assignedViaBatch =
    teacher && !assignedViaSchedule
      ? await prisma.batchTeacher.findFirst({ where: { batchId: schedule.batchId, teacherId: teacher.id } })
      : null;
  const isAdminOverride = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

  if (!assignedViaSchedule && !assignedViaBatch && !isAdminOverride) {
    redirect("/team");
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <TeacherClassroomRoom scheduleId={schedule.id} currentUserId={session.user.id} title={schedule.title} />
    </div>
  );
}
