import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import Link from "next/link";
import { FinancePanel } from "@/components/team-portal/FinancePanel";
import { FinanceNavTabs } from "@/components/team-portal/FinanceNavTabs";

export const metadata: Metadata = {
  title: "Finance & Subscriptions",
};

export default async function FinancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.FINANCE_READ);
  if (!canRead) redirect("/team");

  const canRefund = await hasPermission(session.user.id, PERMISSIONS.FINANCE_REFUND_APPROVE);

  const payments = await prisma.subscriptionPayment.findMany({
    include: {
      subscription: { include: { student: { include: { user: { select: { name: true } } } } } },
      coupon: { select: { code: true } },
      refunds: true,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <FinanceNavTabs />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary">Finance &amp; Subscriptions</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Payment reconciliation, invoices, and refunds across subscriptions and courses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/team/commerce/orders"
            className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition shadow-sm"
          >
            Batch Orders Dashboard
          </Link>
          <Link
            href="/team/coupons"
            className="px-4 py-2 text-xs font-bold rounded-xl border border-outline-variant/30 hover:bg-surface-container transition"
          >
            Coupons
          </Link>
        </div>
      </div>

      <FinancePanel
        canRefund={canRefund}
        initialPayments={payments.map((p) => ({
          id: p.id,
          studentName: p.subscription.student.user.name,
          amount: p.amount,
          status: p.status,
          method: p.method,
          invoiceNumber: p.invoiceNumber,
          couponCode: p.coupon?.code ?? null,
          refundedAmount: p.refunds
            .filter((r) => r.status === "SUCCESS")
            .reduce((sum, r) => sum + r.amount, 0),
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
