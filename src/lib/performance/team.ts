import "server-only";
import type { GlobalRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeTeachingStats, type TeacherTeachingStats } from "@/lib/teaching/stats";

/**
 * Team performance for the Super Admin board.
 *   Teachers: actual teaching time + views (lib/teaching/stats), classes
 *             taught vs cancelled, DPPs/tests they created, doubts solved,
 *             and how many students were present in their live classes.
 *   Other staff: what the system records about them — last login, how much
 *             they did (audit trail) and what kind of work it was.
 */

const STAFF_EXCLUDED_ROLES: GlobalRole[] = ["STUDENT", "PARENT", "GUEST"];

export interface TeacherBoardRow extends TeacherTeachingStats {
  name: string;
  email: string;
  employeeCode: string | null;
  department: string | null;
  classesScheduled: number;
  classesCancelled: number;
  dppsCreated: number;
  testsCreated: number;
  doubtsSolved: number;
  studentsPresent: number;
  lastLoginAt: Date | null;
}

export async function teacherBoard(opts: { from?: Date; to?: Date } = {}): Promise<TeacherBoardRow[]> {
  const teachers = await prisma.teacher.findMany({
    select: { id: true, employeeCode: true, department: true, user: { select: { id: true, name: true, email: true, lastLoginAt: true, status: true } } },
  });
  const ids = teachers.map((t) => t.id);
  const userIds = teachers.map((t) => t.user.id);
  const range = opts.from || opts.to ? { ...(opts.from && { gte: opts.from }), ...(opts.to && { lt: opts.to }) } : undefined;

  const [teaching, schedules, dpps, tests, doubts, presence] = await Promise.all([
    computeTeachingStats({ teacherIds: ids, from: opts.from, to: opts.to }),
    prisma.batchSchedule.groupBy({
      by: ["teacherId", "status"],
      where: { teacherId: { in: ids }, isTest: false, type: "LIVE_CLASS", ...(range && { startsAt: range }) },
      _count: { _all: true },
    }),
    prisma.dpp.groupBy({ by: ["createdById"], where: { createdById: { in: userIds } }, _count: { _all: true } }),
    prisma.test.groupBy({ by: ["createdById"], where: { createdById: { in: userIds } }, _count: { _all: true } }),
    prisma.doubt.groupBy({ by: ["resolvedById"], where: { resolvedById: { in: userIds } }, _count: { _all: true } }),
    prisma.liveClassAttendance.findMany({
      where: { whiteboardSession: { teacherId: { in: ids }, batchSchedule: { isTest: false } } },
      select: { whiteboardSession: { select: { teacherId: true } } },
    }),
  ]);

  return teachers
    .map<TeacherBoardRow>((t) => {
      const mine = schedules.filter((s) => s.teacherId === t.id);
      const stats = teaching.get(t.id)!;
      return {
        ...stats,
        name: t.user.name,
        email: t.user.email,
        employeeCode: t.employeeCode,
        department: t.department,
        classesScheduled: mine.reduce((n, s) => n + s._count._all, 0),
        classesCancelled: mine.filter((s) => s.status === "CANCELLED").reduce((n, s) => n + s._count._all, 0),
        dppsCreated: dpps.find((d) => d.createdById === t.user.id)?._count._all ?? 0,
        testsCreated: tests.find((d) => d.createdById === t.user.id)?._count._all ?? 0,
        doubtsSolved: doubts.find((d) => d.resolvedById === t.user.id)?._count._all ?? 0,
        studentsPresent: presence.filter((p) => p.whiteboardSession.teacherId === t.id).length,
        lastLoginAt: t.user.lastLoginAt,
      };
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes || b.totalViews - a.totalViews);
}

export interface StaffBoardRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  actions30d: number;
  actionsTotal: number;
  lastActionAt: Date | null;
  topWork: Array<{ entityType: string; count: number }>;
}

/** Non-teacher staff: what the audit trail shows they actually did. */
export async function staffBoard(): Promise<StaffBoardRow[]> {
  const users = await prisma.user.findMany({
    where: { teacher: null, role: { name: { notIn: STAFF_EXCLUDED_ROLES } }, student: null },
    select: { id: true, name: true, email: true, status: true, lastLoginAt: true, role: { select: { name: true } } },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [total, recent, byType] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.auditLog.groupBy({ by: ["userId"], where: { userId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ["userId", "entityType"], where: { userId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  return users
    .map<StaffBoardRow>((u) => {
      const t = total.find((x) => x.userId === u.id);
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role?.name ?? "—",
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        actionsTotal: t?._count._all ?? 0,
        lastActionAt: t?._max.createdAt ?? null,
        actions30d: recent.find((x) => x.userId === u.id)?._count._all ?? 0,
        topWork: byType
          .filter((x) => x.userId === u.id)
          .map((x) => ({ entityType: x.entityType, count: x._count._all }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 4),
      };
    })
    .sort((a, b) => b.actions30d - a.actions30d);
}
