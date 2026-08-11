import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TeacherForm } from "@/components/team-portal/TeacherForm";
import type { DEPARTMENT_OPTIONS } from "@/lib/validation/teacher";

export const metadata: Metadata = {
  title: "Edit Faculty Profile",
};

export default async function EditFacultyPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canUpdate = await hasPermission(session.user.id, PERMISSIONS.TEACHER_UPDATE);
  if (!canUpdate) redirect("/team/faculty");

  const teacher = await prisma.teacher.findUnique({
    where: { id: params.id },
    include: { user: true },
  });
  if (!teacher) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">{teacher.user.name}</h1>
        <p className="text-on-surface-variant font-body-md mt-1">{teacher.user.email}</p>
      </div>
      <TeacherForm
        mode="edit"
        teacherId={teacher.id}
        initialData={{
          employeeCode: teacher.employeeCode,
          department: teacher.department as (typeof DEPARTMENT_OPTIONS)[number],
          subjects: teacher.subjects,
          bio: teacher.bio ?? undefined,
        }}
      />
    </div>
  );
}
