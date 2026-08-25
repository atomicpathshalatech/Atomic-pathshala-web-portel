import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { BatchTeacherManager } from "@/components/team-portal/BatchTeacherManager";
import { BatchEnrollmentManager } from "@/components/team-portal/BatchEnrollmentManager";
import { BatchScheduleManager } from "@/components/team-portal/BatchScheduleManager";

export const metadata: Metadata = {
  title: "Batch Detail",
};

const STATUS_STYLES: Record<string, string> = {
  UPCOMING: "bg-secondary/10 text-secondary",
  ACTIVE: "bg-primary/10 text-primary",
  COMPLETED: "bg-outline-variant/30 text-on-surface-variant",
  ARCHIVED: "bg-outline-variant/30 text-on-surface-variant",
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
    <div className="space-y-stack-lg max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
            <Link href="/team/batches" className="hover:text-primary">
              Batches
            </Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary">{batch.code}</span>
          </p>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{batch.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                STATUS_STYLES[batch.status] ?? "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {batch.status}
            </span>
            {batch.targetExam && (
              <span className="text-label-sm text-on-surface-variant">{batch.targetExam}</span>
            )}
            {batch.course && (
              <span className="text-label-sm text-on-surface-variant">· {batch.course.title}</span>
            )}
            {batch.capacity && (
              <span className="text-label-sm text-on-surface-variant">
                · {batch.enrollments.filter((e) => e.status === "ACTIVE").length}/{batch.capacity} seats
              </span>
            )}
          </div>
          {(batch.startDate || batch.endDate) && (
            <p className="text-label-sm text-on-surface-variant mt-1">
              {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : "—"} to{" "}
              {batch.endDate ? new Date(batch.endDate).toLocaleDateString() : "—"}
            </p>
          )}
          {batch.description && (
            <p className="text-body-md text-on-surface-variant mt-3 max-w-2xl">{batch.description}</p>
          )}
        </div>
        {canUpdate && (
          <Link
            href={`/team/batches/${batch.id}/edit`}
            className="flex items-center gap-2 border border-primary text-primary px-5 py-2.5 rounded-xl font-label-md hover:bg-primary/5 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            Edit Batch
          </Link>
        )}
      </div>

      <section className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">school</span>
          Assigned Teachers
        </h2>
        {canUpdate ? (
          <BatchTeacherManager
            batchId={batch.id}
            assigned={batch.teachers.map((t) => ({
              id: t.id,
              teacherId: t.teacherId,
              subject: t.subject,
              teacher: {
                employeeCode: t.teacher.employeeCode,
                department: t.teacher.department,
                user: { name: t.teacher.user.name },
              },
            }))}
            allTeachers={allTeachers}
          />
        ) : batch.teachers.length === 0 ? (
          <p className="text-label-sm text-on-surface-variant">No teachers assigned yet.</p>
        ) : (
          <ul className="space-y-2">
            {batch.teachers.map((t) => (
              <li key={t.id} className="bg-surface-container-lowest rounded-lg px-3 py-2">
                <p className="font-label-md text-label-md text-on-surface">{t.teacher.user.name}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {t.teacher.department} · {t.teacher.employeeCode}
                  {t.subject ? ` · ${t.subject}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">group</span>
          Enrolled Students ({batch.enrollments.filter((e) => e.status === "ACTIVE").length})
        </h2>
        {canManageEnrollment ? (
          <BatchEnrollmentManager
            batchId={batch.id}
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
            allStudents={allStudents}
          />
        ) : batch.enrollments.length === 0 ? (
          <p className="text-label-sm text-on-surface-variant">No students enrolled yet.</p>
        ) : (
          <ul className="space-y-2">
            {batch.enrollments.map((e) => (
              <li key={e.id} className="bg-surface-container-lowest rounded-lg px-3 py-2">
                <p className="font-label-md text-label-md text-on-surface">{e.student.user.name}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {e.student.enrollmentNumber} · {e.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">calendar_month</span>
          Timetable
        </h2>
        {canManageSchedule ? (
          <BatchScheduleManager
            batchId={batch.id}
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
            teachers={batch.teachers.map((t) => ({
              id: t.teacher.id,
              user: { name: t.teacher.user.name },
            }))}
          />
        ) : batch.schedules.length === 0 ? (
          <p className="text-label-sm text-on-surface-variant">No timetable entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {batch.schedules.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-surface-container-lowest rounded-lg px-3 py-2"
              >
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{s.title}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {new Date(s.startsAt).toLocaleString()} — {new Date(s.endsAt).toLocaleString()} · {s.status}
                  </p>
                </div>
                {s.type === "LIVE_CLASS" && (
                  <Link
                    href={`/team/live-class/${s.id}`}
                    className="shrink-0 flex items-center gap-1.5 bg-primary text-on-primary text-label-sm font-label-sm px-4 py-1.5 rounded-lg hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-lg">cast</span>
                    Start Live Class
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
