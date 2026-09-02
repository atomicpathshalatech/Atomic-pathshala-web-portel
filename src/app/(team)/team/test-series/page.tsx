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
  searchParams: { search?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

  const activeStatus = searchParams.status || "ALL";

  const where: any = {};
  if (activeStatus !== "ALL") {
    where.status = activeStatus;
  }
  if (searchParams.search) {
    where.OR = [
      { name: { contains: searchParams.search, mode: "insensitive" as const } },
      { code: { contains: searchParams.search, mode: "insensitive" as const } },
    ];
  }

  const [series, totalSeries, draftCount, activeCount, archivedCount] = await Promise.all([
    prisma.testSeries.findMany({
      where,
      include: { _count: { select: { tests: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.testSeries.count(),
    prisma.testSeries.count({ where: { status: "DRAFT" } }),
    prisma.testSeries.count({ where: { status: "ACTIVE" } }),
    prisma.testSeries.count({ where: { status: "ARCHIVED" } }),
  ]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Test Series Packages</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage comprehensive assessment packages, full mock tests & batch test series.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/test-series/new"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Create Test Series
          </Link>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          {[
            { id: "ALL", label: "All Series", count: totalSeries },
            { id: "ACTIVE", label: "Active", count: activeCount },
            { id: "DRAFT", label: "Drafts", count: draftCount },
            { id: "ARCHIVED", label: "Archived", count: archivedCount },
          ].map((tab) => {
            const isSelected = activeStatus === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/team/test-series?status=${tab.id}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? "bg-indigo-100 text-indigo-700 font-bold" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Search */}
        <form className="flex items-center gap-2 w-full md:w-80" method="get">
          <input type="hidden" name="status" value={activeStatus} />
          <input
            name="search"
            defaultValue={searchParams.search}
            placeholder="Search series name or code..."
            className="w-full bg-slate-50 rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* Series Grid / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600">Series Name & Code</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600">Target Cohort</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600">Included Tests</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600">Lifecycle Status</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600">Visibility</th>
                <th className="px-6 py-3.5 text-xs font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {series.map((s) => {
                const isDraft = s.status === "DRAFT";
                const isActive = s.status === "ACTIVE";

                return (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-4 max-w-xs">
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      <span className="text-[11px] font-mono text-slate-400">{s.code}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div>{s.targetBatch ?? "—"}</div>
                      <div className="text-[11px] text-slate-400">
                        {s.className ?? "—"} · {s.course ?? "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        <span className="material-symbols-outlined text-sm">quiz</span>
                        {s._count.tests} Tests
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : isDraft
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${
                          s.visibility === "PUBLIC"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {s.visibility}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/team/test-series/${s.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                      >
                        Manage <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {series.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
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
