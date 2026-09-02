import "server-only";
import { prisma } from "@/lib/db";
import { PERMISSIONS, ROLE_PERMISSION_DEFAULTS, type PermissionCode } from "@/lib/rbac/permissions";

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
 * Checks whether the given user holds the given permission,
 * factoring in:
 * 1. User status (Active vs Inactive/Suspended/Expired)
 * 2. Contract End Date (Auto-expiration)
 * 3. User-level explicit overrides (Grant or Deny)
 * 4. Role-based permissions & Role defaults
 */
export async function hasPermission(
  userId: string,
  permission: PermissionCode
): Promise<boolean> {
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      contractEnd: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user) return false;

  // 1. Inactive, Suspended, or Expired users are completely blocked
  if (user.status !== "ACTIVE") return false;

  // 2. Contract expiration check
  if (user.contractEnd && new Date(user.contractEnd) < new Date()) {
    return false;
  }

  // 3. Super Admin / Founder / Admin has all permissions unless explicitly overridden
  const isSuperAdmin =
    user.role.name === "SUPER_ADMIN" ||
    user.role.name === "FOUNDER" ||
    user.role.name === "ADMIN";

  // 4. Check user-level explicit override first
  const override = await prisma.userPermissionOverride.findUnique({
    where: {
      userId_permissionCode: {
        userId,
        permissionCode: permission,
      },
    },
  });

  if (override) {
    return override.granted;
  }

  if (isSuperAdmin) return true;

  // 5. Check role default catalogue
  const roleDefaults = ROLE_PERMISSION_DEFAULTS[user.role.name] || [];
  if (roleDefaults.includes(permission)) {
    return true;
  }

  // 6. Check Role permissions in DB
  const count = await prisma.rolePermission.count({
    where: {
      permission: { code: permission },
      role: { users: { some: { id: userId } } },
    },
  });

  return count > 0;
}

/**
 * Returns every effective permission code the user holds in one pass:
 * Role permissions + Granted Overrides - Denied Overrides + Role Defaults
 */
export async function getUserPermissionCodes(userId: string): Promise<Set<PermissionCode>> {
  if (!userId) return new Set();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      contractEnd: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") return new Set();
  if (user.contractEnd && new Date(user.contractEnd) < new Date()) return new Set();

  const isSuperAdmin =
    user.role.name === "SUPER_ADMIN" ||
    user.role.name === "FOUNDER" ||
    user.role.name === "ADMIN";

  if (isSuperAdmin) {
    return new Set(Object.values(PERMISSIONS));
  }

  // Role permissions from DB
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role: { users: { some: { id: userId } } } },
    select: { permission: { select: { code: true } } },
  });

  const codes = new Set<PermissionCode>(
    rolePermissions.map((r) => r.permission.code as PermissionCode)
  );

  // Add role default permissions to guarantee baseline features like Question Bank & Test creation
  const defaults = ROLE_PERMISSION_DEFAULTS[user.role.name] || [];
  defaults.forEach((d) => codes.add(d));

  // User overrides
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId },
  });

  for (const o of overrides) {
    if (o.granted) {
      codes.add(o.permissionCode as PermissionCode);
    } else {
      codes.delete(o.permissionCode as PermissionCode);
    }
  }

  return codes;
}

/**
 * Throws if the user lacks the permission.
 */
export async function requirePermission(
  userId: string | undefined | null,
  permission: PermissionCode
): Promise<void> {
  if (!userId) throw new UnauthorizedError();
  const allowed = await hasPermission(userId, permission);
  if (!allowed) throw new ForbiddenError();
}
