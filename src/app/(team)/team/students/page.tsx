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

/**
 * Server-side gate, checked BEFORE any student data is fetched or the
 * console component is rendered — this is the enforcement point, not the
 * hidden nav link (see (team)/team/layout.tsx, which filters the "Student
 * Management" link off a Teacher's nav using the same permission and is
 * cosmetic only). ADMIN / SUPER_ADMIN / FOUNDER pass via STUDENT_READ_ANY;
 * a Teacher hitting this URL directly gets an explicit denial screen, never
 * <StudentManagementConsole/> and never a byte of student data.
 */
export default async function TeamStudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess =
    (await hasPermission(session.user.id, PERMISSIONS.STUDENT_READ_ANY)) ||
    (await hasPermission(session.user.id, PERMISSIONS.USER_READ));
  if (!canAccess) {
    return (
      <div className="mx-auto max-w-lg mt-16 rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-rose-500">block</span>
        <h1 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Student Management is restricted to Admin accounts. Your role does not have
          permission to view this page or any student data.
        </p>
      </div>
    );
  }

  return <StudentManagementConsole />;
}
