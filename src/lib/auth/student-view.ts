import "server-only";
import { cookies } from "next/headers";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { STUDENT_VIEW_COOKIE } from "./student-view-cookie";

const NON_TEAM_ROLES = new Set(["STUDENT", "PARENT", "GUEST"]);

/** A team member who switched to the student portal (cookie set + permission). */
export async function isTeamStudentView(user: { id?: string | null; role?: string | null } | null | undefined): Promise<boolean> {
  if (!user?.id || !user.role || NON_TEAM_ROLES.has(user.role)) return false;
  if (cookies().get(STUDENT_VIEW_COOKIE)?.value !== "1") return false;
  return hasPermission(user.id, PERMISSIONS.STUDENT_VIEW_AS);
}
