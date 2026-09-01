import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { SeriesTestCreateForm } from "@/components/team-portal/SeriesTestCreateForm";

export const metadata: Metadata = {
  title: "Test Series Detail",
};

export default async function TestSeriesDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const canCreateTest = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

  const series = await prisma.testSeries.findUnique({
    where: { id: params.id },
    include: { tests: { orderBy: { createdAt: "desc" } } },
  });
  if (!series) notFound();

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <p className="text-label-sm text-outline-variant">{series.code}</p>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{series.name}</h1>
          {series.description && (
            <p className="text-on-surface-variant font-body-md mt-1 max-w-2xl">{series.description}</p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            series.visibility === "PUBLIC"
              ? "bg-tertiary-container text-on-tertiary-container"
              : "bg-primary-container text-on-primary-container"
          }`}
        >
          {series.visibility}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Batch</p>
          <p className="text-body-md font-label-md text-primary">{series.targetBatch ?? "—"}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Class</p>
          <p className="text-body-md font-label-md text-primary">{series.className ?? "—"}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Course</p>
          <p className="text-body-md font-label-md text-primary">{series.course ?? "—"}</p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <p className="text-label-sm text-on-surface-variant">Tests</p>
          <p className="text-body-md font-label-md text-primary">{series.tests.length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-headline-md text-headline-md text-primary">Tests in this Series</h3>
        {canCreateTest && <SeriesTestCreateForm testSeriesId={series.id} />}
      </div>

      {series.tests.length > 0 ? (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low border-b border-outline-variant/30">
                <tr>
                  <th className="px-6 py-4 font-label-md text-on-surface-variant">Test</th>
                  <th className="px-6 py-4 font-label-md text-on-surface-variant">Duration</th>
                  <th className="px-6 py-4 font-label-md text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 font-label-md text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {series.tests.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-lowest/50 transition-colors group">
                    <td className="px-6 py-5">
                      <p className="font-label-md text-on-surface">{t.name}</p>
                    </td>
                    <td className="px-6 py-5 text-label-sm">{t.durationMin} min</td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-container text-on-primary-container">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link href={`/team/tests/${t.id}`} className="p-1 hover:text-primary" title="Open">
                        <span className="material-symbols-outlined">edit</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-stack-lg text-center text-on-surface-variant font-body-md">
          No tests in this series yet. Add one to start building sections and questions.
        </div>
      )}
    </div>
  );
}
