import type { Metadata } from "next";
import Link from "next/link";
import { requireTeamSession } from "@/lib/auth/session";
import { getUserPermissionCodes, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { CalendarWidget } from "@/components/team-portal/CalendarWidget";
import { TeacherCommandCenter } from "@/components/team-portal/TeacherCommandCenter";
import { getTeacherCommandCenterData } from "@/lib/teacher-dashboard/analytics";
import { NOT_RECORDED_SLOT } from "@/lib/recorded-lectures/visibility";
import { getExecutiveDashboardData } from "@/lib/dashboard/executive-analytics";
import { ExecutiveDashboard } from "@/components/team-portal/ExecutiveDashboard";

export const metadata: Metadata = {
  title: "Executive Dashboard — Atomic OPS",
};

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
  const superAdmin = await isSuperAdminUser(user.id);

  const isExecutive =
    superAdmin ||
    user.role?.name === "SUPER_ADMIN" ||
    user.role?.name === "FOUNDER" ||
    user.role?.name === "ADMIN" ||
    permissions.has(PERMISSIONS.ANALYTICS_VIEW) ||
    permissions.has(PERMISSIONS.FOUNDER_DASHBOARD_VIEW);

  // Load Executive Dashboard telemetry if authorized
  const executiveData = isExecutive ? await getExecutiveDashboardData() : null;

  // Teacher Profile & Schedule Data
  const teacherProfile = await prisma.teacher.findUnique({ where: { userId: user.id } });
  const commandCenterData = teacherProfile ? await getTeacherCommandCenterData(teacherProfile.id) : null;

  const now = new Date();
  const horizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const [upcomingSchedules, upcomingDoubtBookings] = teacherProfile
    ? await Promise.all([
        prisma.batchSchedule.findMany({
          where: {
            startsAt: { gte: now, lte: horizon },
            OR: [{ teacherId: teacherProfile.id }, { batch: { teachers: { some: { teacherId: teacherProfile.id } } } }],
            AND: [superAdmin ? {} : NOT_RECORDED_SLOT],
          },
          include: { batch: { select: { name: true } } },
          orderBy: { startsAt: "asc" },
          take: 30,
        }),
        prisma.doubtBooking.findMany({
          where: {
            teacherId: teacherProfile.id,
            status: "CONFIRMED",
            slot: { endTime: { gte: now } },
          },
          include: {
            slot: true,
            student: { include: { user: { select: { name: true } } } },
          },
          orderBy: { slot: { startTime: "asc" } },
          take: 15,
        }),
      ])
    : [[], []];

  const mappedDoubts = upcomingDoubtBookings.map((b) => ({
    id: `doubt-${b.id}`,
    title: `1:1 Doubt: ${b.student.user.name || "Student"}`,
    type: "DOUBT_SESSION",
    batch: { name: "1:1 Doubt" },
    startsAt: b.slot.startTime,
    href: `/team/doubt-booking/${b.id}`,
  }));

  const mappedSchedules = upcomingSchedules.map((s) => ({
    id: s.id,
    title: s.title,
    type: s.type,
    batch: s.batch,
    startsAt: s.startsAt,
    href: "/team/my-schedule",
  }));

  const upcoming = [...mappedDoubts, ...mappedSchedules].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  const calendarEvents = upcoming.map((s) => ({ date: toIsoDate(s.startsAt) }));

  return (
    <div className="space-y-6">
      {/* 1. New Executive Overview Dashboard for Super Admin & Leadership */}
      {executiveData && (
        <ExecutiveDashboard
          data={executiveData}
          userName={user.name}
          userRoleLabel={user.role?.label || "Super Admin"}
        />
      )}

      {/* 2. Educator Command Center */}
      {commandCenterData && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">co_present</span>
                Educator Command Center &amp; Live Teaching Analytics
              </h2>
              <p className="text-xs text-slate-500">
                Your assigned subjects, student doubt resolutions, and upcoming live classes.
              </p>
            </div>
            {teacherProfile && (
              <Link
                href="/team/profile"
                className="text-blue-600 font-bold text-xs hover:underline flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit Educator Profile
              </Link>
            )}
          </div>
          <TeacherCommandCenter data={commandCenterData} />
        </div>
      )}

      {/* 3. Non-Executive Educator Timetable View */}
      {!executiveData && teacherProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <CalendarWidget todayIso={toIsoDate(now)} events={calendarEvents} />
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">event_upcoming</span>
                Coming Up
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-xs text-slate-400">Nothing on your timetable in the next 60 days.</p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <Link
                        href={s.href}
                        className="block bg-slate-50 hover:bg-slate-100 rounded-lg p-2.5 transition"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                            {SCHEDULE_TYPE_LABEL[s.type] ?? s.type}
                          </span>
                          <span className="text-xs text-slate-500 truncate">{s.batch.name}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 truncate">{s.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {s.startsAt.toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
