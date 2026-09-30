import "server-only";
import { prisma } from "@/lib/db";

/**
 * Super Admin only (and Founder, who is above it). Deliberately NOT the
 * permission system: ADMIN passes every permission check, and these pages
 * (every student's and every staff member's performance) are for the top
 * role only. Read from the database, not the session, so a demoted or
 * suspended account loses access immediately.
 */
export async function isSuperAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, role: { select: { name: true } } } });
  return Boolean(user && user.status === "ACTIVE" && (user.role?.name === "SUPER_ADMIN" || user.role?.name === "FOUNDER"));
}
