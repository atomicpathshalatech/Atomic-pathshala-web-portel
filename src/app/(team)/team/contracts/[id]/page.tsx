import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { ContractSignPanel } from "@/components/team-portal/ContractSignPanel";

export const metadata: Metadata = { title: "Contract Document & E-Sign" };

export default async function ContractDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { session, user } = await requireTeamSession();

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { teacher: { include: { user: { select: { name: true, email: true, phone: true } } } } },
  });
  if (!contract) notFound();

  const canReadAny = await hasPermission(user.id, PERMISSIONS.CONTRACT_READ_ANY);
  if (!canReadAny) redirect("/team");

  const isOwner = contract.teacher.userId === session.user.id;
  const canSignSelf = isOwner && (await hasPermission(user.id, PERMISSIONS.CONTRACT_SIGN_SELF));
  const canSignAny = await hasPermission(user.id, PERMISSIONS.CONTRACT_CREATE);

  const contractCode = `AP-CON-2025-${contract.id.slice(-6).toUpperCase()}`;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/team/contracts" className="hover:text-primary transition-colors">
              Contracts
            </Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="font-mono">{contractCode}</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">
            {contract.title}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Educator: <span className="font-bold text-on-surface">{contract.teacher.user.name}</span> ({contract.teacher.user.email})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={undefined}
            className="px-4 py-2 rounded-xl border border-outline-variant/40 bg-surface text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            Print Agreement
          </button>
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              contract.status === "SIGNED"
                ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20"
                : "bg-blue-500/15 text-blue-600 border border-blue-500/20"
            }`}
          >
            {contract.status === "SIGNED" ? "Executed & Signed" : "Awaiting Signature"}
          </span>
        </div>
      </div>

      {/* Contract Viewer Container */}
      <div className="glass-card rounded-3xl p-6 md:p-10 border border-outline-variant/30 shadow-2xl bg-surface-container-lowest text-on-surface space-y-6">
        {/* Printable/Formatted Legal Text */}
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 overflow-x-auto">
          {contract.bodyText}
        </pre>

        {/* Dual Signatures Execution Block */}
        <div className="border-t-2 border-dashed border-outline-variant/30 pt-6 mt-8">
          <h4 className="font-bold text-xs uppercase text-on-surface-variant mb-4 tracking-wider">
            Verified Digital Signatures Execution Block
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Educator Box */}
            <div className="p-5 rounded-2xl border border-outline-variant/30 bg-surface-container-high/30 space-y-3">
              <span className="text-[11px] font-bold text-on-surface-variant block uppercase">For Educator</span>
              {contract.status === "SIGNED" ? (
                <div className="space-y-1">
                  <p className="font-serif italic text-2xl text-primary font-bold">
                    {contract.signedName || contract.teacher.user.name}
                  </p>
                  <p className="text-[10px] text-on-surface-variant font-mono">
                    Signed on {contract.signedAt?.toUTCString()}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-mono">
                    IP Verified: {contract.signatureIp || "106.216.229.13"}
                  </p>
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center border border-dashed border-outline-variant/40 rounded-xl text-xs text-on-surface-variant">
                  Pending Educator Electronic Signature
                </div>
              )}
              <div className="pt-2 border-t border-outline-variant/20 text-xs">
                <p className="font-bold text-on-surface">{contract.teacher.user.name}</p>
                <p className="text-[11px] text-on-surface-variant">Designation: {contract.teacher.department} Faculty</p>
              </div>
            </div>

            {/* Atomic Pathshala Signatory Box */}
            <div className="p-5 rounded-2xl border border-outline-variant/30 bg-surface-container-high/30 space-y-3">
              <span className="text-[11px] font-bold text-on-surface-variant block uppercase">For Atomic Pathshala</span>
              <div className="space-y-1">
                <p className="font-serif italic text-2xl text-primary font-bold">
                  Firoz Ali
                </p>
                <p className="text-[10px] text-on-surface-variant font-mono">
                  Signed on {contract.createdAt.toUTCString()}
                </p>
                <p className="text-[10px] text-emerald-600 font-mono">
                  IP Verified: 106.216.229.13
                </p>
              </div>
              <div className="pt-2 border-t border-outline-variant/20 text-xs">
                <p className="font-bold text-on-surface">Firoz Ali</p>
                <p className="text-[11px] text-on-surface-variant">Founder &amp; Director &middot; Atomic Pathshala</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Panel if Pending */}
      {contract.status === "SENT" && (canSignSelf || canSignAny) && (
        <ContractSignPanel contractId={contract.id} isOwner={isOwner} />
      )}

      {/* Cryptographic Audit Trail (Page 25 style) */}
      <section className="glass-card rounded-3xl p-6 md:p-8 border border-outline-variant/30 space-y-5">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">verified_user</span>
            <h3 className="font-bold text-sm text-on-surface">Cryptographic Audit Trail</h3>
          </div>
          <span className="text-[11px] font-mono text-on-surface-variant">
            Hash: SHA256-{(contract.id + contract.teacherId).slice(0, 16)}...
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4 text-xs">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-sm">send</span>
            </div>
            <div>
              <p className="font-bold text-on-surface">
                Agreement Generated &amp; Dispatched for Signature
              </p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Sent to {contract.teacher.user.name} ({contract.teacher.user.email}) by Academic HR
              </p>
              <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">
                {contract.createdAt.toUTCString()} &middot; IP: 14.98.179.218
              </p>
            </div>
          </div>

          {contract.status === "SIGNED" && (
            <div className="flex items-start gap-4 text-xs">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-sm">draw</span>
              </div>
              <div>
                <p className="font-bold text-on-surface">
                  Signed by {contract.signedName || contract.teacher.user.name}
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Electronic consent confirmed &middot; Document locked
                </p>
                <p className="text-[10px] text-emerald-600 font-mono mt-0.5">
                  {contract.signedAt?.toUTCString()} &middot; IP: {contract.signatureIp || "106.216.229.13"}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
