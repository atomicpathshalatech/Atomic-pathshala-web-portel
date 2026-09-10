import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { BatchDetailClient } from "@/components/team-portal/BatchDetailClient";

export const metadata: Metadata = {
  title: "Batch Management & Course Flow",
};

export default async function BatchDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.BATCH_READ);
  if (!canRead) redirect("/team");

  const [canUpdate, canManageEnrollment, canManageSchedule] = await Promise.all([
    hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE),
    hasPermission(session.user.id, PERMISSIONS.BATCH_ENROLLMENT_MANAGE),
    hasPermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE),
  ]);

  const batch = await prisma.batch.findUnique({
    where: { id: params.id },
    include: {
      course: { select: { id: true, title: true } },
      teachers: { include: { teacher: { include: { user: true } } } },
      enrollments: {
        include: { student: { include: { user: true } } },
        orderBy: { enrolledAt: "desc" },
      },
      schedules: {
        // The chapter rides along because the Content tab lists the chapters
        // imported into this batch, and a batch only knows its chapters
        // through the schedules that reference them — there is no direct
        // Batch → Chapter relation.
        include: {
          teacher: { include: { user: true } },
          chapter: {
            select: {
              id: true,
              chapterId: true,
              title: true,
              status: true,
              subject: { select: { title: true } },
              _count: { select: { lectures: true, dpps: true, tests: true } },
            },
          },
        },
        orderBy: { startsAt: "asc" },
      },
    },
  });
  if (!batch) notFound();

  /**
   * Material for the "All PDFs" tab.
   *
   * Nothing here is uploaded by hand — every entry already exists elsewhere
   * and is simply gathered per batch:
   *   class notes  → the PDF the whiteboard pipeline produces when a live
   *                  class ends (WhiteboardSession.pdfStatus = READY)
   *   DPPs / tests → whatever hangs off the chapters imported into this batch
   *
   * A batch reaches its chapters only through its schedules, so the chapter
   * ids are derived first and then reused for both lookups.
   */
  const scheduleIds = batch.schedules.map((s) => s.id);
  const importedChapterIds = Array.from(
    new Set(batch.schedules.map((s) => s.chapterId).filter((id): id is string => Boolean(id)))
  );

  const [allTeachers, allStudents, classNoteSessions, chapterDpps, chapterTests] = await Promise.all([
    canUpdate
      ? prisma.teacher.findMany({
          select: { id: true, employeeCode: true, department: true, user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canManageEnrollment
      ? prisma.student.findMany({
          select: {
            id: true,
            enrollmentNumber: true,
            class: true,
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
      : Promise.resolve([]),

    scheduleIds.length
      ? prisma.whiteboardSession.findMany({
          where: { batchScheduleId: { in: scheduleIds }, pdfStatus: "READY" },
          select: {
            id: true,
            title: true,
            endedAt: true,
            batchSchedule: { select: { subject: true, title: true, startsAt: true } },
          },
          orderBy: { endedAt: "desc" },
        })
      : Promise.resolve([]),

    importedChapterIds.length
      ? prisma.dpp.findMany({
          where: { chapterId: { in: importedChapterIds } },
          select: {
            id: true,
            code: true,
            name: true,
            subject: true,
            chapter: true,
            status: true,
            questionTargetCount: true,
          },
          orderBy: [{ subject: "asc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),

    importedChapterIds.length
      ? prisma.test.findMany({
          where: { chapterId: { in: importedChapterIds }, archived: false },
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            durationMin: true,
            testSeries: { select: { id: true, name: true } },
            chapter: { select: { title: true, subject: { select: { title: true } } } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <BatchDetailClient
      batch={{
        id: batch.id,
        name: batch.name,
        code: batch.code,
        description: batch.description,
        targetExam: batch.targetExam,
        status: batch.status,
        startDate: batch.startDate ? batch.startDate.toISOString() : null,
        endDate: batch.endDate ? batch.endDate.toISOString() : null,
        capacity: batch.capacity,
        course: batch.course,
      }}
      teachers={batch.teachers.map((t) => ({
        id: t.id,
        teacherId: t.teacherId,
        subject: t.subject,
        teacher: {
          employeeCode: t.teacher.employeeCode,
          department: t.teacher.department,
          user: { name: t.teacher.user.name },
        },
      }))}
      enrollments={batch.enrollments.map((e) => ({
        id: e.id,
        studentId: e.studentId,
        status: e.status,
        enrolledAt: e.enrolledAt.toISOString(),
        student: {
          enrollmentNumber: e.student.enrollmentNumber,
          class: e.student.class,
          targetExam: e.student.targetExam,
          user: { name: e.student.user.name, email: e.student.user.email },
        },
      }))}
      schedules={batch.schedules.map((s) => ({
        id: s.id,
        title: s.title,
        subject: s.subject,
        type: s.type,
        status: s.status,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        notes: s.notes,
        teacherId: s.teacherId,
        teacher: s.teacher ? { user: { name: s.teacher.user.name } } : null,
        chapter: s.chapter
          ? {
              id: s.chapter.id,
              chapterId: s.chapter.chapterId,
              title: s.chapter.title,
              status: s.chapter.status,
              subjectTitle: s.chapter.subject?.title ?? null,
              lectureCount: s.chapter._count.lectures,
              dppCount: s.chapter._count.dpps,
              testCount: s.chapter._count.tests,
            }
          : null,
      }))}
      classNotes={classNoteSessions.map((s) => ({
        sessionId: s.id,
        title: s.batchSchedule?.title || s.title,
        subject: s.batchSchedule?.subject || "General",
        heldOn: (s.endedAt ?? s.batchSchedule?.startsAt ?? null)?.toISOString() ?? null,
      }))}
      dpps={chapterDpps.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        subject: d.subject || "General",
        chapter: d.chapter,
        status: d.status,
        questionCount: d.questionTargetCount,
      }))}
      tests={chapterTests.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        status: t.status,
        durationMin: t.durationMin,
        subject: t.chapter?.subject?.title || "General",
        chapterTitle: t.chapter?.title ?? null,
        series: t.testSeries ? { id: t.testSeries.id, name: t.testSeries.name } : null,
      }))}
      allTeachers={allTeachers}
      allStudents={allStudents}
      canUpdate={canUpdate}
      canManageEnrollment={canManageEnrollment}
      canManageSchedule={canManageSchedule}
    />
  );
}
