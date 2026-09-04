import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TeacherLiveClassRoom } from "@/components/live-class/TeacherLiveClassRoom";

export const metadata: Metadata = {
  title: "Live Classroom Studio — Atomic Pathshala",
};

export default async function TeamLiveStudioPage({
  searchParams,
}: {
  searchParams?: { scheduleId?: string; lectureId?: string; chapterId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
  if (!canAccess) redirect("/team");

  const teacher = await prisma.teacher.findUnique({
    where: { userId: session.user.id },
  });

  const requestedScheduleId = searchParams?.scheduleId || searchParams?.lectureId;

  if (requestedScheduleId) {
    redirect(`/team/live-class/${requestedScheduleId}`);
  }

  // Find active or upcoming live schedule for this teacher
  let schedule = await prisma.batchSchedule.findFirst({
    where: {
      type: "LIVE_CLASS",
      ...(teacher ? { OR: [{ teacherId: teacher.id }, { batch: { teachers: { some: { teacherId: teacher.id } } } }] } : {}),
      status: { in: ["SCHEDULED", "LIVE"] },
    },
    orderBy: { startsAt: "asc" },
    include: { batch: true },
  });

  if (schedule) {
    redirect(`/team/live-class/${schedule.id}`);
  }

  // If no specific schedule found, look for any live class schedule
  schedule = await prisma.batchSchedule.findFirst({
    where: { type: "LIVE_CLASS" },
    orderBy: { createdAt: "desc" },
    include: { batch: true },
  });

  if (schedule) {
    redirect(`/team/live-class/${schedule.id}`);
  }

  // If no schedules exist at all in the system, create a default studio live session
  const defaultBatch =
    (await prisma.batch.findFirst({ where: { status: "ACTIVE" } })) ||
    (await prisma.batch.findFirst());

  if (defaultBatch && teacher) {
    const newSchedule = await prisma.batchSchedule.create({
      data: {
        title: "Live Classroom Studio",
        type: "LIVE_CLASS",
        batchId: defaultBatch.id,
        teacherId: teacher.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
        createdById: session.user.id,
      },
      include: { batch: true },
    });
    redirect(`/team/live-class/${newSchedule.id}`);
  }

  // Fallback to schedule timetable
  redirect("/team/my-schedule");
}
