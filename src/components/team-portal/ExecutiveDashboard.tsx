"use client";

import React from "react";
import Link from "next/link";
import {
  GraduationCap,
  UserCheck,
  UserPlus,
  Layers,
  Users,
  Video,
  Wallet,
  Clock,
  HelpCircle,
  FileCheck2,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Plus,
  BarChart2,
} from "lucide-react";
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

  const maxEnroll = Math.max(...growth.monthlyEnrollments.map((m) => m.count), 10);

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Executive Overview
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              {userRoleLabel || "Super Admin"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time organizational telemetry across academics, admissions, faculty, tests, and revenue.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/team/analytics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
          >
            <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
            Full Analytics
          </Link>
          <Link
            href="/team/tests/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Test
          </Link>
        </div>
      </div>

      {/* 2. Critical Alerts Bar */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-2">
          {criticalAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-3 rounded-lg border border-amber-200/80 bg-amber-50/60 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold text-amber-900 truncate">{alert.title}:</span>
                <span className="text-amber-800/90 truncate">{alert.description}</span>
              </div>
              <Link
                href={alert.href}
                className="font-bold text-amber-900 hover:text-amber-950 underline shrink-0 whitespace-nowrap"
              >
                Resolve ({alert.count}) →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* 3. 10 Enterprise KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total Students", val: kpis.totalStudents, sub: `${kpis.activeStudents} active`, href: "/team/students", icon: GraduationCap },
          { label: "Active Students", val: kpis.activeStudents, sub: "Regularly verified", href: "/team/students?filter=active", icon: UserCheck },
          { label: "New Enrollments", val: kpis.newEnrollments, sub: "This calendar month", href: "/team/students", icon: UserPlus },
          { label: "Active Batches", val: kpis.activeBatches, sub: "Running cohorts", href: "/team/batches", icon: Layers },
          { label: "Total Faculty", val: kpis.totalFaculty, sub: "Verified educators", href: "/team/faculty", icon: Users },
          { label: "Today's Classes", val: kpis.todayLiveClasses, sub: "Whiteboard studio", href: "/team/my-schedule", icon: Video },
          { label: "Monthly Revenue", val: `₹${kpis.monthlyRevenue.toLocaleString("en-IN")}`, sub: "Confirmed orders", href: "/team/finance", icon: Wallet },
          { label: "Pending Orders", val: kpis.pendingPayments, sub: "Awaiting payment", href: "/team/finance", icon: Clock },
          { label: "Pending Doubts", val: kpis.pendingDoubts, sub: "In faculty queue", href: "/team/doubts", icon: HelpCircle },
          { label: "Active Tests", val: kpis.activeTests, sub: "Published mock tests", href: "/team/tests", icon: FileCheck2 },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xs transition flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  {card.label}
                </span>
                <div className="w-6 h-6 rounded-md bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 border border-slate-100 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="mt-2.5">
                <span className="text-xl font-bold text-slate-900 tracking-tight block">
                  {card.val}
                </span>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                  <span className="truncate">{card.sub}</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 4. Analytics & Operational Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Enrollment Velocity */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Student Enrollment Velocity
              </h2>
              <p className="text-[11px] text-slate-400">New student registration count over the last 6 months</p>
            </div>
            <Link href="/team/students" className="text-xs font-semibold text-blue-600 hover:underline">
              View Directory
            </Link>
          </div>

          <div className="h-32 flex items-end justify-between gap-3 pt-2 px-1">
            {growth.monthlyEnrollments.map((m) => {
              const heightPercent = Math.max(12, Math.round((m.count / maxEnroll) * 100));
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {m.count}
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full max-w-[28px] rounded-t bg-blue-600 hover:bg-blue-700 transition-colors"
                  />
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Batches */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-600" />
                Active Cohorts &amp; Batches
              </h2>
              <p className="text-[11px] text-slate-400">Ongoing academic batches and student enrollment counts</p>
            </div>
            <Link href="/team/batches" className="text-xs font-semibold text-blue-600 hover:underline">
              Manage Batches
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {batches.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No active batches recorded.</p>
            ) : (
              batches.slice(0, 4).map((b) => (
                <div key={b.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{b.name}</p>
                    <p className="text-[11px] text-slate-400">
                      Started {new Date(b.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {b.studentCount} enrolled
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Main Split Section: Today's Schedule & Tests vs Infrastructure & Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Today's Schedule & Tests */}
        <div className="lg:col-span-8 space-y-4">
          {/* Today's Schedule */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  Today&apos;s Academic Schedule
                </h2>
                <p className="text-[11px] text-slate-400">Classes, doubts and tests assigned for today</p>
              </div>
              <Link href="/team/my-schedule" className="text-xs font-semibold text-blue-600 hover:underline">
                View Timetable
              </Link>
            </div>

            {todaySchedule.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                <Calendar className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600 mt-1.5">No classes scheduled for today.</p>
                <Link
                  href="/team/my-schedule"
                  className="mt-2 inline-block text-xs font-semibold px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 transition"
                >
                  Open Academic Timetable
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {todaySchedule.map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 uppercase">
                          {s.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">{s.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {s.batchName} · {s.teacherName} ·{" "}
                        {new Date(s.startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <Link
                      href={s.href}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shrink-0 transition"
                    >
                      {s.type === "LIVE_CLASS" ? "Start Studio" : "Open"}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Assessments */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-slate-600" />
                  Active Tests &amp; Question Modules
                </h2>
                <p className="text-[11px] text-slate-400">Recently published tests and attempt volumes</p>
              </div>
              <Link href="/team/tests" className="text-xs font-semibold text-blue-600 hover:underline">
                All Tests
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {tests.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">No published tests found.</p>
              ) : (
                tests.map((t) => (
                  <div key={t.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {t.questionCount} Questions · Format: {t.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {t.attemptCount} Attempts
                      </span>
                      <Link
                        href={`/team/tests/${t.id}`}
                        className="px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-medium"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Infrastructure & Audit Trail */}
        <div className="lg:col-span-4 space-y-4">
          {/* Infrastructure Telemetry */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-slate-600" />
                Infrastructure Health
              </h2>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">PostgreSQL DB</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Healthy ({systemHealth.dbLatencyMs}ms)
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Cloud Storage (R2)</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Active Sessions</span>
                <span className="font-semibold text-slate-900">{systemHealth.activeSessions}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">System Uptime</span>
                <span className="font-semibold text-slate-900">
                  {Math.floor(systemHealth.serverUptimeSeconds / 3600)}h {Math.floor((systemHealth.serverUptimeSeconds % 3600) / 60)}m
                </span>
              </div>
            </div>
          </div>

          {/* Recent Audit Activities */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-600" />
                Recent System Activity
              </h2>
              <Link href="/team/compliance" className="text-xs font-semibold text-blue-600 hover:underline">
                View Log
              </Link>
            </div>

            <div className="space-y-1.5">
              {recentActivities.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No recent activity recorded.</p>
              ) : (
                recentActivities.slice(0, 5).map((act) => (
                  <div key={act.id} className="text-xs py-1.5 border-b border-slate-50 last:border-0">
                    <p className="font-semibold text-slate-900 truncate">{act.action}</p>
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

          {/* Companion Apps Download */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <p className="text-xs font-bold text-slate-900">Companion Applications</p>
            <p className="text-[11px] text-slate-500">Official Android APKs for staff CRM and student live polling.</p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href="/downloads/AtomicCalling.apk"
                download="AtomicCalling.apk"
                className="flex-1 text-center py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 transition"
              >
                Calling APK
              </a>
              <a
                href="/downloads/AtomicPathshala.apk"
                download="AtomicPathshala.apk"
                className="flex-1 text-center py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 transition"
              >
                Student APK
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
