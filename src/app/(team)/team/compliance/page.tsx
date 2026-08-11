import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { PenaltyRuleManager } from "@/components/team-portal/PenaltyRuleManager";
import { ApplyPenaltyForm } from "@/components/team-portal/ApplyPenaltyForm";

export const metadata: Metadata = { title: "Penalty & Compliance" };

export default async function CompliancePage() {
  const { session, user } = await requireTeamSession();

  const canManage = await hasPermission(user.id, PERMISSIONS.PENALTY_RULE_MANAGE);
  const canReadAny = await hasPermission(user.id, PERMISSIONS.PENALTY_READ_ANY);
  const canReadSelf = await hasPermission(user.id, PERMISSIONS.PENALTY_READ_SELF);
  if (!canManage && !canReadAny && !canReadSelf) redirect("/team");

  const rules = await prisma.penaltyRule.findMany({ orderBy: { createdAt: "asc" } });

  const records = await prisma.penaltyRecord.findMany({
    where: canReadAny ? undefined : { teacher: { userId: session.user.id } },
    include: {
      rule: { select: { name: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const teachers = canManage
    ? (
        await prisma.teacher.findMany({
          where: { onboardingStatus: "ACTIVE" },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        })
      ).map((t) => ({ id: t.id, name: t.user.name }))
    : [];

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Penalty & Compliance</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          {canManage ? "Manage compliance rules and apply penalties." : "Your compliance and penalty history."}
        </p>
      </div>

      {canManage && (
        <section className="space-y-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Rules</h2>
          <PenaltyRuleManager rules={rules} />
        </section>
      )}

      {canManage && (
        <section className="space-y-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Apply Penalty</h2>
          <ApplyPenaltyForm rules={rules.filter((r) => r.isActive)} teachers={teachers} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          {canReadAny ? "Recent Records" : "Your Records"}
        </h2>
        {records.length === 0 ? (
          <div className="glass-card rounded-xl p-stack-lg text-center text-on-surface-variant font-body-md">
            No penalty records{canReadAny ? "" : " for you"} yet.
          </div>
        ) : (
          <div className="glass-card rounded-xl divide-y divide-outline-variant/20">
            {records.map((r) => (
              <div key={r.id} className="p-stack-md flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-label-lg text-label-lg text-on-surface">{r.rule.name}</div>
                  <div className="text-label-sm text-on-surface-variant mt-0.5">
                    {canReadAny ? `${r.teacher.user.name} · ` : ""}
                    {r.month}
                    {r.note ? ` · ${r.note}` : ""}
                  </div>
                </div>
                <span className="font-label-lg text-label-lg text-error shrink-0">-₹{r.amount}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
