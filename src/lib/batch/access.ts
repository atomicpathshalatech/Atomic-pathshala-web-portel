import "server-only";
import { prisma } from "@/lib/db";

/**
 * Batch-level ownership checks — "is this teacher assigned to teach this
 * batch/schedule" and "is this student actively enrolled in it". Originally
 * written for the Live Whiteboard feature, moved here because the Test
 * Engine needs the exact same rule (a Test binds 1:1 to a BatchSchedule the
 * same way a WhiteboardSession does) — one shared implementation instead of
 * two copies, per the "reuse existing components, don't duplicate" rule.
 * src/lib/whiteboard/access.ts re-exports these for backward compatibility
 * with existing whiteboard routes.
 */

export async function resolveTeacherForSchedule(userId: string, batchScheduleId: string) {
  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: batchScheduleId },
  });
  if (!schedule) return { schedule: null, teacher: null };

  let teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (teacher) {
    if (schedule.teacherId === teacher.id) return { schedule, teacher };

    const assigned = await prisma.batchTeacher.findFirst({
      where: { batchId: schedule.batchId, teacherId: teacher.id },
    });
    if (assigned) return { schedule, teacher };
  }

  // Admin / Academic Head override: check if user has batch management permission
  const { hasPermission } = await import("@/lib/rbac/guard");
  const { PERMISSIONS } = await import("@/lib/rbac/permissions");
  const canManageBatch = await hasPermission(userId, PERMISSIONS.BATCH_UPDATE);
  if (canManageBatch) {
    if (teacher) return { schedule, teacher };

    // If admin does not have a Teacher record, find or create one so they can conduct/manage class
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      teacher = await prisma.teacher.findFirst({ where: { userId } });
      if (!teacher) {
        const code = Date.now().toString().slice(-6);
        teacher = await prisma.teacher.create({
          data: {
            userId: user.id,
            employeeCode: `ADM-INST-${code}`,
            department: "Academic Operations",
            subjects: ["General", "All Subjects"],
            bio: "Academic Administrator and Instructor",
          },
        });
      }
      return { schedule, teacher };
    }
  }

  return { schedule, teacher: null };
}

/**
 * Read-only. Never creates or reactivates a BatchEnrollment — a student is
 * only "resolved" here if they already have real access to the schedule's
 * batch (a paid ACTIVE enrollment, an active subscription, or an admin
 * grant), checked via the centralized resolveBatchAccess(). Returning
 * `student: null` is this function's deny signal; every existing caller
 * already treats it that way (see e.g. tests/[id]/result/my/route.ts and
 * whiteboard/sessions/by-schedule/[batchScheduleId]/route.ts, both of which
 * throw ForbiddenError on a null student), so tightening this check requires
 * no caller-side changes.
 */
export async function resolveStudentForSchedule(userId: string, batchScheduleId: string) {
  const schedule = await prisma.batchSchedule.findUnique({ where: { id: batchScheduleId } });
  if (!schedule) return { schedule: null, student: null };

  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) return { schedule, student: null };

  const { resolveBatchAccess } = await import("./entitlement");
  const access = await resolveBatchAccess(userId, schedule.batchId);
  const allowed =
    access.status === "ACTIVE_ENROLLMENT" ||
    access.status === "ACTIVE_SUBSCRIPTION" ||
    access.status === "ADMIN_GRANTED";
  if (!allowed) return { schedule, student: null };

  return { schedule, student };
}

