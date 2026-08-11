import "server-only";
import { prisma } from "@/lib/db";
import type { PermissionCode } from "@/lib/rbac/permissions";

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in to perform this action.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Checks whether the given user (by id) holds the given permission,
 * by resolving User -> Role -> RolePermission -> Permission.
 * This is the ONLY sanctioned way to gate access. Never compare
 * `user.role.name === "SUPER_ADMIN"` inline in feature code.
 */
export async function hasPermission(
  userId: string,
  permission: PermissionCode
): Promise<boolean> {
  const count = await prisma.rolePermission.count({
    where: {
      permission: { code: permission },
      role: { users: { some: { id: userId } } },
    },
  });
  return count > 0;
}

/**
 * Returns every permission code the user holds, in one query — used to
 * filter UI (e.g. sidebar nav items) rather than making N separate
 * hasPermission() calls per render.
 */
export async function getUserPermissionCodes(userId: string): Promise<Set<PermissionCode>> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { users: { some: { id: userId } } } },
    select: { permission: { select: { code: true } } },
  });
  return new Set(rows.map((r) => r.permission.code as PermissionCode));
}

/**
 * Throws if the user lacks the permission. Use at the top of every
 * Server Action / API route handler that mutates or reads protected data.
 */
export async function requirePermission(
  userId: string | undefined | null,
  permission: PermissionCode
): Promise<void> {
  if (!userId) throw new UnauthorizedError();
  const allowed = await hasPermission(userId, permission);
  if (!allowed) throw new ForbiddenError();
}
