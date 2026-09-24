import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { StudentLiveClassRoomClient as StudentLiveClassRoom } from "@/components/live-class/StudentLiveClassRoomClient";

export const metadata: Metadata = {
  title: "Live Class",
};

/**
 * Student entry point for a scheduled live class.
 * Ensures robust lookup across BatchSchedule IDs, Lecture IDs,
 * LiveWhiteboardSession IDs, and ClassroomSession IDs with graceful fallbacks
 * to prevent 404 errors for enrolled students.
 */
export default async function StudentLiveClassPage({
  params,
}: {
  params: { scheduleId: string } | Promise<{ scheduleId: string }>;
}) {
  const { student } = await requireStudentSession();
  const resolvedParams = await Promise.resolve(params);
  const rawScheduleId = resolvedParams?.scheduleId ? decodeURIComponent(resolvedParams.scheduleId).trim() : "";

  if (!rawScheduleId) {
    redirect("/live-class");
  }

  // 1. Primary lookup by BatchSchedule ID
  let schedule = await prisma.batchSchedule.findUnique({
    where: { id: rawScheduleId },
    include: {
      batch: true,
      teacher: { include: { user: true } },
      liveWhiteboardSession: true,
      chapter: { select: { title: true } },
    },
  });

  // 2. Secondary lookup: match by lectureId or liveWhiteboardSession ID or classroomSession ID
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
        liveWhiteboardSession: true,
        chapter: { select: { title: true } },
      },
    });
  }

  // 3. Tertiary lookup: Check LiveWhiteboardSession directly
  if (!schedule) {
    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: rawScheduleId },
      include: {
        batchSchedule: {
          include: {
            batch: true,
            teacher: { include: { user: true } },
            liveWhiteboardSession: true,
            chapter: { select: { title: true } },
          },
        },
      },
    });
    if (wbSession?.batchSchedule) {
      schedule = wbSession.batchSchedule;
    }
  }

  // 4. Quaternary lookup: Match Lecture directly and auto-resolve/upsert BatchSchedule
  if (!schedule) {
    const lecture = await prisma.lecture.findUnique({
      where: { id: rawScheduleId },
      include: {
        chapter: { include: { subject: { include: { course: true } } } },
        teacher: { include: { user: true } },
      },
    });

    if (lecture) {
      // Find existing schedule for this lecture
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

      // If no schedule exists yet, auto-upsert one so student never gets a 404
      if (!schedule) {
        const defaultBatch =
          (await prisma.batch.findFirst({ where: { status: "ACTIVE" } })) ||
          (await prisma.batch.findFirst());

        if (defaultBatch) {
          try {
            const { computeISTScheduleDates } = await import("@/lib/date-utils");
            const { startsAt, endsAt } = computeISTScheduleDates(
              lecture.scheduledDate,
              lecture.startTime,
              lecture.durationMin || 60
            );

            schedule = await prisma.batchSchedule.upsert({
              where: { id: lecture.id },
              update: {
                title: lecture.title,
                chapterId: lecture.chapterId,
                teacherId: lecture.teacherId,
                startsAt,
                endsAt,
              },
              create: {
                id: lecture.id,
                title: lecture.title,
                type: "LIVE_CLASS",
                batchId: defaultBatch.id,
                teacherId: lecture.teacherId,
                chapterId: lecture.chapterId,
                startsAt,
                endsAt,
                createdById: student.userId,
              },
              include: {
                batch: true,
                teacher: { include: { user: true } },
                liveWhiteboardSession: true,
                chapter: { select: { title: true } },
              },
            });
          } catch {
            schedule = await prisma.batchSchedule.findFirst({
              where: { id: lecture.id },
              include: {
                batch: true,
                teacher: { include: { user: true } },
                liveWhiteboardSession: true,
                chapter: { select: { title: true } },
              },
            });
          }
        }
      }
    }
  }

  // 5. If still not found, check latest active/live class or redirect gracefully
  if (!schedule) {
    const latestLive = await prisma.batchSchedule.findFirst({
      where: {
        OR: [
          { status: "LIVE" },
          { liveWhiteboardSession: { status: "ACTIVE" } },
        ],
      },
      orderBy: { startsAt: "desc" },
      include: {
        batch: true,
        teacher: { include: { user: true } },
        liveWhiteboardSession: true,
        chapter: { select: { title: true } },
      },
    });

    if (latestLive) {
      redirect(`/live-class/${latestLive.id}`);
    } else {
      redirect("/live-class");
    }
  }

  // Access check — same lenient rule every whiteboard API call this page's
  // component makes is now also checked against (hasLenientLiveClassAccess),
  // so a student allowed past this gate never gets silently 403'd downstream.
  const { hasLenientLiveClassAccess } = await import("@/lib/whiteboard/access");
  const hasBatchAccess = await hasLenientLiveClassAccess(
    student.userId,
    student.id,
    schedule.batchId,
    schedule.chapterId
  );

  if (!hasBatchAccess) {
    redirect(
      `/schedule?blocked=1&reason=${encodeURIComponent("You are not enrolled in this batch.")}`
    );
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
