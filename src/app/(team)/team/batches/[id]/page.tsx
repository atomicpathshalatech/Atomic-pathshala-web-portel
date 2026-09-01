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
        include: { teacher: { include: { user: true } } },
        orderBy: { startsAt: "asc" },
      },
    },
  });
  if (!batch) notFound();

  const [allTeachers, allStudents] = await Promise.all([
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
      }))}
      allTeachers={allTeachers}
      allStudents={allStudents}
      canUpdate={canUpdate}
      canManageEnrollment={canManageEnrollment}
      canManageSchedule={canManageSchedule}
    />
  );
}
