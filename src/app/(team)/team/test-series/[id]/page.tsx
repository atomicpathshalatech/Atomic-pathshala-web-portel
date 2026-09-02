import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { SeriesTestCreateForm } from "@/components/team-portal/SeriesTestCreateForm";
import { SeriesTestsList } from "@/components/team-portal/SeriesTestsList";

export const metadata: Metadata = {
  title: "Test Series Detail",
};

export default async function TestSeriesDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const canCreateTest = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH || PERMISSIONS.TEST_CREATE);

  const series = await prisma.testSeries.findUnique({
    where: { id: params.id },
    include: {
      tests: {
        include: {
          sections: {
            include: {
              _count: { select: { questions: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!series) notFound();

  return (
    <div className="space-y-stack-lg max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono font-bold text-outline-variant">{series.code}</p>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-extrabold">{series.name}</h1>
          {series.description && (
            <p className="text-on-surface-variant font-body-md mt-1 max-w-2xl">{series.description}</p>
          )}
        </div>
        <span
          className={`px-3.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
            series.visibility === "PUBLIC"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
          }`}
        >
          {series.visibility}
        </span>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <p className="text-label-sm text-on-surface-variant">Batch</p>
          <p className="text-body-md font-bold text-primary truncate">{series.targetBatch ?? "All Batches"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <p className="text-label-sm text-on-surface-variant">Class</p>
          <p className="text-body-md font-bold text-primary truncate">{series.className ?? "—"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <p className="text-label-sm text-on-surface-variant">Course</p>
          <p className="text-body-md font-bold text-primary truncate">{series.course ?? "—"}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <p className="text-label-sm text-on-surface-variant">Tests</p>
          <p className="text-body-md font-bold text-primary">{series.tests.length}</p>
        </div>
      </div>

      {/* Tests in this Series List Header & Inline Create Form */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
            Tests in this Series
          </h3>
          {canCreateTest && <SeriesTestCreateForm testSeriesId={series.id} />}
        </div>

        {/* Tests List in Exact Format (Matching Image 1) */}
        <SeriesTestsList
          testSeriesId={series.id}
          tests={series.tests.map((t) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            durationMin: t.durationMin,
            status: t.status,
            sections: t.sections.map((s) => ({
              id: s.id,
              name: s.name,
              targetCount: s.targetCount,
              _count: s._count,
            })),
          }))}
        />
      </div>
    </div>
  );
}
