import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import type { PermissionCode } from "@/lib/rbac/permissions";

/** Logged-in team member holding `permission`; returns their user id. */
export async function requireTeam(permission: PermissionCode): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  await requirePermission(session.user.id, permission);
  return session.user.id;
}

export async function can(userId: string, permission: PermissionCode): Promise<boolean> {
  return hasPermission(userId, permission);
}
