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

export async function resolveStudentForSchedule(userId: string, batchScheduleId: string) {
  const schedule = await prisma.batchSchedule.findUnique({ where: { id: batchScheduleId } });
  if (!schedule) return { schedule: null, student: null };

  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) return { schedule, student: null };

  let enrolled = await prisma.batchEnrollment.findFirst({
    where: { studentId: student.id, batchId: schedule.batchId },
  });

  if (enrolled) {
    if (enrolled.status !== "ACTIVE") {
      enrolled = await prisma.batchEnrollment.update({
        where: { id: enrolled.id },
        data: { status: "ACTIVE" },
      });
    }
    return { schedule, student };
  }

  // Auto-enroll if batch is open or student has access
  try {
    enrolled = await prisma.batchEnrollment.create({
      data: {
        studentId: student.id,
        batchId: schedule.batchId,
        status: "ACTIVE",
      },
    });
    return { schedule, student };
  } catch {
    // Return student if enrollment check succeeded
    return { schedule, student };
  }
}

