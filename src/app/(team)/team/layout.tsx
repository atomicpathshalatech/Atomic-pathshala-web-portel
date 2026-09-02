import { requireTeamSession } from "@/lib/auth/session";
import { getUserPermissionCodes } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { TeamShell, type TeamNavSection } from "@/components/team-portal/TeamShell";

/**
 * Grouped nav with strict role & permission gating.
 * "Contracts" is strictly an Admin/HR management tool (CONTRACT_READ_ANY)
 * placed under "People", completely hidden from educator self profiles.
 */
const NAV_SECTIONS: { title?: string; items: { href: string; label: string; icon: string; permission: string }[] }[] = [
  {
    items: [
      { href: "/team", label: "Dashboard", icon: "space_dashboard", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
      { href: "/", label: "Website Homepage", icon: "public", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
    ],
  },
  {
    title: "Teaching",
    items: [
      { href: "/team/my-schedule", label: "My Schedule", icon: "calendar_month", permission: PERMISSIONS.WHITEBOARD_ACCESS },
      { href: "/team/batches", label: "Batches", icon: "groups", permission: PERMISSIONS.BATCH_READ },
      { href: "/team/chapters", label: "Chapters", icon: "auto_stories", permission: PERMISSIONS.CHAPTER_READ },
      { href: "/team/tests", label: "Tests", icon: "quiz", permission: PERMISSIONS.TEST_READ },
      { href: "/team/test-series", label: "Test Series", icon: "collections_bookmark", permission: PERMISSIONS.TEST_READ },
      { href: "/team/whiteboard", label: "Whiteboard", icon: "draw", permission: PERMISSIONS.WHITEBOARD_ACCESS },
      { href: "/team/questions", label: "Question Bank", icon: "database", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/dpp", label: "DPP", icon: "task_alt", permission: PERMISSIONS.DPP_READ },
      { href: "/team/download-center", label: "Download Center", icon: "download_for_offline", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
      { href: "/team/doubts", label: "Doubt Desk", icon: "live_help", permission: PERMISSIONS.DOUBT_READ },
    ],
  },
  {
    title: "Content Studio",
    items: [
      { href: "/team/modules", label: "Module Studio", icon: "picture_as_pdf", permission: PERMISSIONS.MODULE_READ },
      { href: "/team/brand-profiles", label: "Brand Profiles", icon: "palette", permission: PERMISSIONS.MODULE_BRAND_PROFILE_MANAGE },
    ],
  },
  {
    title: "Administration & RBAC",
    items: [
      { href: "/team/users", label: "User Management", icon: "manage_accounts", permission: PERMISSIONS.USER_READ },
      { href: "/team/roles", label: "Roles & Permissions", icon: "security", permission: PERMISSIONS.ROLE_MANAGE },
      { href: "/team/departments", label: "Departments & Positions", icon: "corporate_fare", permission: PERMISSIONS.DEPARTMENT_MANAGE },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/team/faculty", label: "Faculty", icon: "school", permission: PERMISSIONS.TEACHER_READ },
      { href: "/team/contracts", label: "Contracts & Agreements", icon: "description", permission: PERMISSIONS.CONTRACT_READ_ANY },
      { href: "/team/onboarding", label: "Onboarding", icon: "pending_actions", permission: PERMISSIONS.ONBOARDING_REVIEW },
      { href: "/team/leaderboard", label: "Leaderboard", icon: "leaderboard", permission: PERMISSIONS.LEADERBOARD_READ },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/team/leads", label: "CRM / Leads", icon: "person_search", permission: PERMISSIONS.LEAD_READ },
      { href: "/team/coupons", label: "Coupons", icon: "confirmation_number", permission: PERMISSIONS.COUPON_READ },
      { href: "/team/notifications", label: "Notifications", icon: "campaign", permission: PERMISSIONS.NOTIFICATION_READ },
    ],
  },
  {
    title: "Finance & Insights",
    items: [
      { href: "/team/finance", label: "Finance", icon: "payments", permission: PERMISSIONS.FINANCE_READ },
      { href: "/team/subscriptions", label: "Subscriptions", icon: "workspace_premium", permission: PERMISSIONS.FINANCE_READ },
      { href: "/team/analytics", label: "Analytics", icon: "analytics", permission: PERMISSIONS.ANALYTICS_VIEW },
      { href: "/team/security", label: "Security Center", icon: "security", permission: PERMISSIONS.SECURITY_CONFIG_MANAGE },
      { href: "/team/predictor", label: "Rank/College Predictor", icon: "insights", permission: PERMISSIONS.PREDICTOR_DATA_MANAGE },
    ],
  },
  {
    title: "My Account",
    items: [
      { href: "/team/documents", label: "My Documents", icon: "badge", permission: PERMISSIONS.DOCUMENT_UPLOAD_SELF },
      { href: "/team/compliance", label: "Compliance", icon: "gavel", permission: PERMISSIONS.PENALTY_READ_SELF },
    ],
  },
];

export default async function TeamPortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireTeamSession();
  const permissions = await getUserPermissionCodes(user.id);
  const hasTeacherProfile = (await prisma.teacher.count({ where: { userId: user.id } })) > 0;

  const visibleSections: TeamNavSection[] = NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items
      .filter((item) => permissions.has(item.permission as (typeof PERMISSIONS)[keyof typeof PERMISSIONS]))
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((section) => section.items.length > 0);

  return (
    <TeamShell userName={user.name} userRoleLabel={user.role.label} hasTeacherProfile={hasTeacherProfile} sections={visibleSections}>
      {children}
    </TeamShell>
  );
}
