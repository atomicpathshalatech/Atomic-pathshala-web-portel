import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import type { PermissionCode } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export interface TeamUserSession {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Logged-in team member holding `permission`; returns their user id as primitive string. */
export async function requireTeam(permission: PermissionCode): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  await requirePermission(session.user.id, permission);
  return session.user.id;
}

/** Logged-in team member holding `permission`; returns full user session info including up-to-date DB role. */
export async function requireTeamUser(permission: PermissionCode): Promise<TeamUserSession> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  await requirePermission(session.user.id, permission);

  // Always query database for canonical role and status so role updates are reflected immediately
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: { select: { name: true } } },
  });

  const role = dbUser?.role?.name || (session.user as any)?.role || "";
  const name = dbUser?.name || session.user.name || "";
  const email = dbUser?.email || session.user.email || "";

  return {
    id: session.user.id,
    name,
    email,
    role,
  };
}

export async function can(userId: string, permission: PermissionCode): Promise<boolean> {
  return hasPermission(userId, permission);
}
