import "server-only";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resolveTeacherForSchedule } from "@/lib/batch/access";

/**
 * Can this signed-in user manage (view/edit/publish) a given Test? Either
 * they hold the admin-tier TEST_PUBLISH permission (ACADEMIC_HEAD/SUPER_ADMIN
 * etc.), or they're a teacher actually assigned to the batch the test's
 * schedule entry belongs to — same ownership rule the live whiteboard uses,
 * checked fresh against the DB every call.
 */
export async function canManageTest(userId: string, batchScheduleId: string): Promise<boolean> {
  const isAdmin = await hasPermission(userId, PERMISSIONS.TEST_PUBLISH);
  if (isAdmin) return true;

  const { teacher } = await resolveTeacherForSchedule(userId, batchScheduleId);
  return Boolean(teacher);
}

export async function getTestOr404(testId: string) {
  return prisma.test.findUnique({ where: { id: testId } });
}
