import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamSession } from "@/lib/auth/session";
import { getUserPermissionCodes } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Team Portal",
};

const MODULE_CARDS = [
  {
    href: "/team/questions",
    label: "Question Bank",
    icon: "database",
    description: "Create, verify, and organize NEET/JEE question papers.",
    permission: PERMISSIONS.QUESTION_READ,
    available: true,
  },
  {
    href: "/team/doubts",
    label: "Doubt Desk",
    icon: "live_help",
    description: "Resolve student doubts flagged from live classes and DPPs.",
    permission: PERMISSIONS.DOUBT_READ,
    available: true,
  },
  {
    href: "/team/faculty",
    label: "Faculty",
    icon: "school",
    description: "Onboard educators and manage faculty profiles.",
    permission: PERMISSIONS.TEACHER_READ,
    available: true,
  },
  {
    href: "/team/coupons",
    label: "Coupon Management",
    icon: "confirmation_number",
    description: "Create and track discount codes and campaign performance.",
    permission: PERMISSIONS.COUPON_READ,
    available: false,
  },
  {
    href: "/team/notifications",
    label: "Bulk Notifications",
    icon: "campaign",
    description: "Compose and schedule broadcasts to student segments.",
    permission: PERMISSIONS.NOTIFICATION_READ,
    available: false,
  },
  {
    href: "/team/leads",
    label: "CRM / Leads",
    icon: "person_search",
    description: "Track and assign prospective-student leads.",
    permission: PERMISSIONS.LEAD_READ,
    available: false,
  },
  {
    href: "/team/finance",
    label: "Finance",
    icon: "payments",
    description: "Invoices, refunds, and payment reconciliation.",
    permission: PERMISSIONS.FINANCE_READ,
    available: false,
  },
  {
    href: "/team/analytics",
    label: "Analytics",
    icon: "analytics",
    description: "Cross-portal performance and enrollment analytics.",
    permission: PERMISSIONS.ANALYTICS_VIEW,
    available: false,
  },
];

export default async function TeamHomePage() {
  const { user } = await requireTeamSession();
  const permissions = await getUserPermissionCodes(user.id);
  const cards = MODULE_CARDS.filter((c) => permissions.has(c.permission));

  const teacherProfile = await prisma.teacher.findUnique({ where: { userId: user.id } });
  const pendingDoubts =
    teacherProfile && permissions.has(PERMISSIONS.DOUBT_READ)
      ? await prisma.doubt.count({ where: { status: "OPEN" } })
      : null;

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {user.role.label} — here&apos;s what you have access to.
        </p>
      </div>

      {teacherProfile && (
        <section className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide">
                Faculty Profile
              </p>
              <h2 className="font-headline-md text-headline-md text-on-surface">{teacherProfile.department}</h2>
              <p className="text-label-sm text-on-surface-variant">Code: {teacherProfile.employeeCode}</p>
            </div>
            <Link
              href="/team/profile"
              className="text-primary font-label-md text-label-md hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
              Edit My Profile
            </Link>
          </div>
          {pendingDoubts !== null && (
            <div className="flex items-center gap-4 bg-primary-container/10 rounded-xl p-4 border border-primary/20 w-fit">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">live_help</span>
              </div>
              <div>
                <p className="font-headline-md text-headline-md text-primary">{pendingDoubts}</p>
                <p className="text-label-sm text-on-surface-variant">
                  Doubt{pendingDoubts === 1 ? "" : "s"} awaiting a response
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {cards.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
          Your role doesn&apos;t have any team-portal modules assigned yet. Contact a Super Admin
          if this looks wrong.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {cards.map((card) =>
            card.available ? (
              <Link
                key={card.href}
                href={card.href}
                className="glass-card rounded-2xl p-6 space-y-3 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">{card.icon}</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface">{card.label}</h3>
                <p className="text-label-sm font-label-sm text-on-surface-variant">{card.description}</p>
              </Link>
            ) : (
              <div
                key={card.href}
                className="glass-card rounded-2xl p-6 space-y-3 opacity-70"
              >
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">{card.icon}</span>
                  </div>
                  <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded-full font-bold uppercase tracking-wide text-on-surface-variant">
                    Coming Soon
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface">{card.label}</h3>
                <p className="text-label-sm font-label-sm text-on-surface-variant">{card.description}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
