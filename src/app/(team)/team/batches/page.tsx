import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Batches",
};

const STATUS_STYLES: Record<string, string> = {
  UPCOMING: "bg-secondary/10 text-secondary",
  ACTIVE: "bg-primary/10 text-primary",
  COMPLETED: "bg-outline-variant/30 text-on-surface-variant",
  ARCHIVED: "bg-outline-variant/30 text-on-surface-variant",
};

export default async function BatchListPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.BATCH_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.BATCH_CREATE);

  const batches = await prisma.batch.findMany({
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { enrollments: true, teachers: true, schedules: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary">Batches</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {batches.length} batch{batches.length === 1 ? "" : "es"} created.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/batches/new"
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all w-fit"
          >
            <span className="material-symbols-outlined">add</span>
            New Batch
          </Link>
        )}
      </div>

      {batches.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No batches created yet. Every course, live class, and test currently has nowhere
          batch-scoped to attach to — creating your first batch here is the foundation for that.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/team/batches/${b.id}`}
              className="glass-card rounded-2xl p-6 space-y-3 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">{b.name}</h3>
                  <p className="text-label-sm font-label-sm text-primary">{b.code}</p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded shrink-0 ${
                    STATUS_STYLES[b.status] ?? "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {b.status}
                </span>
              </div>
              {(b.targetExam || b.course) && (
                <p className="text-label-sm text-on-surface-variant">
                  {[b.targetExam, b.course?.title].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="flex gap-4 text-label-sm text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">group</span>
                  {b._count.enrollments}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">school</span>
                  {b._count.teachers}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">event</span>
                  {b._count.schedules}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
