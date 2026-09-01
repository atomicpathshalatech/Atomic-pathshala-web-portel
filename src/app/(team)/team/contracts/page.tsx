import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Contract & E-Sign Management" };

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  DRAFT: { badge: "bg-surface-container-high text-on-surface-variant", label: "Draft" },
  SENT: { badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20", label: "Awaiting Signature" },
  SIGNED: { badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20", label: "Executed & Signed" },
  DECLINED: { badge: "bg-error/15 text-error", label: "Declined" },
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string };
}) {
  const { session, user } = await requireTeamSession();

  const canReadAny = await hasPermission(user.id, PERMISSIONS.CONTRACT_READ_ANY);
  if (!canReadAny) redirect("/team");

  const canCreate = await hasPermission(user.id, PERMISSIONS.CONTRACT_CREATE);
  const statusFilter = searchParams?.status;
  const query = searchParams?.q;

  const contracts = await prisma.contract.findMany({
    where: {
      ...(canReadAny ? {} : { teacher: { userId: session.user.id } }),
      ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter as any } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { teacher: { user: { name: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: { teacher: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const totalCount = await prisma.contract.count();
  const sentCount = await prisma.contract.count({ where: { status: "SENT" } });
  const signedCount = await prisma.contract.count({ where: { status: "SIGNED" } });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header with CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">
            Contract &amp; E-Signature Repository
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {canReadAny
              ? "Comprehensive management of faculty contracts, e-stamps, and verifiable electronic signatures."
              : "Your official employment agreements and execution history."}
          </p>
        </div>

        {canCreate && (
          <Link
            href="/team/contracts/new"
            className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 self-start sm:self-auto shrink-0"
          >
            <span className="material-symbols-outlined text-base">post_add</span>
            Generate New Agreement
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">description</span>
          </div>
          <div>
            <span className="text-xs text-on-surface-variant block">Total Agreements</span>
            <span className="font-bold text-xl text-on-surface font-mono">{totalCount}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">draw</span>
          </div>
          <div>
            <span className="text-xs text-on-surface-variant block">Awaiting E-Sign</span>
            <span className="font-bold text-xl text-blue-600 font-mono">{sentCount}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-outline-variant/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">verified</span>
          </div>
          <div>
            <span className="text-xs text-on-surface-variant block">Executed &amp; Locked</span>
            <span className="font-bold text-xl text-emerald-600 font-mono">{signedCount}</span>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      {contracts.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-on-surface-variant font-body-md space-y-2">
          <span className="material-symbols-outlined text-4xl opacity-50">history_edu</span>
          <p className="font-bold text-on-surface">No contracts found.</p>
          <p className="text-xs text-on-surface-variant">Click &quot;Generate New Agreement&quot; to draft your first contract.</p>
        </div>
      ) : (
        <div className="glass-card rounded-3xl overflow-hidden border border-outline-variant/30 shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-high/40 text-on-surface-variant uppercase font-bold text-[11px] tracking-wider border-b border-outline-variant/20">
                <tr>
                  <th className="py-3.5 px-5">Document Title &amp; ID</th>
                  <th className="py-3.5 px-4">Educator / Signer</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {contracts.map((c) => {
                  const style = STATUS_STYLES[c.status] ?? {
                    badge: "bg-surface-container-high text-on-surface-variant",
                    label: "Draft",
                  };
                  return (
                    <tr key={c.id} className="hover:bg-surface-container-high/20 transition-colors">
                      <td className="py-4 px-5">
                        <Link href={`/team/contracts/${c.id}`} className="font-bold text-on-surface hover:text-primary transition-colors">
                          {c.title}
                        </Link>
                        <span className="text-[10px] text-on-surface-variant block font-mono mt-0.5">
                          ID: AP-CON-2025-{c.id.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-on-surface">{c.teacher.user.name}</p>
                        <p className="text-[11px] text-on-surface-variant">{c.teacher.user.email}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-0.5 rounded-lg bg-surface-container-high text-on-surface font-semibold text-[11px]">
                          {c.teacher.department}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-on-surface-variant">
                        {c.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <Link
                          href={`/team/contracts/${c.id}`}
                          className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors text-xs inline-flex items-center gap-1"
                        >
                          <span>Review &amp; Sign</span>
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
