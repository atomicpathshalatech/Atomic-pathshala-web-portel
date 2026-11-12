import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { hasPermission } from "@/lib/rbac/permissions";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { isSuperAdmin } from "@/lib/rbac/super-admin";

export async function requireGamificationAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  const superAdmin = await isSuperAdmin(session.user.id);
  if (superAdmin) {
    return { session, user: session.user, isSuper: true };
  }

  const canManage = await hasPermission(session.user.id, PERMISSIONS.GAMIFICATION_MANAGE);
  if (!canManage) {
    throw new ForbiddenError("You do not have permission to manage the XP and Gamification engine.");
  }

  return { session, user: session.user, isSuper: false };
}
