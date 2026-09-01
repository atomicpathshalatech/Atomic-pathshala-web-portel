import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DppStatusActions } from "@/components/team-portal/DppStatusActions";
import { DPP_LEVELS } from "@/lib/dpp/levels";

export const metadata: Metadata = {
  title: "DPP",
};

export default async function DppListPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; level?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.DPP_READ);
  if (!canRead) redirect("/team");

  const canCreate = await hasPermission(session.user.id, PERMISSIONS.DPP_CREATE);
  const canPublish = await hasPermission(session.user.id, PERMISSIONS.DPP_PUBLISH);

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 20;

  const where = {
    ...(searchParams.search
      ? {
          OR: [
            { name: { contains: searchParams.search, mode: "insensitive" as const } },
            { code: { contains: searchParams.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(searchParams.status ? { status: searchParams.status } : {}),
    ...(searchParams.level ? { level: Number(searchParams.level) } : {}),
  };

  const [dpps, total, statusCounts, totalDpps] = await Promise.all([
    prisma.dpp.findMany({
      where,
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dpp.count({ where }),
    prisma.dpp.groupBy({ by: ["status"], _count: true }),
    prisma.dpp.count(),
  ]);

  const countFor = (status: string) => statusCounts.find((s) => s.status === status)?._count ?? 0;

  return (
    <div className="space-y-stack-lg max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">DPP</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {totalDpps} DPP{totalDpps === 1 ? "" : "s"} total.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/dpp/new"
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-label-md shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Create DPP
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-on-surface-variant font-label-md mb-1">Published</p>
          <h3 className="text-[28px] font-bold text-tertiary">{countFor("PUBLISHED")}</h3>
        </div>
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-on-surface-variant font-label-md mb-1">Draft</p>
          <h3 className="text-[28px] font-bold text-primary">{countFor("DRAFT")}</h3>
        </div>
      </div>

      <form className="glass-card p-4 rounded-xl flex flex-wrap items-center gap-4" method="get">
        <input
          name="search"
          defaultValue={searchParams.search}
          placeholder="Search DPP name or code..."
          className="flex-1 min-w-[200px] bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ""}
          className="bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <select
          name="level"
          defaultValue={searchParams.level ?? ""}
          className="bg-surface-container-low rounded-lg border border-outline-variant/30 px-3 py-2 text-label-md"
        >
          <option value="">All Levels</option>
          {DPP_LEVELS.map((l) => (
            <option key={l.level} value={l.level}>
              Level {l.level}
            </option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md">
          Apply
        </button>
      </form>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant/30">
              <tr>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">DPP</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Subject/Chapter</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Level</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Questions</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant">Status</th>
                <th className="px-6 py-4 font-label-md text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {dpps.map((dpp) => (
                <tr key={dpp.id} className="hover:bg-surface-container-lowest/50 transition-colors group">
                  <td className="px-6 py-5 max-w-md">
                    <p className="font-label-md text-on-surface">{dpp.name}</p>
                    <span className="text-label-sm text-outline-variant">{dpp.code}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-label-md text-primary">{dpp.subject}</span>
                      <span className="text-label-sm text-on-surface-variant">{dpp.chapter}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-label-sm">{dpp.level ? `Level ${dpp.level}` : "—"}</td>
                  <td className="px-6 py-5 text-label-sm">
                    {dpp._count.questions} / {dpp.questionTargetCount}
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        dpp.status === "PUBLISHED"
                          ? "bg-tertiary-container text-on-tertiary-container"
                          : "bg-primary-container text-on-primary-container"
                      }`}
                    >
                      {dpp.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/team/dpp/${dpp.id}`} className="p-1 hover:text-primary" title="Open">
                        <span className="material-symbols-outlined">edit</span>
                      </Link>
                      {canPublish && <DppStatusActions dppId={dpp.id} status={dpp.status} />}
                    </div>
                  </td>
                </tr>
              ))}

              {dpps.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant font-body-md">
                    No DPPs match these filters yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-surface-container-low/50 flex items-center justify-between">
          <p className="text-label-sm text-on-surface-variant">
            Showing {dpps.length === 0 ? 0 : (page - 1) * pageSize + 1}-
            {(page - 1) * pageSize + dpps.length} of {total} DPPs
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{ pathname: "/team/dpp", query: { ...searchParams, page: page - 1 } }}
                className="px-3 py-1 border border-outline-variant rounded hover:bg-white transition-all text-sm"
              >
                Prev
              </Link>
            )}
            {page * pageSize < total && (
              <Link
                href={{ pathname: "/team/dpp", query: { ...searchParams, page: page + 1 } }}
                className="px-3 py-1 border border-outline-variant rounded hover:bg-white transition-all text-sm"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
