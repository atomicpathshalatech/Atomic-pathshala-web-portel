import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DoubtBookingTeacherConsole } from "@/components/team-portal/DoubtBookingTeacherConsole";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Doubt Book Session",
};

export default async function TeacherDoubtBookingPage() {
  const { user } = await requireTeamSession();
  const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });

  if (!teacher) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <header>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Doubt Book Session</h1>
        </header>
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-500">
          This account does not have a teacher profile, so there is nothing to publish here.
        </div>
      </div>
    );
  }

  return <DoubtBookingTeacherConsole />;
}
