import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api/response";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { STUDENT_VIEW_COOKIE } from "@/lib/auth/student-view-cookie";

const NON_TEAM_ROLES = new Set(["STUDENT", "PARENT", "GUEST"]);

/**
 * Team ⇄ Student switch: { to: "student" } opens the student portal for a
 * team member with the "student.view_as" permission (no second login);
 * { to: "team" } goes back.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiError("Unauthorized", 401);
  const { to } = (await request.json().catch(() => ({}))) as { to?: string };

  if (to === "team") {
    const res = NextResponse.json({ success: true, data: { redirect: "/team" } });
    res.cookies.delete(STUDENT_VIEW_COOKIE);
    return res;
  }
  if (to !== "student") return apiError("Unknown portal", 400);

  if (NON_TEAM_ROLES.has(session.user.role ?? "") || !(await hasPermission(session.user.id, PERMISSIONS.STUDENT_VIEW_AS))) {
    return apiError("You don't have access to the student view.", 403);
  }
  const res = NextResponse.json({ success: true, data: { redirect: "/dashboard" } });
  res.cookies.set(STUDENT_VIEW_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
