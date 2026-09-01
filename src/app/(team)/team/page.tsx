import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamSession } from "@/lib/auth/session";
import { getUserPermissionCodes } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { CalendarWidget } from "@/components/team-portal/CalendarWidget";
import { TeacherCommandCenter } from "@/components/team-portal/TeacherCommandCenter";
import { getTeacherCommandCenterData } from "@/lib/teacher-dashboard/analytics";

export const metadata: Metadata = {
  title: "Team Portal",
};

const MODULE_CARDS = [
  { href: "/team/live-studio", label: "Live Classroom (Whiteboard Studio)", icon: "videocam", description: "Start live whiteboard classes with webcam PiP, smart pen palette, slide themes, polls, and live doubt desk.", permission: PERMISSIONS.WHITEBOARD_ACCESS, available: true },
  { href: "/team/batches", label: "Batches", icon: "groups", description: "Create batches, assign teachers, enroll students, and build the class timetable.", permission: PERMISSIONS.BATCH_READ, available: true },
  { href: "/team/tests", label: "Tests", icon: "quiz", description: "Build timed mock tests from the Question Bank and publish them to a batch.", permission: PERMISSIONS.TEST_READ, available: true },
  { href: "/team/questions", label: "Question Bank", icon: "database", description: "Create, verify, and organize NEET/JEE question papers.", permission: PERMISSIONS.QUESTION_READ, available: true },
  { href: "/team/doubts", label: "Doubt Desk", icon: "live_help", description: "Resolve student doubts flagged from live classes and DPPs.", permission: PERMISSIONS.DOUBT_READ, available: true },
  { href: "/team/faculty", label: "Faculty", icon: "school", description: "Onboard educators and manage faculty profiles.", permission: PERMISSIONS.TEACHER_READ, available: true },
  { href: "/team/coupons", label: "Coupon Management", icon: "confirmation_number", description: "Create and track discount codes and campaign performance.", permission: PERMISSIONS.COUPON_READ, available: true },
  { href: "/team/notifications", label: "Bulk Notifications", icon: "campaign", description: "Compose and schedule broadcasts to student segments.", permission: PERMISSIONS.NOTIFICATION_READ, available: true },
  { href: "/team/leads", label: "CRM / Leads", icon: "person_search", description: "Track and assign prospective-student leads.", permission: PERMISSIONS.LEAD_READ, available: true },
  { href: "/team/finance", label: "Finance", icon: "payments", description: "Invoices, refunds, and payment reconciliation.", permission: PERMISSIONS.FINANCE_READ, available: true },
  { href: "/team/analytics", label: "Analytics", icon: "analytics", description: "Cross-portal performance and enrollment analytics.", permission: PERMISSIONS.ANALYTICS_VIEW, available: true },
  { href: "/team/website", label: "Website Builder", icon: "web", description: "Build the public homepage, banners, testimonials, FAQs, footer and SEO.", permission: PERMISSIONS.HOME_VIEW, available: true },
];

const SCHEDULE_TYPE_LABEL: Record<string, string> = {
  LIVE_CLASS: "Live Class",
  TEST: "Test",
  DPP: "DPP",
  DOUBT_SESSION: "Doubt Session",
  OTHER: "Session",
};

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function TeamHomePage() {
  const { user } = await requireTeamSession();
  const permissions = await getUserPermissionCodes(user.id);
  const cards = MODULE_CARDS.filter((c) => permissions.has(c.permission));

  const teacherProfile = await prisma.teacher.findUnique({ where: { userId: user.id } });
  const commandCenterData = teacherProfile ? await getTeacherCommandCenterData(teacherProfile.id) : null;

  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const upcoming = teacherProfile
    ? await prisma.batchSchedule.findMany({
        where: {
          startsAt: { gte: now, lte: horizon },
          OR: [{ teacherId: teacherProfile.id }, { batch: { teachers: { some: { teacherId: teacherProfile.id } } } }],
        },
        include: { batch: { select: { name: true } } },
        orderBy: { startsAt: "asc" },
        take: 30,
      })
    : [];

  const calendarEvents = upcoming.map((s) => ({ date: toIsoDate(s.startsAt) }));

  return (
    <div className="space-y-stack-lg max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Welcome, {user.name.split(" ")[0]}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {user.role.label} — here&apos;s what you have access to.
          </p>
        </div>
        {teacherProfile && (
          <Link
            href="/team/profile"
            className="text-primary font-label-md text-label-md hover:underline flex items-center gap-1 shrink-0"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            Edit My Profile
          </Link>
        )}
      </div>

      {commandCenterData && <TeacherCommandCenter data={commandCenterData} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg">
        <div className="lg:col-span-8 space-y-stack-lg">
          {cards.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">
              Your role doesn&apos;t have any team-portal modules assigned yet. Contact a Super Admin
              if this looks wrong.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
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
                  <div key={card.href} className="glass-card rounded-2xl p-6 space-y-3 opacity-70">
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

        {teacherProfile && (
          <aside className="lg:col-span-4 space-y-stack-md">
            <CalendarWidget todayIso={toIsoDate(now)} events={calendarEvents} />

            <div className="glass-card rounded-xl p-stack-md">
              <h3 className="font-headline-md text-headline-md mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">event_upcoming</span>
                Coming Up
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-label-sm text-on-surface-variant">Nothing on your timetable in the next 60 days.</p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.slice(0, 5).map((s) => (
                    <li key={s.id} className="bg-surface-container-lowest rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-secondary/10 text-secondary px-1.5 py-0.5 rounded">
                          {SCHEDULE_TYPE_LABEL[s.type] ?? s.type}
                        </span>
                        <span className="text-label-sm text-on-surface-variant truncate">{s.batch.name}</span>
                      </div>
                      <p className="font-label-md text-label-md text-on-surface truncate">{s.title}</p>
                      <p className="text-label-sm text-on-surface-variant">
                        {s.startsAt.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
