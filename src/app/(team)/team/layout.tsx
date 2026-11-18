import { requireTeamSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TeamShell } from "@/components/team-portal/TeamShell";
import { ATOMIC_OPS_NAV_GROUPS, TeamNavGroup } from "@/lib/navigation/team-nav-departments";

export default async function TeamPortalLayout({ children }: { children: React.ReactNode }) {
  // Session & permissions cached in request context
  const { user, permissions } = await requireTeamSession();
  const hasTeacherProfile = Boolean(user.teacher);
  const superAdmin =
    user.role?.name === "SUPER_ADMIN" ||
    user.role?.name === "FOUNDER" ||
    user.role?.name === "ADMIN";

  // Filter navigation groups and items strictly by user permissions and roles
  const visibleGroups: TeamNavGroup[] = ATOMIC_OPS_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (!item.superAdminOnly || superAdmin) &&
        (superAdmin ||
          permissions.has(item.permission as (typeof PERMISSIONS)[keyof typeof PERMISSIONS]))
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <TeamShell
      userName={user.name}
      userRoleLabel={user.role?.label ?? ""}
      hasTeacherProfile={hasTeacherProfile}
      canViewAsStudent={permissions.has(PERMISSIONS.STUDENT_VIEW_AS)}
      groups={visibleGroups}
    >
      {children}
    </TeamShell>
  );
}
