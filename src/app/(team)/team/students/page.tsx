import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { StudentManagementConsole } from "@/components/team-portal/StudentManagementConsole";

export const metadata: Metadata = {
  title: "Student Management & Course Access — Atomic Pathshala",
  description: "Manage students, academic profiles, and course/batch access permissions.",
};

export default async function TeamStudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess =
    (await hasPermission(session.user.id, PERMISSIONS.STUDENT_READ_ANY)) ||
    (await hasPermission(session.user.id, PERMISSIONS.USER_READ));
  if (!canAccess) redirect("/team");

  return <StudentManagementConsole />;
}
