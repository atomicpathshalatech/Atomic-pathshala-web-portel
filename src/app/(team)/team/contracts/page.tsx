import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { AgreementTestEmailModal } from "@/components/team-portal/AgreementTestEmailModal";
import { PolicyManagementModal } from "@/components/team-portal/PolicyManagementModal";

export const metadata: Metadata = { title: "Educator Documentation & Contracts" };

const STATUS_BADGES: Record<string, { badge: string; label: string }> = {
  DRAFT: { badge: "bg-surface-container-high text-on-surface-variant", label: "Draft" },
  READY_FOR_STAMP: { badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20", label: "Stamp Required" },
  STAMP_ATTACHED: { badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20", label: "e-Stamp Attached" },
  SENT_TO_EDUCATOR: { badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20", label: "Sent to Educator" },
  VIEWED_BY_EDUCATOR: { badge: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20", label: "Educator Viewed" },
  EDUCATOR_SIGNED: { badge: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20", label: "Educator Signed" },
  AWAITING_DIRECTOR_SIGNATURE: { badge: "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold", label: "Awaiting Founder Sign" },
  DIRECTOR_SIGNED: { badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20", label: "Founder Signed" },
  FULLY_EXECUTED: { badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold", label: "Fully Executed" },
  EMAIL_DELIVERY_FAILED: { badge: "bg-rose-500/15 text-rose-600 border border-rose-500/20 font-bold", label: "Email Failed" },
  REJECTED: { badge: "bg-rose-500/15 text-rose-600", label: "Rejected" },
  CORRECTION_REQUESTED: { badge: "bg-amber-500/15 text-amber-700", label: "Correction Requested" },
  // Legacy fallback
  SENT: { badge: "bg-blue-500/15 text-blue-600", label: "Sent" },
  SIGNED: { badge: "bg-emerald-500/15 text-emerald-600", label: "Signed" },
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams?: { status?: string; type?: string; q?: string };
}) {
  const { session, user } = await requireTeamSession();

  const canReadAny = await hasPermission(user.id, PERMISSIONS.CONTRACT_READ_ANY);
  if (!canReadAny) redirect("/team");

  const canCreate = await hasPermission(user.id, PERMISSIONS.CONTRACT_CREATE);
  const statusFilter = searchParams?.status;
  const typeFilter = searchParams?.type;
  const query = searchParams?.q;

  // Query Agreement model
  const agreements = await prisma.agreement.findMany({
    where: {
      ...(canReadAny ? {} : { educator: { userId: session.user.id } }),
      ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter as any } : {}),
      ...(typeFilter && typeFilter !== "ALL" ? { documentType: typeFilter as any } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { agreementNumber: { contains: query, mode: "insensitive" } },
              { educator: { user: { name: { contains: query, mode: "insensitive" } } } },
              { educator: { user: { email: { contains: query, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      educator: { include: { user: { select: { name: true, email: true, phone: true } } } },
      signers: true,
      stamp: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalDocuments = await prisma.agreement.count();
  const joiningLettersCount = await prisma.agreement.count({
    where: { documentType: "JOINING_LETTER" },
  });
  const serviceAgreementsCount = await prisma.agreement.count({
    where: { documentType: "SERVICE_AGREEMENT" },
  });
  const awaitingDirectorCount = await prisma.agreement.count({
    where: { status: "AWAITING_DIRECTOR_SIGNATURE" },
  });
  const executedCount = await prisma.agreement.count({
    where: { status: "FULLY_EXECUTED" },
  });
  const failedEmailCount = await prisma.agreement.count({
    where: { status: "EMAIL_DELIVERY_FAILED" },
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header with CTA & Email Test Tool & Policy Manager */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold font-mono">
              ATOMIC PATHSHALA EDUCATION
            </span>
            <span className="text-xs text-on-surface-variant font-mono">• Rampur, Uttar Pradesh, India</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">
            Educator Documentation &amp; Contract Hub
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {canReadAny
              ? "Official repository for Educator Joining Letters (AP-JL) and Service Agreements (AP-AGR) with digital signing & e-stamps."
              : "Your official appointment letters, agreements, and execution history."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
          <PolicyManagementModal />
          {canCreate && <AgreementTestEmailModal />}
          {canCreate && (
            <Link
              href="/team/contracts/new"
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">post_add</span>
              Generate Document
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="glass-card rounded-2xl p-4 border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">folder_shared</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Total Docs</span>
            <span className="font-bold text-lg text-on-surface font-mono">{totalDocuments}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">mark_email_read</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Joining Letters</span>
            <span className="font-bold text-lg text-purple-600 font-mono">{joiningLettersCount}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">gavel</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Agreements</span>
            <span className="font-bold text-lg text-blue-600 font-mono">{serviceAgreementsCount}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">history_edu</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Awaiting Founder</span>
            <span className="font-bold text-lg text-amber-700 font-mono">{awaitingDirectorCount}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">verified</span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Executed</span>
            <span className="font-bold text-lg text-emerald-600 font-mono">{executedCount}</span>
          </div>
        </div>
      </div>

      {failedEmailCount > 0 && (
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600 text-lg">error</span>
            <span>
              <strong>{failedEmailCount} Document(s)</strong> encountered email delivery issues. Open the document to resend invitation or copy review link.
            </span>
          </div>
        </div>
      )}

      {/* Filter Bar with Document Type Tabs */}
      <div className="glass-card rounded-2xl p-4 border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Document Type Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-on-surface mr-1">Type:</span>
          {[
            { label: "All Types", val: "ALL" },
            { label: "✉️ Joining Letters", val: "JOINING_LETTER" },
            { label: "📑 Service Agreements", val: "SERVICE_AGREEMENT" },
          ].map((item) => (
            <Link
              key={item.val}
              href={`/team/contracts?type=${item.val}${statusFilter ? `&status=${statusFilter}` : ""}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                (typeFilter === item.val) || (!typeFilter && item.val === "ALL")
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container-high/60 text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-on-surface mr-1">Status:</span>
          {[
            { label: "All", val: "ALL" },
            { label: "Drafts", val: "DRAFT" },
            { label: "Sent", val: "SENT_TO_EDUCATOR" },
            { label: "Awaiting Founder", val: "AWAITING_DIRECTOR_SIGNATURE" },
            { label: "Executed", val: "FULLY_EXECUTED" },
          ].map((item) => (
            <Link
              key={item.val}
              href={`/team/contracts?status=${item.val}${typeFilter ? `&type=${typeFilter}` : ""}`}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                (statusFilter === item.val) || (!statusFilter && item.val === "ALL")
                  ? "bg-secondary text-on-secondary"
                  : "bg-surface-container/60 text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Agreement List Table */}
      <div className="glass-card rounded-3xl border border-outline-variant/30 overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-high/50 text-on-surface-variant font-bold border-b border-outline-variant/20 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Ref No. &amp; Type</th>
                <th className="py-3.5 px-4">Educator / Faculty</th>
                <th className="py-3.5 px-4">Engagement / e-Stamp</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Effective Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface">
              {agreements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl block mb-2 opacity-50">description</span>
                    No educator documents found matching your filter criteria. Click &quot;Generate Document&quot; to create one.
                  </td>
                </tr>
              ) : (
                agreements.map((agg) => {
                  const badgeInfo = STATUS_BADGES[agg.status] || {
                    badge: "bg-surface-container text-on-surface-variant",
                    label: agg.status,
                  };
                  const isJL = agg.documentType === "JOINING_LETTER";

                  return (
                    <tr key={agg.id} className="hover:bg-surface-container-high/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[11px] font-bold text-primary">
                            {agg.agreementNumber}
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              isJL
                                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300"
                                : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            {isJL ? "Joining Letter" : "Service Agreement"}
                          </span>
                        </div>
                        <span className="font-semibold text-on-surface line-clamp-1">{agg.title}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-on-surface block">{agg.educator.user.name}</span>
                        <span className="text-[11px] text-on-surface-variant">{agg.educator.user.email}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isJL ? (
                          <span className="text-[11px] text-on-surface-variant font-medium">
                            {agg.engagementType?.replace(/_/g, " ") || "Full-Time"}
                          </span>
                        ) : agg.stamp ? (
                          <div>
                            <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 block font-bold">
                              {agg.stamp.certificateNumber}
                            </span>
                            <span className="text-[10px] text-on-surface-variant">
                              {agg.stamp.issuingState} &bull; INR {agg.stamp.stampDutyAmount}
                            </span>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant text-[11px] italic">Standard (No e-Stamp)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeInfo.badge}`}>
                          {badgeInfo.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant font-mono text-[11px]">
                        {agg.effectiveDate ? new Date(agg.effectiveDate).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/team/contracts/${agg.id}`}
                          className="px-3 py-1.5 rounded-xl border border-outline-variant/40 hover:bg-primary hover:text-on-primary hover:border-primary transition-all text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                        >
                          <span>Manage</span>
                          <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
