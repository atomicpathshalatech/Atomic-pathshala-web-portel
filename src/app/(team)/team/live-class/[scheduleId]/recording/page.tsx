import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { RecordingPlayer } from "@/components/live-class/RecordingPlayer";

export const metadata: Metadata = {
  title: "Class Recording — Atomic Pathshala",
};

/**
 * Teacher-side recording playback — previously the only "Watch Recorded
 * Video" link teachers saw (on /team/my-schedule) pointed at the
 * student-only /live-class/[id] route, which silently redirected any
 * teacher back to /team via requireStudentSession(). The recording API and
 * RecordingPlayer component were already role-agnostic; this route is the
 * missing teacher-side page for them, gated by the same
 * assigned-teacher-or-admin check the live room page itself uses.
 */
export default async function TeacherRecordingPage({
  params,
}: {
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!canAccess) redirect("/team");

  const { scheduleId } = await Promise.resolve(params);
  if (!scheduleId) notFound();

  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    include: { batch: true, liveWhiteboardSession: true },
  });
  if (!schedule) notFound();

  if (!schedule.isTest) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    const assignedViaSchedule = teacher ? schedule.teacherId === teacher.id : false;
    const assignedViaBatch =
      teacher && !assignedViaSchedule
        ? await prisma.batchTeacher.findFirst({ where: { batchId: schedule.batchId, teacherId: teacher.id } })
        : null;
    const isAdminOverride = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    if (!assignedViaSchedule && !assignedViaBatch && !isAdminOverride) {
      redirect("/team/my-schedule");
    }
  }

  if (!schedule.liveWhiteboardSession) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <span className="material-symbols-outlined text-4xl text-gray-400">videocam_off</span>
        <p className="mt-3 text-sm font-semibold text-gray-500">This class was never started, so there's no recording.</p>
        <Link href="/team/my-schedule" className="inline-block mt-4 text-xs font-bold text-blue-600 hover:underline">
          Back to My Schedule
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{schedule.title}</h1>
          <p className="text-xs text-gray-500">{schedule.batch?.name}</p>
        </div>
        <Link
          href="/team/my-schedule"
          className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ← Back to Schedule
        </Link>
      </div>
      <RecordingPlayer whiteboardSessionId={schedule.liveWhiteboardSession.id} />
    </div>
  );
}
