import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Plus, Search, Clock, ListChecks, ArrowUpRight, FileText } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { DppStatusActions } from "@/components/team-portal/DppStatusActions";
import { DppDeleteButton } from "@/components/team-portal/DppDeleteButton";
import { DPP_LEVELS } from "@/lib/dpp/levels";

export const metadata: Metadata = {
  title: "DPP",
};

// Same subject colours as the Chapters boxes.
function subjectTone(title: string) {
  const t = title.toLowerCase();
  if (t.includes("phys")) return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";
  if (t.includes("chem")) return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
  if (t.includes("bio") || t.includes("bot") || t.includes("zoo")) return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  if (t.includes("math")) return "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

export default async function DppListPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; level?: string; subject?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.DPP_READ);
  if (!canRead) redirect("/team");

  const [canCreate, canPublish, canDelete] = await Promise.all([
    hasPermission(session.user.id, PERMISSIONS.DPP_CREATE),
    hasPermission(session.user.id, PERMISSIONS.DPP_PUBLISH),
    hasPermission(session.user.id, PERMISSIONS.DPP_DELETE),
  ]);

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 24;

  const where = {
    ...(searchParams.search
      ? {
          OR: [
            { name: { contains: searchParams.search, mode: "insensitive" as const } },
            { code: { contains: searchParams.search, mode: "insensitive" as const } },
            { chapter: { contains: searchParams.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(searchParams.status ? { status: searchParams.status } : {}),
    ...(searchParams.level ? { level: Number(searchParams.level) } : {}),
    ...(searchParams.subject ? { subject: searchParams.subject } : {}),
  };

  const [dpps, total, statusCounts, subjects] = await Promise.all([
    prisma.dpp.findMany({
      where,
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dpp.count({ where }),
    prisma.dpp.groupBy({ by: ["status"], _count: true }),
    prisma.dpp.findMany({ distinct: ["subject"], select: { subject: true }, orderBy: { subject: "asc" } }),
  ]);

  const countFor = (status: string) => statusCounts.find((s) => s.status === status)?._count ?? 0;
  const allCount = statusCounts.reduce((n, s) => n + s._count, 0);

  // Links keep the other filters while changing one.
  const hrefWith = (patch: Record<string, string | undefined>) => {
    const q = { ...searchParams, page: undefined, ...patch };
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]);
    const s = params.toString();
    return s ? `/team/dpp?${s}` : "/team/dpp";
  };

  const tabs = [
    { key: "", label: "All", n: allCount },
    { key: "PUBLISHED", label: "Published", n: countFor("PUBLISHED") },
    { key: "DRAFT", label: "Draft", n: countFor("DRAFT") },
  ];
  const activeStatus = searchParams.status ?? "";
  const anyFilter = !!(searchParams.search || searchParams.level || searchParams.subject);
  const select =
    "h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 pr-8 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500";

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">DPP</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {allCount} practice set{allCount === 1 ? "" : "s"} · {countFor("PUBLISHED")} published
          </p>
        </div>
        {canCreate && (
          <Link
            href="/team/dpp/new"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New DPP
          </Link>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => {
          const active = activeStatus === t.key;
          return (
            <Link
              key={t.key || "all"}
              href={hrefWith({ status: t.key || undefined })}
              className={`-mb-px inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
                active ? "border-blue-600 text-blue-700 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t.label}
              <span
                className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold inline-flex items-center justify-center tabular-nums ${
                  active ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {t.n}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        {activeStatus && <input type="hidden" name="status" value={activeStatus} />}
        <label className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            name="search"
            defaultValue={searchParams.search}
            placeholder="Search DPP, code or chapter"
            className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500"
          />
        </label>
        <select name="subject" defaultValue={searchParams.subject ?? ""} className={select} aria-label="Subject">
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.subject} value={s.subject}>
              {s.subject}
            </option>
          ))}
        </select>
        <select name="level" defaultValue={searchParams.level ?? ""} className={select} aria-label="Level">
          <option value="">All levels</option>
          {DPP_LEVELS.map((l) => (
            <option key={l.level} value={l.level}>
              Level {l.level}
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold">
          Filter
        </button>
        {anyFilter && (
          <Link href={hrefWith({ search: undefined, level: undefined, subject: undefined })} className="h-9 px-2.5 inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">
            Clear
          </Link>
        )}
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{total} shown</span>
      </form>

      {/* DPP boxes */}
      {dpps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-14 text-center">
          <FileText className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {allCount === 0 ? "No DPPs yet" : "No DPP matches these filters"}
          </p>
          {allCount === 0 && canCreate && (
            <Link href="/team/dpp/new" className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline">
              Create the first DPP
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dpps.map((dpp) => {
            const published = dpp.status === "PUBLISHED";
            const target = dpp.questionTargetCount || 0;
            const have = dpp._count.questions;
            const pct = target > 0 ? Math.min(100, Math.round((have / target) * 100)) : have > 0 ? 100 : 0;
            return (
              <div
                key={dpp.id}
                className="group flex flex-col rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md hover:shadow-blue-500/5 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${subjectTone(dpp.subject)}`}>{dpp.subject}</span>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${published ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${published ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {published ? "Published" : "Draft"}
                  </span>
                </div>

                <Link href={`/team/dpp/${dpp.id}`} className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                  {dpp.name}
                </Link>
                <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                  {[dpp.chapter, dpp.level ? `Level ${dpp.level}` : null, dpp.code].filter(Boolean).join(" · ")}
                </p>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                    {have}
                    {target ? ` / ${target}` : ""} Qs
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {dpp.estimatedTimeMin} min
                  </span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" title={`${have} of ${target || have} questions added`}>
                  <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <Link href={`/team/dpp/${dpp.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline">
                    Open
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                  <div className="flex items-center gap-1">
                    {canPublish && <DppStatusActions dppId={dpp.id} status={dpp.status} />}
                    {canDelete && <DppDeleteButton dppId={dpp.id} dppCode={dpp.code} dppName={dpp.name} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="tabular-nums">
            {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + dpps.length} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={hrefWith({ page: String(page - 1) })} className="h-8 px-3 inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                Previous
              </Link>
            )}
            {page * pageSize < total && (
              <Link href={hrefWith({ page: String(page + 1) })} className="h-8 px-3 inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
