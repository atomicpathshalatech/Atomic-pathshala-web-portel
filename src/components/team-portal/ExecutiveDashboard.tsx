"use client";

import React from "react";
import Link from "next/link";
import type { ExecutiveDashboardData } from "@/lib/dashboard/executive-analytics";

interface ExecutiveDashboardProps {
  data: ExecutiveDashboardData;
  userName: string;
  userRoleLabel: string;
}

export function ExecutiveDashboard({
  data,
  userName,
  userRoleLabel,
}: ExecutiveDashboardProps) {
  const { kpis, growth, batches, tests, criticalAlerts, todaySchedule, recentActivities, systemHealth } = data;

  // Max value for enrollment bar scaling
  const maxEnroll = Math.max(...growth.monthlyEnrollments.map((m) => m.count), 10);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Executive Overview &amp; Control Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
              {userRoleLabel || "Super Admin"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time organizational telemetry across academics, faculty, students, tests, and revenue.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/team/analytics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-500">analytics</span>
            Detailed Analytics
          </Link>
          <Link
            href="/team/tests/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-2xs transition"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Create Test
          </Link>
        </div>
      </div>

      {/* Critical Alerts Banner (If any) */}
      {criticalAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {criticalAlerts.map((alert) => (
            <Link
              key={alert.id}
              href={alert.href}
              className={`p-3.5 rounded-xl border flex items-start gap-3 transition hover:shadow-xs ${
                alert.severity === "CRITICAL"
                  ? "bg-rose-50/80 border-rose-200 text-rose-900"
                  : alert.severity === "WARNING"
                  ? "bg-amber-50/80 border-amber-200 text-amber-900"
                  : "bg-blue-50/80 border-blue-200 text-blue-900"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  alert.severity === "CRITICAL"
                    ? "bg-rose-600 text-white"
                    : alert.severity === "WARNING"
                    ? "bg-amber-600 text-white"
                    : "bg-blue-600 text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {alert.severity === "CRITICAL" ? "priority_high" : "warning"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold truncate">{alert.title}</span>
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-white/70">
                    {alert.count}
                  </span>
                </div>
                <p className="text-[11px] opacity-80 line-clamp-1 mt-0.5">{alert.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 10 Enterprise KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: "Total Students",
            val: kpis.totalStudents,
            sub: `${kpis.activeStudents} active`,
            href: "/team/students",
            icon: "school",
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Active Students",
            val: kpis.activeStudents,
            sub: "Regularly verified",
            href: "/team/students?filter=active",
            icon: "verified_user",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "New Enrollments",
            val: kpis.newEnrollments,
            sub: "Enrolled this month",
            href: "/team/students",
            icon: "person_add",
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          {
            label: "Active Batches",
            val: kpis.activeBatches,
            sub: "Running cohorts",
            href: "/team/batches",
            icon: "groups",
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            label: "Total Faculty",
            val: kpis.totalFaculty,
            sub: "Subject experts",
            href: "/team/faculty",
            icon: "badge",
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Today's Live Classes",
            val: kpis.todayLiveClasses,
            sub: "Whiteboard & Studio",
            href: "/team/my-schedule",
            icon: "sensors",
            color: "text-rose-600",
            bg: "bg-rose-50",
          },
          {
            label: "Monthly Revenue",
            val: `₹${kpis.monthlyRevenue.toLocaleString("en-IN")}`,
            sub: "Confirmed collections",
            href: "/team/finance",
            icon: "payments",
            color: "text-emerald-700",
            bg: "bg-emerald-50",
          },
          {
            label: "Pending Orders",
            val: kpis.pendingPayments,
            sub: "Awaiting settlement",
            href: "/team/finance",
            icon: "pending",
            color: "text-amber-700",
            bg: "bg-amber-50",
          },
          {
            label: "Pending Doubts",
            val: kpis.pendingDoubts,
            sub: "In queue for faculty",
            href: "/team/doubts",
            icon: "live_help",
            color: "text-sky-600",
            bg: "bg-sky-50",
          },
          {
            label: "Active Tests",
            val: kpis.activeTests,
            sub: "Published to students",
            href: "/team/tests",
            icon: "quiz",
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group relative p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {card.label}
              </span>
              <div className={`w-6 h-6 rounded-md ${card.bg} ${card.color} flex items-center justify-center shrink-0`}>
                <span className="material-symbols-outlined text-[15px]">{card.icon}</span>
              </div>
            </div>

            <div className="mt-2">
              <span className="text-xl font-black text-slate-900 tracking-tight block">
                {card.val}
              </span>
              <span className="text-[11px] text-slate-400 flex items-center justify-between mt-0.5">
                <span>{card.sub}</span>
                <span className="material-symbols-outlined text-[13px] text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Analytics & Trends Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Student Enrollment Trend */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">trending_up</span>
                Student Enrollment Velocity (Last 6 Months)
              </h2>
              <p className="text-[11px] text-slate-400">Total new registered candidates across all batches</p>
            </div>
            <Link href="/team/students" className="text-xs font-bold text-blue-600 hover:underline">
              View Directory
            </Link>
          </div>

          <div className="h-36 flex items-end justify-between gap-3 pt-3 px-2">
            {growth.monthlyEnrollments.map((m) => {
              const heightPercent = Math.max(12, Math.round((m.count / maxEnroll) * 100));
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {m.count}
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full max-w-[32px] rounded-t-md bg-blue-600 group-hover:bg-blue-500 transition-all shadow-xs"
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Batches Overview */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-purple-600 text-[18px]">groups</span>
                Active Cohorts &amp; Batches
              </h2>
              <p className="text-[11px] text-slate-400">Current running batches and student capacity</p>
            </div>
            <Link href="/team/batches" className="text-xs font-bold text-blue-600 hover:underline">
              Manage Batches
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {batches.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No active batches created yet.</div>
            ) : (
              batches.slice(0, 4).map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{b.name}</p>
                    <p className="text-[11px] text-slate-400">
                      Started: {new Date(b.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      {b.studentCount} students
                    </span>
                    <Link
                      href={`/team/batches`}
                      className="text-slate-400 hover:text-slate-700 text-xs material-symbols-outlined"
                    >
                      chevron_right
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Operations Split: Schedule & Tests (Left) vs Infrastructure & Activities (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (8 cols): Today's Schedule & Published Tests */}
        <div className="lg:col-span-8 space-y-5">
          {/* Today's Live Class Schedule */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">calendar_today</span>
                  Today&apos;s Live Academic Schedule
                </h2>
                <p className="text-[11px] text-slate-400">Classes and sessions programmed for today</p>
              </div>
              <Link href="/team/my-schedule" className="text-xs font-bold text-blue-600 hover:underline">
                Full Timetable
              </Link>
            </div>

            {todaySchedule.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <span className="material-symbols-outlined text-slate-300 text-3xl">event_available</span>
                <p className="text-xs font-bold text-slate-600 mt-1">No live classes scheduled for today.</p>
                <p className="text-[11px] text-slate-400">View upcoming days on the timetable.</p>
                <Link
                  href="/team/my-schedule"
                  className="mt-2.5 inline-block text-xs font-bold px-3 py-1 bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50"
                >
                  Open Academic Timetable
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {todaySchedule.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 uppercase">
                          {s.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate">{s.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {s.batchName} · {s.teacherName} ·{" "}
                        {new Date(s.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <Link
                      href={s.href}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shrink-0 transition"
                    >
                      {s.type === "LIVE_CLASS" ? "Start Studio" : "View"}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Tests & Question Bank Health */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-violet-600 text-[18px]">quiz</span>
                  Published Test Series &amp; Assessments
                </h2>
                <p className="text-[11px] text-slate-400">Mock tests currently accessible to enrolled students</p>
              </div>
              <Link href="/team/tests" className="text-xs font-bold text-blue-600 hover:underline">
                All Tests
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {tests.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">No published tests available.</div>
              ) : (
                tests.map((t) => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {t.questionCount} Questions · Type: {t.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                        {t.attemptCount} Attempts
                      </span>
                      <Link
                        href={`/team/tests/${t.id}`}
                        className="px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): System Health & Audit Trail */}
        <div className="lg:col-span-4 space-y-5">
          {/* System & Infrastructure Telemetry */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-[18px]">dns</span>
                Infrastructure Telemetry
              </h2>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">PostgreSQL Database</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  {systemHealth.dbStatus} ({systemHealth.dbLatencyMs}ms)
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Cloud Storage (R2 / Assets)</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  CONNECTED
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Active Operator Sessions</span>
                <span className="font-bold text-slate-800">{systemHealth.activeSessions}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Service Uptime</span>
                <span className="font-bold text-slate-800">
                  {Math.floor(systemHealth.serverUptimeSeconds / 3600)}h {Math.floor((systemHealth.serverUptimeSeconds % 3600) / 60)}m
                </span>
              </div>
            </div>
          </div>

          {/* Recent Audit Activities */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">history</span>
                Audit Activity Log
              </h2>
              <Link href="/team/compliance" className="text-xs font-bold text-blue-600 hover:underline">
                Audit Trail
              </Link>
            </div>

            <div className="space-y-2">
              {recentActivities.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No recent audit logs recorded.</p>
              ) : (
                recentActivities.map((act) => (
                  <div key={act.id} className="text-xs py-1.5 border-b border-slate-50 last:border-0">
                    <p className="font-bold text-slate-800 truncate">{act.action}</p>
                    <p className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                      <span>{act.userName}</span>
                      <span>
                        {new Date(act.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick APK Downloads */}
          <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600 text-[18px]">install_mobile</span>
              Official Field Companion Apps
            </h3>
            <p className="text-[11px] text-blue-900/80">
              Download native apps for cellular CRM dialer and student live polling.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <a
                href="/downloads/AtomicCalling.apk"
                download="AtomicCalling.apk"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition"
              >
                <span>Atomic Calling APK</span>
                <span className="material-symbols-outlined text-[16px]">download</span>
              </a>
              <a
                href="/downloads/AtomicPathshala.apk"
                download="AtomicPathshala.apk"
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs transition"
              >
                <span>Student Mobile APK</span>
                <span className="material-symbols-outlined text-[16px]">download</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
