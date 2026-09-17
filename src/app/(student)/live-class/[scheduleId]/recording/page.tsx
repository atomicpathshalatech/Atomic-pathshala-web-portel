import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { RecordingPlayer } from "@/components/live-class/RecordingPlayer";

export const metadata: Metadata = {
  title: "Class Recording — Atomic Pathshala",
};

/**
 * Student-side full recording player — previously "Play Class" inside
 * CompletedClassModal just toggled a small <video>/<iframe> directly into
 * the popup's own cramped markup instead of opening a real player. This
 * mirrors the existing teacher-side equivalent
 * (team/live-class/[scheduleId]/recording/page.tsx), reusing the same
 * role-agnostic RecordingPlayer component and access-check shape already
 * used by the student live-class entry page.
 */
export default async function StudentRecordingPage({
  params,
}: {
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const { student } = await requireStudentSession();
  const { scheduleId } = await Promise.resolve(params);
  if (!scheduleId) notFound();

  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    include: { batch: true, liveWhiteboardSession: true },
  });
  if (!schedule) notFound();

  const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
  const access = await resolveBatchAccess(student.userId, schedule.batchId);
  if (
    access.status !== "ACTIVE_ENROLLMENT" &&
    access.status !== "ACTIVE_SUBSCRIPTION" &&
    access.status !== "ADMIN_GRANTED"
  ) {
    redirect(`/schedule?blocked=1&reason=${encodeURIComponent("You are not enrolled in this batch.")}`);
  }

  if (!schedule.liveWhiteboardSession) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <span className="material-symbols-outlined text-4xl text-gray-400">videocam_off</span>
        <p className="mt-3 text-sm font-semibold text-gray-500">This class has no recording available.</p>
        <Link href="/schedule" className="inline-block mt-4 text-xs font-bold text-blue-600 hover:underline">
          Back to Schedule
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
          href="/schedule"
          className="text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ← Back to Schedule
        </Link>
      </div>
      <RecordingPlayer whiteboardSessionId={schedule.liveWhiteboardSession.id} />
    </div>
  );
}
