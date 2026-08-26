import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Billing History",
};

const STATUS_STYLE: Record<string, string> = {
  SUCCESS: "bg-primary/10 text-primary",
  PENDING: "bg-secondary/10 text-secondary",
  FAILED: "bg-error/10 text-error",
};

export default async function BillingHistoryPage() {
  const { student } = await requireStudentSession();

  const payments = await prisma.subscriptionPayment.findMany({
    where: { subscription: { studentId: student.id } },
    include: { coupon: { select: { code: true } }, refunds: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-stack-lg max-w-3xl">
      <div>
        <p className="mb-2">
          <Link href="/subscription" className="text-label-sm text-primary hover:underline">
            &larr; Back to Subscription
          </Link>
        </p>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Billing History</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Every payment on your account, with a downloadable invoice for each one that went through.
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No payments yet.
        </div>
      ) : (
        <div className="glass-card rounded-2xl divide-y divide-outline-variant/20">
          {payments.map((p) => {
            const refundedAmount = p.refunds
              .filter((r) => r.status === "SUCCESS")
              .reduce((sum, r) => sum + r.amount, 0);
            return (
              <div key={p.id} className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface">
                    ₹{p.amount.toLocaleString("en-IN")}
                    {p.coupon && (
                      <span className="text-label-sm text-on-surface-variant"> · {p.coupon.code}</span>
                    )}
                  </p>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">
                    {p.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {p.invoiceNumber && <> · {p.invoiceNumber}</>}
                  </p>
                  {refundedAmount > 0 && (
                    <p className="text-label-sm text-error mt-0.5">
                      ₹{refundedAmount.toLocaleString("en-IN")} refunded
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      STATUS_STYLE[p.status] ?? "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {p.status}
                  </span>
                  {p.status === "SUCCESS" && p.invoiceNumber && (
                    <Link
                      href={`/subscription/billing/${p.id}`}
                      className="text-label-md text-primary hover:underline"
                    >
                      View invoice
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
