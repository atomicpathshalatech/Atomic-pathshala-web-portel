import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { SubscriptionAdminPanel } from "@/components/team-portal/SubscriptionAdminPanel";

export const metadata: Metadata = { title: "Student Subscription" };

export default async function StudentSubscriptionPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { user } = await requireTeamSession();
  const canRead = await hasPermission(user.id, PERMISSIONS.FINANCE_READ);
  const canManage = await hasPermission(user.id, PERMISSIONS.SUBSCRIPTION_MANAGE);
  if (!canRead) redirect("/team");

  const { studentId } = await params;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      subscription: { include: { payments: { orderBy: { createdAt: "desc" }, take: 20 } } },
    },
  });
  if (!student) notFound();

  const sub = student.subscription;
  const hasActiveOrTrial = !!sub && ["TRIAL", "ACTIVE", "PAST_DUE"].includes(sub.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">{student.user.name}</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          {student.enrollmentNumber} · {student.user.email}
        </p>
      </div>

      <div className="glass-card rounded-xl p-stack-md">
        {sub ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Plan" value={sub.plan} />
            <Field label="Status" value={sub.status} />
            <Field label="Billing cycle" value={sub.billingCycle} />
            <Field
              label="Period ends"
              value={sub.currentPeriodEnd.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
            {sub.pendingPlan && <Field label="Switching to" value={`${sub.pendingPlan} (next cycle)`} />}
            {sub.cancelAtPeriodEnd && <Field label="Cancellation" value="Scheduled at period end" />}
          </div>
        ) : (
          <p className="text-on-surface-variant font-body-md">No subscription yet.</p>
        )}
      </div>

      {canManage && (
        <SubscriptionAdminPanel studentId={student.id} hasActiveOrTrial={hasActiveOrTrial} />
      )}

      <div>
        <h2 className="font-label-lg text-label-lg text-on-surface mb-2">Payment history</h2>
        {!sub || sub.payments.length === 0 ? (
          <p className="text-on-surface-variant font-body-md">No payments recorded.</p>
        ) : (
          <div className="glass-card rounded-xl divide-y divide-outline-variant/20">
            {sub.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 p-stack-sm">
                <div>
                  <div className="font-label-md text-label-md text-on-surface">
                    ₹{p.amount.toLocaleString("en-IN")} · {p.method ?? "Razorpay"}
                  </div>
                  <div className="text-label-sm text-on-surface-variant">
                    {p.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <span className="text-label-sm font-label-sm px-2.5 py-1 rounded-full bg-outline-variant/20 text-on-surface-variant">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-label-sm font-label-sm text-on-surface-variant">{label}</div>
      <div className="font-label-lg text-label-lg text-on-surface">{value}</div>
    </div>
  );
}
