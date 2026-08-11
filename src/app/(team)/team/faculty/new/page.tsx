import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TeacherForm } from "@/components/team-portal/TeacherForm";

export const metadata: Metadata = {
  title: "Onboard Educator",
};

export default async function NewFacultyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.TEACHER_CREATE);
  if (!canCreate) redirect("/team/faculty");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Onboard Educator</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          This creates both their login and their faculty profile.
        </p>
      </div>
      <TeacherForm mode="create" />
    </div>
  );
}
