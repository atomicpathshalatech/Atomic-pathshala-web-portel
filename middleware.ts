import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const STUDENT_PATHS = [
  "/dashboard",
  "/courses",
  "/tests",
  "/id-card",
  "/notifications",
  "/dpp",
  "/schedule",
  "/doubts",
  "/subscription",
  "/practice-board",
  "/live-class",
  "/settings",
  "/leaderboard",
];
const NON_TEAM_ROLES = new Set(["STUDENT", "PARENT", "GUEST"]);

/**
 * Route protection for the Student Portal and Team Portal.
 *
 * This is a coarse, edge-safe check (JWT role claim only — middleware can't
 * query Postgres). The real, DB-backed RBAC permission check happens in
 * `requireStudentSession()` / `requireTeamSession()` on the page itself.
 *
 * Added `/live-class` and `/settings` to STUDENT_PATHS — both already had
 * (or now have) real pages under `(student)/*` but were missing from this
 * list, so they weren't edge-protected (page-level `requireStudentSession()`
 * still protected them either way, but an unauthenticated request wouldn't
 * get redirected until the page itself ran).
 *
 * Added `/leaderboard` for the new student leaderboard page (gamification).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "atomic-pathshala-production-enterprise-secret-key-2026-secure-jwt";
  const token = await getToken({ req: request, secret });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isTeamPath = pathname.startsWith("/team");
  const isStudentPath = STUDENT_PATHS.some((p) => pathname.startsWith(p));

  if (isStudentPath && token.role !== "STUDENT" && token.role !== "PARENT") {
    return NextResponse.redirect(new URL("/team", request.url));
  }

  if (isTeamPath && NON_TEAM_ROLES.has(token.role as string)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/courses/:path*",
    "/tests/:path*",
    "/id-card/:path*",
    "/notifications/:path*",
    "/dpp/:path*",
    "/schedule/:path*",
    "/doubts/:path*",
    "/subscription/:path*",
    "/practice-board/:path*",
    "/live-class/:path*",
    "/settings/:path*",
    "/leaderboard/:path*",
    "/team/:path*",
  ],
};
