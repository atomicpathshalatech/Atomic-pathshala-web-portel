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
];
const NON_TEAM_ROLES = new Set(["STUDENT", "PARENT", "GUEST"]);

/**
 * Route protection for the Student Portal and Team Portal.
 *
 * This is a coarse, edge-safe check (JWT role claim only — middleware can't
 * query Postgres). The real, DB-backed RBAC permission check happens in
 * `requireStudentSession()` / `requireTeamSession()` on the page itself.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isTeamPath = pathname.startsWith("/team");
  const isStudentPath = STUDENT_PATHS.some((p) => pathname.startsWith(p));

  if (isStudentPath && token.role !== "STUDENT") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isTeamPath && NON_TEAM_ROLES.has(token.role as string)) {
    return NextResponse.redirect(new URL("/", request.url));
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
    "/team/:path*",
  ],
};
