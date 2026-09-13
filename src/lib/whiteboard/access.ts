import "server-only";
import { prisma } from "@/lib/db";
import { isPastGracePeriod, endWhiteboardSession } from "@/lib/whiteboard/lifecycle";

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
 * Student: must have real, existing access to the batch the session's
 * schedule belongs to (active paid enrollment, active subscription, or an
 * admin grant) — resolved via resolveBatchAccess, never fabricated here.
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

  // Backend-enforced auto-end: there is no cron/worker in this app, so a
  // class that ran past its scheduled end (+ grace) is force-ended lazily,
  // the next time ANYONE touches it — this function is the one choke point
  // every whiteboard route and /api/pusher/auth already goes through, so
  // it's the natural place for this rather than repeating the check in
  // every route individually. Mutate the local object after ending so this
  // same call returns fresh (ENDED) status instead of the now-stale ACTIVE
  // row it fetched a moment ago.
  if (wbSession.status === "ACTIVE" && isPastGracePeriod(wbSession.batchSchedule.endsAt)) {
    await endWhiteboardSession(wbSession.id, { endedByUserId: null, reason: "auto_grace_expired" });
    wbSession.status = "ENDED";
    wbSession.livePhase = "ENDED";
  }

  if (wbSession.teacher.userId === userId) {
    return {
      role: "TEACHER",
      entityId: wbSession.teacherId,
      name: wbSession.teacher.user.name,
    };
  }

  // Every non-owning-teacher call (which, in practice, is nearly every
  // student action — sending a chat message, answering a quiz, raising a
  // hand) used to pay for this admin-permission check and the student
  // lookup as two SEQUENTIAL round-trips before finding out the caller was
  // just a plain student. That's the actual reason student-initiated
  // realtime actions (chat especially) measured slower than the teacher's:
  // the teacher branch above resolves with zero extra queries, while every
  // student request was paying ~2 extra round-trips it didn't need to pay
  // sequentially. Neither query depends on the other's result, so run them
  // together instead.
  const [canAdminClass, student] = await Promise.all([
    (async () => {
      // Allow Admins, Super Admins, and Academic Heads to access as TEACHER
      const { hasPermission } = await import("@/lib/rbac/guard");
      const { PERMISSIONS } = await import("@/lib/rbac/permissions");
      return hasPermission(userId, PERMISSIONS.BATCH_UPDATE);
    })(),
    prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    }),
  ]);

  if (canAdminClass) {
    const adminUser = await prisma.user.findUnique({ where: { id: userId } });
    return {
      role: "TEACHER",
      entityId: wbSession.teacherId,
      name: adminUser?.name || "Academic Head",
    };
  }

  if (!student) return null;

  // Read-only entitlement check — never auto-creates a BatchEnrollment.
  // resolveBatchAccess is the one centralized "does this user have real,
  // paid/granted access to this batch" function; a plain enrollment lookup
  // that silently fabricated ACTIVE rows used to live here, which is
  // exactly the auto-enrollment vulnerability this delegates away from.
  const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
  const access = await resolveBatchAccess(userId, wbSession.batchSchedule.batchId);
  if (
    access.status !== "ACTIVE_ENROLLMENT" &&
    access.status !== "ACTIVE_SUBSCRIPTION" &&
    access.status !== "ADMIN_GRANTED"
  ) {
    return null;
  }

  return { role: "STUDENT", entityId: student.id, name: student.user.name };
}
