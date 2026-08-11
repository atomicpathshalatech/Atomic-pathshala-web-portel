import Link from "next/link";
import { requireTeamSession } from "@/lib/auth/session";
import { getUserPermissionCodes } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { LogoutButton } from "@/components/student/LogoutButton";
import { prisma } from "@/lib/db";

const MODULES = [
  { href: "/team", label: "Dashboard", icon: "space_dashboard", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
  { href: "/team/questions", label: "Question Bank", icon: "database", permission: PERMISSIONS.QUESTION_READ },
  { href: "/team/doubts", label: "Doubt Desk", icon: "live_help", permission: PERMISSIONS.DOUBT_READ },
  { href: "/team/faculty", label: "Faculty", icon: "school", permission: PERMISSIONS.TEACHER_READ },
  { href: "/team/onboarding", label: "Onboarding", icon: "pending_actions", permission: PERMISSIONS.ONBOARDING_REVIEW },
  { href: "/team/documents", label: "My Documents", icon: "badge", permission: PERMISSIONS.DOCUMENT_UPLOAD_SELF },
  { href: "/team/contracts", label: "Contracts", icon: "description", permission: PERMISSIONS.CONTRACT_READ_SELF },
  { href: "/team/compliance", label: "Compliance", icon: "gavel", permission: PERMISSIONS.PENALTY_READ_SELF },
  { href: "/team/leaderboard", label: "Leaderboard", icon: "leaderboard", permission: PERMISSIONS.LEADERBOARD_READ },
  { href: "/team/coupons", label: "Coupons", icon: "confirmation_number", permission: PERMISSIONS.COUPON_READ },
  { href: "/team/notifications", label: "Notifications", icon: "campaign", permission: PERMISSIONS.NOTIFICATION_READ },
  { href: "/team/leads", label: "CRM / Leads", icon: "person_search", permission: PERMISSIONS.LEAD_READ },
  { href: "/team/finance", label: "Finance", icon: "payments", permission: PERMISSIONS.FINANCE_READ },
  { href: "/team/subscriptions", label: "Subscriptions", icon: "workspace_premium", permission: PERMISSIONS.FINANCE_READ },
  { href: "/team/analytics", label: "Analytics", icon: "analytics", permission: PERMISSIONS.ANALYTICS_VIEW },
];

export default async function TeamPortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireTeamSession();
  const permissions = await getUserPermissionCodes(user.id);
  const visibleModules = MODULES.filter((m) => permissions.has(m.permission));
  const hasTeacherProfile = (await prisma.teacher.count({ where: { userId: user.id } })) > 0;

  return (
    <div className="min-h-screen bg-surface-container-low/30">
      <nav className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-outline-variant/20">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-6">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary shrink-0">
            Atomic Pathshala <span className="text-on-surface-variant font-body-md text-body-md">Team</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1 flex-1 overflow-x-auto">
            {visibleModules.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-primary/5 hover:text-primary transition-colors whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-lg">{m.icon}</span>
                {m.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {hasTeacherProfile ? (
              <Link href="/team/profile" className="hidden sm:block text-right group">
                <div className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors">
                  {user.name}
                </div>
                <div className="text-label-sm font-label-sm text-on-surface-variant">{user.role.label}</div>
              </Link>
            ) : (
              <div className="hidden sm:block text-right">
                <div className="font-label-md text-label-md text-on-surface">{user.name}</div>
                <div className="text-label-sm font-label-sm text-on-surface-variant">{user.role.label}</div>
              </div>
            )}
            <LogoutButton />
          </div>
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden flex items-center gap-1 px-margin-mobile pb-3 overflow-x-auto">
          {visibleModules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-sm text-label-sm text-on-surface-variant hover:bg-primary/5 hover:text-primary transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base">{m.icon}</span>
              {m.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
        {children}
      </main>
    </div>
  );
}
