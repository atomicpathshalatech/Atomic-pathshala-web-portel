import "server-only";
import { prisma } from "@/lib/db";

/**
 * Admin only (and Founder). Highest-level administrative role check.
 * Read from the database, not the session, so a demoted or
 * suspended account loses access immediately.
 */
export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, role: { select: { name: true } } } });
  return Boolean(user && user.status === "ACTIVE" && (user.role?.name === "ADMIN" || user.role?.name === "FOUNDER"));
}

export const isSuperAdmin = isAdmin;
