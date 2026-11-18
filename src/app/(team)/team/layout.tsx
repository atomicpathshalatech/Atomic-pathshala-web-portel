import { requireTeamSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TeamShell, type TeamNavSection } from "@/components/team-portal/TeamShell";
import { TEAM_NAV_CONFIG } from "@/lib/navigation/team-nav";

export default async function TeamPortalLayout({ children }: { children: React.ReactNode }) {
  // `permissions` and the teacher-profile probe both come from
  // requireTeamSession() now (cached, shared with every page in this render)
  // — this layout makes zero additional DB round trips.
  const { user, permissions } = await requireTeamSession();
  const hasTeacherProfile = Boolean(user.teacher);
  const isSuper = user.role?.name === "SUPER_ADMIN" || user.role?.name === "FOUNDER";
  const superAdmin = isSuper || user.role?.name === "ADMIN";

  const visibleSections: TeamNavSection[] = TEAM_NAV_CONFIG.map((section) => ({
    title: section.title,
    items: section.items
      .filter((item) => {
        // "View As / Role Preview" requires SUPER_ADMIN or FOUNDER specifically
        if (item.href === "/team/role-preview") return isSuper;
        if (item.superAdminOnly && !superAdmin) return false;
        return superAdmin || permissions.has(item.permission as (typeof PERMISSIONS)[keyof typeof PERMISSIONS]);
      })
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((section) => section.items.length > 0);

  return (
    <TeamShell
      userName={user.name}
      userRoleLabel={user.role?.label ?? ""}
      hasTeacherProfile={hasTeacherProfile}
      canViewAsStudent={permissions.has(PERMISSIONS.STUDENT_VIEW_AS)}
      sections={visibleSections}
    >
      {children}
    </TeamShell>
  );
}
