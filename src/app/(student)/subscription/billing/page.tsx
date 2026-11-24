import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Billing History & Invoices",
};

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: "bg-primary/10 text-primary",
  PENDING: "bg-secondary/10 text-secondary",
  FAILED: "bg-error/10 text-error",
  REFUNDED: "bg-error/10 text-error",
  PARTIALLY_REFUNDED: "bg-amber-500/10 text-amber-600",
};

export default async function BillingHistoryPage() {
  const { student } = await requireStudentSession();

  const [subscriptionPayments, batchOrders] = await Promise.all([
    prisma.subscriptionPayment.findMany({
      where: { subscription: { studentId: student.id } },
      include: {
        coupon: { select: { code: true } },
        refunds: true,
        subscription: { select: { plan: true, billingCycle: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.batchOrder.findMany({
      where: { studentId: student.id },
      include: {
        coupon: { select: { code: true } },
        refunds: true,
        batch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const items = [
    ...subscriptionPayments.map((p) => ({
      id: p.id,
      title: `${p.subscription.plan} Plan (${p.subscription.billingCycle})`,
      amount: p.amount,
      status: p.status,
      couponCode: p.coupon?.code ?? null,
      invoiceNumber: p.invoiceNumber,
      orderNumber: null,
      refundedAmount: p.refunds
        .filter((r) => r.status === "SUCCESS")
        .reduce((sum, r) => sum + r.amount, 0),
      createdAt: p.createdAt,
      invoiceUrl: p.invoiceNumber ? `/subscription/billing/${p.id}` : null,
    })),
    ...batchOrders.map((o) => ({
      id: o.id,
      title: o.batch.name,
      amount: o.amount,
      status: o.status,
      couponCode: o.coupon?.code ?? null,
      invoiceNumber: o.invoiceNumber,
      orderNumber: o.orderNumber,
      refundedAmount: o.refunds
        .filter((r) => r.status === "SUCCESS")
        .reduce((sum, r) => sum + r.amount, 0),
      createdAt: o.createdAt,
      invoiceUrl: o.invoiceNumber ? `/orders/${o.id}/receipt` : null,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div>
        <p className="mb-2">
          <Link href="/subscription" className="text-label-sm text-primary hover:underline">
            &larr; Back to Subscription
          </Link>
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Billing History &amp; Receipts</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Every course and subscription payment on your account, with downloadable invoices.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No transactions yet.
        </div>
      ) : (
        <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="font-label-md text-label-md text-on-surface font-bold">
                  {item.title}
                </p>
                <p className="font-label-sm text-on-surface mt-0.5">
                  ₹{item.amount.toLocaleString("en-IN")}
                  {item.couponCode && (
                    <span className="text-label-sm text-emerald-600 font-medium"> · Coupon {item.couponCode}</span>
                  )}
                </p>
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  {item.createdAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {item.invoiceNumber && <> · {item.invoiceNumber}</>}
                  {item.orderNumber && <> · {item.orderNumber}</>}
                </p>
                {item.refundedAmount > 0 && (
                  <p className="text-label-sm text-error mt-0.5">
                    ₹{item.refundedAmount.toLocaleString("en-IN")} refunded
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    STATUS_STYLE[item.status] ?? "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {item.status}
                </span>
                {item.status === "SUCCESS" && item.invoiceUrl && (
                  <Link
                    href={item.invoiceUrl}
                    className="text-label-md text-primary hover:underline font-bold"
                  >
                    View receipt
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
