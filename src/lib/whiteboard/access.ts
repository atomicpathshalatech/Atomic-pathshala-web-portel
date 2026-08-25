import "server-only";
import { prisma } from "@/lib/db";

export { resolveTeacherForSchedule, resolveStudentForSchedule } from "@/lib/batch/access";

export type WhiteboardAccess =
  | { role: "TEACHER"; entityId: string; name: string }
  | { role: "STUDENT"; entityId: string; name: string };

/**
 * The single source of truth for "can this signed-in user see/act on this
 * whiteboard session". Used by /api/pusher/auth (realtime channel
 * authorization) AND every /api/whiteboard/* REST route below — one
 * function, not parallel copies of the same rule, per the "reuse existing
 * components, do not create duplicate systems" rule.
 *
 * Teacher: must be the session's own teacher (the one who started it) —
 * NOT just any teacher assigned to the batch, since ownership of an
 * in-progress session is single-teacher once created.
 * Student: must be ACTIVELY enrolled in the batch the session's schedule
 * belongs to.
 * Both branches re-check the DB on every call. Nothing here trusts a
 * client-supplied userId/role — the only identity input is the server
 * session's own user id.
 */
export async function resolveWhiteboardAccess(
  userId: string,
  whiteboardSessionId: string
): Promise<WhiteboardAccess | null> {
  const wbSession = await prisma.whiteboardSession.findUnique({
    where: { id: whiteboardSessionId },
    include: { teacher: { include: { user: true } }, batchSchedule: true },
  });
  if (!wbSession) return null;

  if (wbSession.teacher.userId === userId) {
    return {
      role: "TEACHER",
      entityId: wbSession.teacherId,
      name: wbSession.teacher.user.name,
    };
  }

  const student = await prisma.student.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!student) return null;

  const enrolled = await prisma.batchEnrollment.findFirst({
    where: {
      studentId: student.id,
      batchId: wbSession.batchSchedule.batchId,
      status: "ACTIVE",
    },
  });
  if (!enrolled) return null;

  return { role: "STUDENT", entityId: student.id, name: student.user.name };
}
