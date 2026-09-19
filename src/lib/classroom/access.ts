import "server-only";
import { prisma } from "@/lib/db";
import type { ScheduleAccessTarget } from "@/lib/schedule/access-rules";

export { resolveTeacherForSchedule, resolveStudentForSchedule } from "@/lib/batch/access";

export type ClassroomAccess =
  | { role: "TEACHER"; entityId: string; name: string }
  | { role: "STUDENT"; entityId: string; name: string };

/**
 * The Classroom equivalent of src/lib/whiteboard/access.ts's
 * resolveWhiteboardAccess — same shape and same rules (teacher must own the
 * session; student must have real batch access via resolveBatchAccess; an
 * Admin/Super Admin/Academic Head can act as the teacher), but resolved
 * against ClassroomSession instead. Kept as a separate function rather than
 * a shared/parameterized one on purpose — Whiteboard's access resolver must
 * never be edited for Classroom's sake.
 */
export async function resolveClassroomAccess(
  userId: string,
  classroomSessionId: string
): Promise<ClassroomAccess | null> {
  const session = await prisma.classroomSession.findUnique({
    where: { id: classroomSessionId },
    include: { teacher: { include: { user: true } }, batchSchedule: true },
  });
  if (!session) return null;

  if (session.teacher.userId === userId) {
    return { role: "TEACHER", entityId: session.teacherId, name: session.teacher.user.name };
  }

  const [canAdminClass, student] = await Promise.all([
    (async () => {
      const { hasPermission } = await import("@/lib/rbac/guard");
      const { PERMISSIONS } = await import("@/lib/rbac/permissions");
      return hasPermission(userId, PERMISSIONS.BATCH_UPDATE);
    })(),
    prisma.student.findUnique({ where: { userId }, include: { user: true } }),
  ]);

  if (canAdminClass) {
    const adminUser = await prisma.user.findUnique({ where: { id: userId } });
    return { role: "TEACHER", entityId: session.teacherId, name: adminUser?.name || "Academic Head" };
  }

  if (!student) return null;

  const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
  const access = await resolveBatchAccess(userId, session.batchSchedule.batchId);
  if (
    access.status !== "ACTIVE_ENROLLMENT" &&
    access.status !== "ACTIVE_SUBSCRIPTION" &&
    access.status !== "ADMIN_GRANTED"
  ) {
    return null;
  }

  return { role: "STUDENT", entityId: student.id, name: student.user.name };
}

type ClassroomSessionForTarget = {
  phase: string;
  startedAt: Date | null;
  endedAt: Date | null;
} | null;

/**
 * Adapts a ClassroomSession into the exact shape src/lib/schedule/
 * access-rules.ts's ScheduleAccessTarget expects under its
 * `liveWhiteboardSession` key, so getEffectiveScheduleStatus /
 * canStudentJoinClass / canTeacherStartClass can be reused UNMODIFIED for
 * Classroom gating — access-rules.ts itself is never edited for this.
 *
 * Mapping: ClassroomPhase values line up 1:1 with the livePhase strings
 * access-rules.ts already special-cases (SCHEDULED/PREPARING/LIVE), and any
 * "the session concluded" phase (ENDED/RECORDED/PROCESSING_RECORDING/
 * CANCELLED/FAILED) maps to status "ENDED" so isScheduleGenuinelyLive's
 * ENDED short-circuit fires the same way it does for Whiteboard.
 */
export function toScheduleAccessTarget(
  schedule: { id: string; startsAt: Date | string; endsAt: Date | string; status: string; type?: string },
  classroomSession: ClassroomSessionForTarget
): ScheduleAccessTarget {
  const concluded =
    !!classroomSession &&
    ["ENDED", "RECORDED", "PROCESSING_RECORDING", "CANCELLED", "FAILED"].includes(classroomSession.phase);

  return {
    id: schedule.id,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    status: schedule.status,
    type: schedule.type,
    liveWhiteboardSession: classroomSession
      ? {
          status: concluded ? "ENDED" : "ACTIVE",
          livePhase: concluded ? "ENDED" : classroomSession.phase,
          actualStartedAt: classroomSession.startedAt,
        }
      : null,
  };
}
