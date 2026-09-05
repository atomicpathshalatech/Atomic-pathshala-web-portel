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

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "STUDENT" && session.user.role !== "PARENT") {
    redirect("/team");
  }

  let student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    include: { user: true },
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
        include: { user: true },
      });
    } catch {
      redirect("/login");
    }
  }

  if (!student) {
    redirect("/login");
  }

  return { session, student };
}

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
 */
export async function requireTeamSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  });

  if (!user) {
    redirect("/login");
  }

  const allowed = await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS, user);
  if (!allowed) {
    redirect("/");
  }

  return { session, user };
}
