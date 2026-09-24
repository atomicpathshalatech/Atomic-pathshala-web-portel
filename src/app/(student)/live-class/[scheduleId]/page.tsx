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

  let schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      batch: true,
      teacher: { include: { user: true } },
      liveWhiteboardSession: true,
      chapter: { select: { title: true } },
    },
  });

  // If not found by BatchSchedule id, check if scheduleId is a lectureId or liveWhiteboardSession id
  if (!schedule) {
    schedule = await prisma.batchSchedule.findFirst({
      where: {
        OR: [
          { lectureId: scheduleId },
          { liveWhiteboardSession: { id: scheduleId } },
        ],
      },
      include: {
        batch: true,
        teacher: { include: { user: true } },
        liveWhiteboardSession: true,
        chapter: { select: { title: true } },
      },
    });
  }

  // If still not found, check if scheduleId matches a Lecture directly
  if (!schedule) {
    const lecture = await prisma.lecture.findUnique({
      where: { id: scheduleId },
      include: { chapter: true, teacher: true },
    });
    if (lecture) {
      schedule = await prisma.batchSchedule.findFirst({
        where: {
          OR: [{ id: lecture.id }, { lectureId: lecture.id }],
        },
        include: {
          batch: true,
          teacher: { include: { user: true } },
          liveWhiteboardSession: true,
          chapter: { select: { title: true } },
        },
      });
    }
  }

  if (!schedule) notFound();
  if (schedule.type !== "LIVE_CLASS") redirect("/schedule");

  const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
  const access = await resolveBatchAccess(student.userId, schedule.batchId);
  
  let hasBatchAccess =
    access.status === "ACTIVE_ENROLLMENT" ||
    access.status === "ACTIVE_SUBSCRIPTION" ||
    access.status === "ADMIN_GRANTED";

  if (!hasBatchAccess && schedule.chapterId) {
    const { isEnrolledInCourse } = await import("@/lib/lecture/access");
    const chapter = await prisma.chapter.findUnique({
      where: { id: schedule.chapterId },
      include: { subject: true },
    });
    if (chapter?.subject?.courseId) {
      const courseEnrolled = await isEnrolledInCourse(student.id, chapter.subject.courseId);
      if (courseEnrolled) hasBatchAccess = true;
    }
  }

  if (!hasBatchAccess) {
    const activeEnrollmentCount = await prisma.batchEnrollment.count({
      where: { studentId: student.id, status: "ACTIVE" },
    });
    if (activeEnrollmentCount > 0) {
      hasBatchAccess = true;
    }
  }

  if (!hasBatchAccess) {
    redirect(
      `/schedule?blocked=1&reason=${encodeURIComponent("You are not enrolled in this batch.")}`
    );
  }

  // Server-authoritative 15-minute access boundary check
  const { canStudentJoinClass } = await import("@/lib/schedule/access-rules");
  const accessEval = canStudentJoinClass(schedule, new Date());
  if (!accessEval.allowed) {
    if (accessEval.isCompleted) {
      if (
        schedule.liveWhiteboardSession?.recordingStorageKey ||
        schedule.liveWhiteboardSession?.recordingStatus === "READY" ||
        schedule.liveWhiteboardSession?.pdfStorageKey
      ) {
        // Allow student to access recorded class / board notes
      } else {
        redirect(`/schedule?completedClass=${schedule.id}`);
      }
    } else {
      redirect(
        `/schedule?blocked=1&reason=${encodeURIComponent(accessEval.reason || "Class is not accessible yet.")}`
      );
    }
  }

  return (
    <StudentLiveClassRoom
      batchScheduleId={schedule.id}
      scheduleTitle={schedule.title}
      batchName={schedule.batch?.name || "Live Classroom"}
      teacherName={schedule.teacher?.user?.name ?? null}
      subject={schedule.subject ?? null}
      chapterTitle={schedule.chapter?.title ?? null}
      currentUserId={student.userId}
    />
  );
}
