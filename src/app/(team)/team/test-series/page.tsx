import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Test Series",
};

export default async function TestSeriesListPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

  const where = searchParams.search
    ? {
        OR: [
          { name: { contains: searchParams.search, mode: "insensitive" as const } },
          { code: { contains: searchParams.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [series, totalSeries] = await Promise.all([
    prisma.testSeries.findMany({
      where,
      include: { _count: { select: { tests: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.testSeries.count(),
  ]);

  return (
    <div className="space-y-stack-lg max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Test Series</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {totalSeries} series total.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/test-series/new"
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Create Test Series
          </Link>
        )}
      </div>

      <form className="glass-card p-4 rounded-xl flex flex-wrap items-center gap-4" method="get">
        <input
          name="search"
          defaultValue={searchParams.search}
          placeholder="Search series name or code..."
          className="flex-1 min-w-[200px] bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        />
        <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md">
          Apply
        </button>
      </form>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant/30">
              <tr>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Series</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Batch / Class / Course</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Tests</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Visibility</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {series.map((s) => (
                <tr key={s.id} className="hover:bg-surface-container-lowest/50 transition-colors group">
                  <td className="px-6 py-5 max-w-md">
                    <p className="font-label-md text-on-surface">{s.name}</p>
                    <span className="text-label-sm text-outline-variant">{s.code}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col text-label-sm text-on-surface-variant">
                      <span>{s.targetBatch ?? "—"}</span>
                      <span>
                        {s.className ?? "—"} · {s.course ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-label-sm">{s._count.tests}</td>
                  <td className="px-6 py-5">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        s.visibility === "PUBLIC"
                          ? "bg-tertiary-container text-on-tertiary-container"
                          : "bg-primary-container text-on-primary-container"
                      }`}
                    >
                      {s.visibility}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link href={`/team/test-series/${s.id}`} className="p-1 hover:text-primary" title="Open">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </Link>
                  </td>
                </tr>
              ))}

              {series.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant font-body-md">
                    No test series match these filters yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
