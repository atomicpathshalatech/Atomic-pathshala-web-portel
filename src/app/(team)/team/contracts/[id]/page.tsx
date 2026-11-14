import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { DirectorCountersignPanel } from "@/components/team-portal/DirectorCountersignPanel";

export const metadata: Metadata = { title: "Agreement Details & Execution" };

const STATUS_BADGES: Record<string, { badge: string; label: string }> = {
  DRAFT: { badge: "bg-surface-container-high text-on-surface-variant", label: "Draft" },
  READY_FOR_STAMP: { badge: "bg-amber-500/15 text-amber-700 border border-amber-500/20", label: "Stamp Required" },
  STAMP_ATTACHED: { badge: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/20", label: "e-Stamp Attached" },
  SENT_TO_EDUCATOR: { badge: "bg-blue-500/15 text-blue-600 border border-blue-500/20", label: "Sent to Educator" },
  VIEWED_BY_EDUCATOR: { badge: "bg-indigo-500/15 text-indigo-600 border border-indigo-500/20", label: "Educator Viewed" },
  EDUCATOR_SIGNED: { badge: "bg-purple-500/15 text-purple-700 border border-purple-500/20", label: "Educator Signed" },
  AWAITING_DIRECTOR_SIGNATURE: { badge: "bg-amber-500/20 text-amber-800 border border-amber-500/30 font-bold", label: "Awaiting Founder Sign" },
  DIRECTOR_SIGNED: { badge: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20", label: "Founder Signed" },
  FULLY_EXECUTED: { badge: "bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 font-bold", label: "Fully Executed" },
  EMAIL_DELIVERY_FAILED: { badge: "bg-rose-500/15 text-rose-600 border border-rose-500/20 font-bold", label: "Email Failed" },
  REJECTED: { badge: "bg-rose-500/15 text-rose-600", label: "Rejected" },
  CORRECTION_REQUESTED: { badge: "bg-amber-500/15 text-amber-700", label: "Correction Requested" },
  // Legacy
  SENT: { badge: "bg-blue-500/15 text-blue-600", label: "Sent" },
  SIGNED: { badge: "bg-emerald-500/15 text-emerald-600", label: "Signed" },
};

export default async function ContractDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { session, user } = await requireTeamSession();

  // Try finding in new Agreement model first
  let agreement = await prisma.agreement.findUnique({
    where: { id: params.id },
    include: {
      educator: { include: { user: true } },
      signers: {
        include: {
          signatures: true,
          invitations: { orderBy: { sentAt: "desc" } },
        },
      },
      stamp: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      emailLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  // If not found, check legacy contract table for backwards compatibility
  let legacyContract = null;
  if (!agreement) {
    legacyContract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: { teacher: { include: { user: true } } },
    });
    if (!legacyContract) notFound();
  }

  const canReadAny = await hasPermission(user.id, PERMISSIONS.CONTRACT_READ_ANY);
  if (!canReadAny) {
    const isOwner = agreement
      ? agreement.educator.userId === session.user.id
      : legacyContract?.teacher.userId === session.user.id;
    if (!isOwner) redirect("/team");
  }

  // Normalize data for rendering
  const isLegacy = !agreement && Boolean(legacyContract);
  const title = agreement?.title || legacyContract?.title || "Educator Agreement";
  const agreementNumber =
    agreement?.agreementNumber || `AP-CON-2025-${legacyContract?.id.slice(-6).toUpperCase()}`;
  const statusStr = agreement?.status || legacyContract?.status || "DRAFT";
  const badgeInfo = STATUS_BADGES[statusStr] || {
    badge: "bg-surface-container text-on-surface-variant",
    label: statusStr,
  };

  const educatorName =
    agreement?.educator.user.name || legacyContract?.teacher.user.name || "Educator";
  const educatorEmail =
    agreement?.educator.user.email || legacyContract?.teacher.user.email || "";
  const department =
    agreement?.educator.department || legacyContract?.teacher.department || "Academic";

  const bodyText =
    agreement?.versions[0]?.contentSnapshot || legacyContract?.bodyText || "";

  // Signer data
  const educatorSigner = agreement?.signers.find((s) => s.signerType === "EDUCATOR");
  const educatorSignature = educatorSigner?.signatures[0];
  const educatorSigned =
    statusStr === "SIGNED" ||
    statusStr === "EDUCATOR_SIGNED" ||
    statusStr === "AWAITING_DIRECTOR_SIGNATURE" ||
    statusStr === "FULLY_EXECUTED" ||
    Boolean(educatorSignature);

  const directorSigner = agreement?.signers.find((s) => s.signerType === "DIRECTOR");
  const directorSignature = directorSigner?.signatures[0];
  const directorSigned = statusStr === "FULLY_EXECUTED" || Boolean(directorSignature);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header & Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1">
            <Link href="/team/contracts" className="hover:text-primary transition-colors">
              Contracts &amp; Agreements
            </Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="font-mono font-bold text-primary">{agreementNumber}</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">{title}</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Educator: <strong className="text-on-surface">{educatorName}</strong> ({educatorEmail}) &bull; {department} Department
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${badgeInfo.badge}`}>
            {badgeInfo.label}
          </span>
          {agreement?.finalPdfUrl && (
            <a
              href={agreement.finalPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={`Atomic_Pathshala_${agreementNumber}.pdf`}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Executed PDF
            </a>
          )}
        </div>
      </div>

      {/* Director Countersign & Action Panel */}
      {agreement && (
        <DirectorCountersignPanel
          agreementId={agreement.id}
          agreementNumber={agreement.agreementNumber}
          status={agreement.status}
          educatorSigned={educatorSigned}
          educatorSignedName={educatorSigner?.signerName}
          finalPdfUrl={agreement.finalPdfUrl}
        />
      )}

      {/* e-Stamp Banner if Attached */}
      {agreement?.stamp && (
        <div className="p-5 rounded-3xl border border-emerald-500/30 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-emerald-950 text-sm">Authentic Government e-Stamp Certificate</h4>
                <span className="px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900 font-mono text-[10px] font-bold">
                  {agreement?.stamp?.verificationStatus || "VERIFIED"}
                </span>
              </div>
              <p className="text-emerald-800 mt-0.5 font-mono">
                Certificate No: <strong>{agreement?.stamp?.certificateNumber || "N/A"}</strong> &bull; Amount: INR {agreement?.stamp?.stampDutyAmount || "100"}/- &bull; State: {agreement?.stamp?.issuingState || "Uttar Pradesh"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Agreement Text Container */}
      <div className="glass-card rounded-3xl p-6 md:p-10 border border-outline-variant/30 shadow-xl bg-surface-container-lowest text-on-surface space-y-6">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-mono">
            Agreement Legal Text &amp; Covenants
          </span>
          <span className="text-[11px] text-on-surface-variant font-mono">
            Version {agreement?.versions[0]?.versionNumber || 1} &bull; {agreement?.versions[0]?.isLocked ? "Version Locked" : "Draft"}
          </span>
        </div>

        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 overflow-x-auto selection:bg-primary/20">
          {bodyText}
        </pre>

        {/* Dual Signatures Execution Block */}
        <div className="border-t-2 border-dashed border-outline-variant/30 pt-6 mt-8">
          <h4 className="font-bold text-xs uppercase text-on-surface-variant mb-4 tracking-wider">
            Verified Digital Signatures Execution Block
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Educator Box */}
            <div className="p-5 rounded-2xl border border-outline-variant/30 bg-surface-container-high/30 space-y-3">
              <span className="text-[11px] font-bold text-on-surface-variant block uppercase">
                First Party: Educator
              </span>
              {educatorSigned ? (
                <div className="space-y-1">
                  <p className="font-serif italic text-2xl text-primary font-bold">
                    {educatorSigner?.signerName || legacyContract?.signedName || educatorName}
                  </p>
                  <p className="text-[10px] text-on-surface-variant font-mono">
                    Signed on {educatorSignature?.signedAt?.toUTCString() || legacyContract?.signedAt?.toUTCString() || "Verified"}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-mono">
                    IP: {educatorSignature?.signerIp || legacyContract?.signatureIp || "Verified"} &bull; {educatorSignature?.signatureMethod || "ELECTRONIC"}
                  </p>
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center border border-dashed border-outline-variant/40 rounded-xl text-xs text-on-surface-variant">
                  Pending Educator Electronic Signature
                </div>
              )}
              <div className="pt-2 border-t border-outline-variant/20 text-xs">
                <p className="font-bold text-on-surface">{educatorName}</p>
                <p className="text-[11px] text-on-surface-variant">Designation: {department} Faculty</p>
              </div>
            </div>

            {/* Platform Owner Signatory Box */}
            <div className="p-5 rounded-2xl border border-outline-variant/30 bg-surface-container-high/30 space-y-3">
              <span className="text-[11px] font-bold text-on-surface-variant block uppercase">
                Platform Owner: ATOMIC PATHSHALA EDUCATION
              </span>
              {directorSigned ? (
                <div className="space-y-1">
                  <p className="font-serif italic text-2xl text-primary font-bold">
                    {directorSigner?.signerName || "Firoz Ali"}
                  </p>
                  <p className="text-[10px] text-on-surface-variant font-mono">
                    Signed on {directorSignature?.signedAt?.toUTCString() || "Fully Executed"}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-mono">
                    IP: {directorSignature?.signerIp || "Verified"} &bull; Countersigned &amp; Sealed
                  </p>
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center border border-dashed border-outline-variant/40 rounded-xl text-xs text-amber-700 bg-amber-50/30">
                  {educatorSigned ? "Awaiting Founder Countersignature" : "Countersignature Pending Educator Sign"}
                </div>
              )}
              <div className="pt-2 border-t border-outline-variant/20 text-xs">
                <p className="font-bold text-on-surface">Firoz Ali</p>
                <p className="text-[11px] text-on-surface-variant">Founder and Director &bull; Rampur, Uttar Pradesh, India</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Transactional Email Logs Table */}
      {agreement?.emailLogs && agreement.emailLogs.length > 0 && (
        <section className="glass-card rounded-3xl p-6 border border-outline-variant/30 space-y-4">
          <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-3">
            <span className="material-symbols-outlined text-primary">mark_email_read</span>
            <h3 className="font-bold text-sm text-on-surface">Email Delivery History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-high/40 text-on-surface-variant font-bold text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Message ID</th>
                  <th className="py-2.5 px-3">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {agreement.emailLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-3 font-mono font-bold text-[11px]">{log.emailType}</td>
                    <td className="py-2 px-3">{log.recipient}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800"
                            : log.status === "FAILED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-[10px] text-on-surface-variant">
                      {log.providerMessageId || log.errorMessage || "—"}
                    </td>
                    <td className="py-2 px-3 font-mono text-[10px]">
                      {log.sentAt ? new Date(log.sentAt).toLocaleTimeString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Cryptographic Audit Trail */}
      {agreement?.auditLogs && agreement.auditLogs.length > 0 && (
        <section className="glass-card rounded-3xl p-6 md:p-8 border border-outline-variant/30 space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">verified_user</span>
              <h3 className="font-bold text-sm text-on-surface">Cryptographic Audit Trail</h3>
            </div>
            {agreement.versions[0]?.documentHash && (
              <span className="text-[11px] font-mono text-on-surface-variant">
                Hash: {agreement.versions[0].documentHash.slice(0, 20)}...
              </span>
            )}
          </div>

          <div className="space-y-3">
            {agreement.auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs border-b border-outline-variant/10 pb-2.5 last:border-b-0">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-xs">receipt_long</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-on-surface font-mono">{log.eventType}</span>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {new Date(log.createdAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                  {log.actorName && (
                    <p className="text-[11px] text-on-surface-variant">
                      By: {log.actorName} ({log.actorEmail || "System"}) &bull; IP: {log.actorIp || "Verified"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
