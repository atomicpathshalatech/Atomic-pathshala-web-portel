import { requireTeamSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TeamShell } from "@/components/team-portal/TeamShell";
import { ATOMIC_OPS_DEPARTMENTS, TeamNavDepartment } from "@/lib/navigation/team-nav-departments";

export default async function TeamPortalLayout({ children }: { children: React.ReactNode }) {
  // `permissions` and teacher-profile probe come from requireTeamSession() (cached in request context)
  const { user, permissions } = await requireTeamSession();
  const hasTeacherProfile = Boolean(user.teacher);
  const superAdmin =
    user.role?.name === "SUPER_ADMIN" ||
    user.role?.name === "FOUNDER" ||
    user.role?.name === "ADMIN";

  // Filter 12 departments and their submenus strictly by user permissions and roles
  const visibleDepartments: TeamNavDepartment[] = ATOMIC_OPS_DEPARTMENTS.map((dept) => ({
    ...dept,
    items: dept.items.filter(
      (item) =>
        (!item.superAdminOnly || superAdmin) &&
        (superAdmin ||
          permissions.has(item.permission as (typeof PERMISSIONS)[keyof typeof PERMISSIONS]))
    ),
  })).filter((dept) => dept.items.length > 0);

  return (
    <TeamShell
      userName={user.name}
      userRoleLabel={user.role?.label ?? ""}
      hasTeacherProfile={hasTeacherProfile}
      canViewAsStudent={permissions.has(PERMISSIONS.STUDENT_VIEW_AS)}
      departments={visibleDepartments}
    >
      {children}
    </TeamShell>
  );
}
