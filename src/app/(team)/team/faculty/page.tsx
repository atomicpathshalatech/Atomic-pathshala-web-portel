import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { FacultyManagementView } from "@/components/team-portal/FacultyManagementView";

export const metadata: Metadata = {
  title: "Faculty",
};

export default async function FacultyListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEACHER_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.TEACHER_CREATE);
  const canDelete = await hasPermission(session.user.id, PERMISSIONS.TEACHER_DELETE);

  const teachers = await prisma.teacher.findMany({
    include: {
      user: {
        include: {
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary">Faculty</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {teachers.length} educator{teachers.length === 1 ? "" : "s"} onboarded.
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-3">
            <Link
              href="/team/faculty/applications"
              className="flex items-center gap-2 border border-primary text-primary px-6 py-3 rounded-xl font-label-md hover:bg-primary/5 transition-all"
            >
              <span className="material-symbols-outlined">pending_actions</span>
              Review Applications
            </Link>
            <Link
              href="/team/faculty/new"
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">person_add</span>
              Onboard Educator
            </Link>
          </div>
        )}
      </div>

      <FacultyManagementView
        teachers={teachers.map((t) => ({
          id: t.id,
          employeeCode: t.employeeCode,
          department: t.department,
          subjects: t.subjects,
          displayName: t.displayName,
          targetExams: t.targetExams,
          classes: t.classes,
          languages: t.languages,
          experienceYears: t.experienceYears,
          qualifications: (t.qualifications as any) || [],
          experienceList: (t.experienceList as any) || [],
          bio: t.bio,
          dob: t.dob ? t.dob.toISOString() : null,
          user: {
            id: t.user.id,
            name: t.user.name,
            email: t.user.email,
            phone: t.user.phone,
            photoUrl: t.user.photoUrl,
            status: t.user.status,
            role: t.user.role?.name || "TEACHER",
            position: t.user.position,
            department: t.user.department,
            contractType: t.user.contractType,
            contractEnd: t.user.contractEnd ? t.user.contractEnd.toISOString() : null,
          },
        }))}
        canDelete={canDelete}
      />
    </div>
  );
}
