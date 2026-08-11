import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Contracts" };

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-outline-variant/20 text-on-surface-variant",
  SENT: "bg-secondary/10 text-secondary",
  SIGNED: "bg-tertiary/10 text-tertiary",
  DECLINED: "bg-error/10 text-error",
};

export default async function ContractsPage() {
  const { session, user } = await requireTeamSession();

  const canReadAny = await hasPermission(user.id, PERMISSIONS.CONTRACT_READ_ANY);
  const canReadSelf = await hasPermission(user.id, PERMISSIONS.CONTRACT_READ_SELF);
  if (!canReadAny && !canReadSelf) redirect("/team");

  const contracts = await prisma.contract.findMany({
    where: canReadAny ? undefined : { teacher: { userId: session.user.id } },
    include: { teacher: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Contracts</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          {canReadAny ? "All faculty employment contracts." : "Your employment contracts and their signature status."}
        </p>
      </div>

      {contracts.length === 0 ? (
        <div className="glass-card rounded-xl p-stack-lg text-center text-on-surface-variant font-body-md">
          No contracts yet.
        </div>
      ) : (
        <div className="glass-card rounded-xl divide-y divide-outline-variant/20">
          {contracts.map((c) => (
            <Link
              key={c.id}
              href={`/team/contracts/${c.id}`}
              className="flex items-center justify-between gap-4 p-stack-md hover:bg-surface-container-high/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-label-lg text-label-lg text-on-surface">{c.title}</div>
                {canReadAny && (
                  <div className="text-label-sm text-on-surface-variant truncate">{c.teacher.user.name}</div>
                )}
              </div>
              <span className={`text-label-sm font-label-sm px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[c.status]}`}>
                {c.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
