import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Defense-in-depth alongside middleware.ts: middleware runs on the edge and
 * can only check the JWT, not query the DB. This does the real DB-backed
 * check and hands the page everything it needs in one call.
 */
export async function requireStudentSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "STUDENT") {
    redirect("/");
  }

  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    include: { user: true },
  });

  if (!student) {
    // Session exists but no matching student record — shouldn't normally
    // happen, but fail safe rather than showing a broken dashboard.
    redirect("/login");
  }

  return { session, student };
}

/**
 * Team Portal gate. Unlike the student check (single role), team access spans
 * 11 different roles — so this checks the TEAM_PORTAL_ACCESS permission via
 * RBAC rather than comparing role names, per the "no hardcoded role checks"
 * policy in permissions.ts.
 */
export async function requireTeamSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const allowed = await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);
  if (!allowed) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  });

  if (!user) {
    redirect("/login");
  }

  return { session, user };
}
