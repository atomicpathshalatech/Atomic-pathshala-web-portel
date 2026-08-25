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

  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) return { schedule, teacher: null };

  if (schedule.teacherId === teacher.id) return { schedule, teacher };

  const assigned = await prisma.batchTeacher.findFirst({
    where: { batchId: schedule.batchId, teacherId: teacher.id },
  });
  if (!assigned) return { schedule, teacher: null };

  return { schedule, teacher };
}

export async function resolveStudentForSchedule(userId: string, batchScheduleId: string) {
  const schedule = await prisma.batchSchedule.findUnique({ where: { id: batchScheduleId } });
  if (!schedule) return { schedule: null, student: null };

  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) return { schedule, student: null };

  const enrolled = await prisma.batchEnrollment.findFirst({
    where: { studentId: student.id, batchId: schedule.batchId, status: "ACTIVE" },
  });
  if (!enrolled) return { schedule, student: null };

  return { schedule, student };
}
