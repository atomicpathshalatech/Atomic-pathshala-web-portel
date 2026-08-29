import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError, requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Drop-in replacement for `_import_atomic-ai-chat`'s own `@/lib/auth`.
 * The source app had its own User/Account/Session (NextAuth) + a
 * `role: "ADMIN" | "FACULTY" | "STUDENT"` field on User for gating. Per the
 * integration decision, AI Chat authenticates through atomic-ops's existing
 * User/Student — there is no second login system, and the merged schema's
 * User has no `role` string field to compare against. So instead of
 * `user.role !== "ADMIN"` checks, every gate here goes through atomic-ops's
 * permission-code RBAC (see src/lib/rbac/permissions.ts, AICHAT_* codes).
 *
 * Function names/signatures match the source app's `@/lib/auth` so ported
 * route code only needs its import path changed, not its call sites —
 * except callers that read `user.role`/`.atomicId`/`.isPro` off the
 * returned user, which don't exist on atomic-ops's session.user and must be
 * updated at each call site (there is no equivalent field to fake here).
 */

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ? session.user : null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Source: requireAdmin() — gated api/admin/{access,analytics,batches,student-performance,users} + question-bank admin writes. */
export async function requireAdmin() {
  const user = await requireCurrentUser();
  await requirePermission(user.id, PERMISSIONS.AICHAT_ADMIN_ACCESS);
  return user;
}

/** Source: requireScheduleManager() — "Admin or faculty access is required." on api/admin/schedule[/sync]. */
export async function requireScheduleManager() {
  const user = await requireCurrentUser();
  await requirePermission(user.id, PERMISSIONS.AICHAT_SCHEDULE_MANAGE);
  return user;
}

/** Source: requireQuestionBankViewer() — "Teacher or Admin access is required." on api/admin/question-bank (read/report). */
export async function requireQuestionBankViewer() {
  const user = await requireCurrentUser();
  await requirePermission(user.id, PERMISSIONS.AICHAT_QUESTION_BANK_VIEW);
  return user;
}

export { UnauthorizedError, ForbiddenError };
