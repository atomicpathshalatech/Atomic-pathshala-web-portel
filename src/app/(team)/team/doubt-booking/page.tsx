import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DoubtBookingTeacherConsole } from "@/components/team-portal/DoubtBookingTeacherConsole";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Doubt Book Session",
};

export default async function TeacherDoubtBookingPage() {
  const { user } = await requireTeamSession();
  const [teacher, isAdmin] = await Promise.all([
    prisma.teacher.findUnique({ where: { userId: user.id } }),
    hasPermission(user.id, PERMISSIONS.BATCH_UPDATE),
  ]);

  let allTeachers: { id: string; name: string; email?: string | null }[] = [];
  if (isAdmin) {
    const rawTeachers = await prisma.teacher.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    });
    allTeachers = rawTeachers.map((t) => ({
      id: t.id,
      name: t.user.name,
      email: t.user.email,
    }));
  }

  if (!teacher && !isAdmin) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <header>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Doubt Book Session</h1>
        </header>
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500">
          This account does not have a teacher profile or supervisor access to manage doubt session bookings.
        </div>
      </div>
    );
  }

  const initialTeacherId = teacher?.id || allTeachers[0]?.id || "";

  return (
    <DoubtBookingTeacherConsole
      initialTeacherId={initialTeacherId}
      teachers={allTeachers}
      isAdmin={isAdmin}
      hasOwnTeacherProfile={Boolean(teacher)}
    />
  );
}
