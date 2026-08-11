import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Faculty",
};

export default async function FacultyListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEACHER_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.TEACHER_CREATE);

  const teachers = await prisma.teacher.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary">Faculty</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {teachers.length} educator{teachers.length === 1 ? "" : "s"} onboarded.
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-3">
            <Link
              href="/team/faculty/applications"
              className="flex items-center gap-2 border border-primary text-primary px-6 py-3 rounded-xl font-label-md hover:bg-primary/5 transition-all"
            >
              <span className="material-symbols-outlined">pending_actions</span>
              Review Applications
            </Link>
            <Link
              href="/team/faculty/new"
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined">person_add</span>
              Onboard Educator
            </Link>
          </div>
        )}
      </div>

      {teachers.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No educators onboarded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {teachers.map((t) => (
            <Link
              key={t.id}
              href={`/team/faculty/${t.id}/edit`}
              className="glass-card rounded-2xl p-6 space-y-3 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {t.user.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">{t.user.name}</h3>
                <p className="text-label-sm font-label-sm text-primary">{t.department}</p>
              </div>
              <p className="text-label-sm text-on-surface-variant">Code: {t.employeeCode}</p>
              {t.subjects.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.subjects.map((s) => (
                    <span key={s} className="bg-surface-container-high px-2 py-0.5 rounded text-[11px]">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
