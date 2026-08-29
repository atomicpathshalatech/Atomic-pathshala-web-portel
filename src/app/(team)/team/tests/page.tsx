import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Tests",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-surface-container-high text-on-surface-variant",
  PUBLISHED: "bg-primary/10 text-primary",
  ARCHIVED: "bg-outline-variant/30 text-on-surface-variant",
};

export default async function TestsListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.TEST_CREATE);
  const isAdmin = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

  let tests;
  if (isAdmin) {
    tests = await prisma.test.findMany({
      include: {
        batchSchedule: { include: { batch: { select: { name: true } } } },
        sections: { select: { _count: { select: { questions: true } } } },
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    const assignedBatchIds = new Set<string>();
    if (teacher) {
      const [directSchedules, batchAssignments] = await Promise.all([
        prisma.batchSchedule.findMany({ where: { teacherId: teacher.id }, select: { batchId: true } }),
        prisma.batchTeacher.findMany({ where: { teacherId: teacher.id }, select: { batchId: true } }),
      ]);
      directSchedules.forEach((s) => assignedBatchIds.add(s.batchId));
      batchAssignments.forEach((b) => assignedBatchIds.add(b.batchId));
    }
    tests = await prisma.test.findMany({
      where: { batchSchedule: { batchId: { in: Array.from(assignedBatchIds) } } },
      include: {
        batchSchedule: { include: { batch: { select: { name: true } } } },
        sections: { select: { _count: { select: { questions: true } } } },
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Tests</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Timed tests assembled from the Question Bank, delivered through a batch's timetable.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/tests/new"
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-label-md hover:opacity-90 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Test
          </Link>
        )}
      </div>

      {tests.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No tests yet. {canCreate && "Create one from a batch's \"Test\" timetable slot."}
        </div>
      ) : (
        <ul className="space-y-2">
          {tests.map((t) => {
            const questionCount = t.sections.reduce((sum, s) => sum + s._count.questions, 0);
            return (
              <li key={t.id}>
                <Link
                  href={`/team/tests/${t.id}`}
                  className="glass-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 hover:shadow-md transition-all block"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                          STATUS_STYLES[t.status] ?? "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {t.status}
                      </span>
                      {t.batchSchedule && (
                        <span className="text-label-sm text-on-surface-variant">{t.batchSchedule.batch.name}</span>
                      )}
                    </div>
                    <p className="font-label-md text-label-md text-on-surface">{t.name}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      {questionCount} question{questionCount === 1 ? "" : "s"} · {t.durationMin} min ·{" "}
                      {t._count.attempts} attempt{t._count.attempts === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
