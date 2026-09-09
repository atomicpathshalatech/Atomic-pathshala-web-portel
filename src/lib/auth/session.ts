import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserPermissionCodes } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Defense-in-depth alongside middleware.ts: middleware runs on the edge and
 * can only check the JWT, not query the DB. This does the real DB-backed
 * check and hands the page everything it needs in one call.
 *
 * Wrapped in React's cache() — both `(team)/team/layout.tsx` and every page
 * under it call this same function once per request. Without caching, that
 * meant the entire session+DB check (2-3 queries) ran TWICE, sequentially,
 * for a single navigation. cache() dedupes it to one real call per request;
 * every other caller in the same render gets the already-resolved result
 * for free. Measured impact matters here specifically because the DB
 * (Supabase ap-northeast-1) is cross-region from the Vercel function, so
 * each avoided round trip is on the order of a second, not a few ms.
 */
export const requireStudentSession = cache(async function requireStudentSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "STUDENT" && session.user.role !== "PARENT") {
    redirect("/team");
  }

  // `subscription` is included here so the Student layout doesn't have to
  // fire a second, sequential cross-region query for it on every load — the
  // cached result is shared by the layout and every page in the same render.
  let student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    include: { user: true, subscription: { select: { status: true } } },
  });

  if (!student) {
    try {
      const code = Date.now().toString().slice(-6);
      student = await prisma.student.create({
        data: {
          userId: session.user.id,
          enrollmentNumber: `ENR-${code}`,
          studentIdCode: `AP-${code}`,
          fatherName: "Parent",
          motherName: "Parent",
          dob: new Date(2007, 0, 1),
          gender: "MALE",
          class: "12",
          targetExam: "NEET",
          school: "Atomic Pathshala",
          city: "New Delhi",
          state: "Delhi",
        },
        include: { user: true, subscription: { select: { status: true } } },
      });
    } catch {
      redirect("/login");
    }
  }

  if (!student) {
    redirect("/login");
  }

  return { session, student };
});

/**
 * Team Portal gate. Unlike the student check (single role), team access spans
 * 11 different roles — so this checks the TEAM_PORTAL_ACCESS permission via
 * RBAC rather than comparing role names, per the "no hardcoded role checks"
 * policy in permissions.ts.
 *
 * Fetches the User row ONCE and passes it into hasPermission() instead of
 * letting hasPermission do its own separate findUnique for the same row —
 * on a cross-region DB (Supabase ap-northeast-1 vs a Vercel function likely
 * running elsewhere) every avoided round trip is real, measured latency:
 * this page previously paid for the same User row twice, sequentially.
 *
 * Also wrapped in React's cache() — see requireStudentSession's comment
 * above, same reasoning: `(team)/team/layout.tsx` AND every page under it
 * both call this, so without caching the full check (now 2 queries) ran
 * twice per request. Confirmed via production timing: /team/my-schedule's
 * document took 7.8s to finish streaming despite a 70ms TTFB, consistent
 * with this exact double-auth-check plus the page's own queries, all
 * sequential, all crossing to Tokyo.
 */
export const requireTeamSession = cache(async function requireTeamSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  // One pass for the whole permission set — the Team layout needs every
  // code anyway to build its nav, and access == "does that set contain
  // TEAM_PORTAL_ACCESS". Previously the layout ran hasPermission() here AND
  // getUserPermissionCodes() separately, double-querying rolePermission +
  // userPermissionOverride. cache() dedupes this across layout + pages.
  const [user, permissions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      // `teacher` is a lightweight existence probe so the Team layout doesn't
      // need a separate teacher.count() round trip for its "My Schedule" nav.
      include: { role: true, teacher: { select: { id: true } } },
    }),
    getUserPermissionCodes(session.user.id),
  ]);

  if (!user) {
    redirect("/login");
  }

  // Authenticated, but not (yet) a working staff account: no role assigned,
  // or an account state that isn't ACTIVE. These users can sign in — they
  // just land on /access-denied instead of any protected staff route.
  const STAFF_WAITING_STATES: string[] = [
    "PENDING_VERIFICATION",
    "APPROVAL_PENDING",
    "INVITED",
    "NO_ROLE",
    "SUSPENDED",
    "INACTIVE",
    "EXPIRED",
    "EX_EDUCATOR",
    "EX_TEAM_MEMBER",
  ];
  if (!user.role || STAFF_WAITING_STATES.includes(user.status)) {
    redirect("/access-denied");
  }

  if (!permissions.has(PERMISSIONS.TEAM_PORTAL_ACCESS)) {
    if (user.role.name === "STUDENT" || user.role.name === "PARENT") {
      redirect("/dashboard");
    }
    redirect("/access-denied");
  }

  return { session, user, permissions };
});
