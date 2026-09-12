import "server-only";
import { prisma } from "@/lib/db";
import { getSubscription, hasActiveSubscription } from "@/lib/subscription/guard";

/**
 * The single source of truth for "does this signed-in user have paid/
 * granted access to this specific batch" — read-only, NEVER creates or
 * mutates a BatchEnrollment row. This is the fix for the auto-enrollment
 * vulnerability: every caller that used to silently provision access
 * (resolveStudentForSchedule, resolveWhiteboardAccess) now delegates here
 * (or to an equivalent read-only check) instead of writing to the DB on a
 * cache-miss.
 *
 * Mirrors resolveWhiteboardAccess's style (re-check the DB on every call,
 * never trust a client-supplied id) but is batch-scoped rather than
 * schedule/session-scoped, so it can be reused by any batch-gated content
 * endpoint (study material, recordings, purchase-status UI, etc).
 */
export type BatchAccessResult =
  | { status: "NOT_AUTHENTICATED" }
  | { status: "NO_ACCESS" }
  | { status: "ACTIVE_ENROLLMENT"; studentId: string; enrollmentId: string }
  | { status: "ACTIVE_SUBSCRIPTION"; studentId: string; subscriptionId: string }
  | { status: "ADMIN_GRANTED"; actingAsTeacherId: string }
  | { status: "EXPIRED_ACCESS"; studentId: string }
  | { status: "SUSPENDED_ACCESS"; studentId: string };

export async function resolveBatchAccess(
  userId: string | undefined | null,
  batchId: string
): Promise<BatchAccessResult> {
  if (!userId) return { status: "NOT_AUTHENTICATED" };

  // Admin / Academic Head override — same BATCH_UPDATE permission check
  // resolveTeacherForSchedule already uses for "act as the teacher" access.
  // Here it means "staff with batch-management rights can view/manage any
  // batch's content," which is a different concern from an explicit
  // admin-granted BatchEnrollment for a specific student (that case is
  // just a normal ACTIVE_ENROLLMENT row with enrolledById set by staff).
  const { hasPermission } = await import("@/lib/rbac/guard");
  const { PERMISSIONS } = await import("@/lib/rbac/permissions");
  const canManageBatch = await hasPermission(userId, PERMISSIONS.BATCH_UPDATE);
  if (canManageBatch) {
    return { status: "ADMIN_GRANTED", actingAsTeacherId: userId };
  }

  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) return { status: "NO_ACCESS" };

  const enrollment = await prisma.batchEnrollment.findFirst({
    where: { studentId: student.id, batchId },
  });

  if (enrollment) {
    if (enrollment.status === "ACTIVE") {
      return { status: "ACTIVE_ENROLLMENT", studentId: student.id, enrollmentId: enrollment.id };
    }
    if (enrollment.status === "COMPLETED") return { status: "EXPIRED_ACCESS", studentId: student.id };
    if (enrollment.status === "DROPPED") return { status: "SUSPENDED_ACCESS", studentId: student.id };
  }

  // No direct enrollment for this batch — a platform Subscription may still
  // cover it. NOTE: Subscription has no batch-scoping field anywhere in the
  // schema today (confirmed), so an active subscription is treated as
  // covering every batch — the most defensible reading of "subscription
  // grants application/batch access" given no per-batch scope exists to
  // check. Narrow this once/if a real per-batch subscription scope is added.
  if (await hasActiveSubscription(student.id)) {
    const sub = await getSubscription(student.id);
    if (sub) return { status: "ACTIVE_SUBSCRIPTION", studentId: student.id, subscriptionId: sub.id };
  }

  return { status: "NO_ACCESS" };
}
