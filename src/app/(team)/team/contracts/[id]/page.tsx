import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { ContractSignPanel } from "@/components/team-portal/ContractSignPanel";

export const metadata: Metadata = { title: "Contract" };

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, user } = await requireTeamSession();

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { teacher: { include: { user: { select: { name: true, email: true } } } } },
  });
  if (!contract) notFound();

  const canReadAny = await hasPermission(user.id, PERMISSIONS.CONTRACT_READ_ANY);
  const isOwner = contract.teacher.userId === session.user.id;
  if (!canReadAny && !isOwner) redirect("/team/contracts");

  const canSignSelf = isOwner && (await hasPermission(user.id, PERMISSIONS.CONTRACT_SIGN_SELF));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">{contract.title}</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          For {contract.teacher.user.name} · Status: {contract.status}
        </p>
      </div>

      <div className="glass-card rounded-xl p-stack-lg">
        <pre className="whitespace-pre-wrap font-body-md text-body-md text-on-surface">{contract.bodyText}</pre>
      </div>

      {contract.status === "SENT" && canSignSelf && <ContractSignPanel contractId={contract.id} />}

      {contract.status === "SIGNED" && (
        <div className="glass-card rounded-xl p-stack-md bg-tertiary/5">
          <p className="font-label-lg text-label-lg text-tertiary">
            Signed by {contract.signedName} on {contract.signedAt?.toLocaleString("en-IN")}
          </p>
        </div>
      )}

      {contract.status === "DECLINED" && (
        <div className="glass-card rounded-xl p-stack-md bg-error/5">
          <p className="font-label-lg text-label-lg text-error">Declined: {contract.declinedReason}</p>
        </div>
      )}
    </div>
  );
}
