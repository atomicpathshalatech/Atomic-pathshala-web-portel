import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PrintInvoiceButton } from "@/components/student/PrintInvoiceButton";

export const metadata: Metadata = {
  title: "Invoice",
};

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "1 month",
  QUARTERLY: "3 months",
  HALF_YEARLY: "6 months",
  ANNUAL: "1 year",
};

const PLAN_LABELS: Record<string, string> = { BASIC: "Basic", PRO: "Pro" };

/**
 * A print-friendly invoice — no PDF-generation library involved. The
 * browser's own "Print / Save as PDF" does the job (same pattern as the
 * rest of this build avoiding new heavy dependencies where a plain page
 * already gets there), styled with `print:` utility classes so only the
 * invoice itself ends up on the page, not the site chrome around it.
 */
export default async function InvoicePage({ params }: { params: { paymentId: string } }) {
  const { student } = await requireStudentSession();

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: params.paymentId },
    include: {
      subscription: { include: { student: { include: { user: true } } } },
      coupon: { select: { code: true } },
      refunds: { where: { status: "SUCCESS" } },
    },
  });

  if (!payment || payment.subscription.studentId !== student.id) notFound();
  if (payment.status !== "SUCCESS" || !payment.invoiceNumber) redirect("/subscription/billing");

  const refundedAmount = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
  const sub = payment.subscription;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="print:hidden flex items-center justify-between">
        <Link href="/subscription/billing" className="text-label-sm text-primary hover:underline">
          &larr; Back to Billing History
        </Link>
        <PrintInvoiceButton />
      </div>

      <div className="glass-card print:shadow-none print:border-0 rounded-2xl p-8 md:p-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Atomic Pathshala</h1>
            <p className="text-label-sm text-on-surface-variant mt-1">Enterprise Education Platform</p>
          </div>
          <div className="text-right">
            <p className="font-label-lg text-label-lg text-on-surface">{payment.invoiceNumber}</p>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              {payment.createdAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/20 pt-6">
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wide mb-1">Billed to</p>
            <p className="font-label-md text-label-md text-on-surface">{sub.student.user.name}</p>
            <p className="text-label-sm text-on-surface-variant">{sub.student.user.email}</p>
            <p className="text-label-sm text-on-surface-variant">{sub.student.enrollmentNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wide mb-1">Payment method</p>
            <p className="font-label-md text-label-md text-on-surface">
              {payment.method === "RAZORPAY" ? "Razorpay" : "Offline"}
            </p>
            {payment.razorpayPaymentId && (
              <p className="text-label-sm text-on-surface-variant break-all">{payment.razorpayPaymentId}</p>
            )}
          </div>
        </div>

        <table className="w-full border-t border-outline-variant/20 pt-2">
          <thead>
            <tr className="text-left text-label-sm text-on-surface-variant uppercase tracking-wide">
              <th className="py-3 font-normal">Description</th>
              <th className="py-3 font-normal text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-outline-variant/20">
              <td className="py-3 font-body-md text-body-md text-on-surface">
                {PLAN_LABELS[sub.plan] ?? sub.plan} plan — {CYCLE_LABELS[sub.billingCycle] ?? sub.billingCycle}
                {payment.periodStart && payment.periodEnd && (
                  <span className="block text-label-sm text-on-surface-variant mt-0.5">
                    {payment.periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {" – "}
                    {payment.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
                {payment.coupon && (
                  <span className="block text-label-sm text-primary mt-0.5">
                    Coupon applied: {payment.coupon.code}
                  </span>
                )}
              </td>
              <td className="py-3 font-body-md text-body-md text-on-surface text-right">
                ₹{payment.amount.toLocaleString("en-IN")}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-outline-variant/30">
              <td className="py-3 font-label-lg text-label-lg text-on-surface">Total paid</td>
              <td className="py-3 font-label-lg text-label-lg text-on-surface text-right">
                ₹{payment.amount.toLocaleString("en-IN")}
              </td>
            </tr>
            {refundedAmount > 0 && (
              <tr>
                <td className="py-1 text-label-md text-error">Refunded</td>
                <td className="py-1 text-label-md text-error text-right">
                  −₹{refundedAmount.toLocaleString("en-IN")}
                </td>
              </tr>
            )}
          </tfoot>
        </table>

        <p className="text-label-sm text-on-surface-variant border-t border-outline-variant/20 pt-4">
          This is a computer-generated invoice and does not require a signature.
        </p>
      </div>
    </div>
  );
}
