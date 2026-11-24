import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { CommerceOrdersManager } from "@/components/team-portal/CommerceOrdersManager";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Batch Orders & Commerce",
};

export default async function CommerceOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.FINANCE_READ);
  if (!canRead) redirect("/team");

  const canRefund = await hasPermission(session.user.id, PERMISSIONS.FINANCE_REFUND_APPROVE);

  const [orders, allSummary] = await Promise.all([
    prisma.batchOrder.findMany({
      include: {
        student: { include: { user: { select: { name: true, email: true, phone: true } } } },
        batch: { select: { id: true, name: true, code: true } },
        coupon: { select: { code: true } },
        refunds: true,
        paymentRecords: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.batchOrder.aggregate({
      where: { status: "SUCCESS" },
      _sum: {
        amount: true,
        originalAmount: true,
        discountAmount: true,
      },
      _count: true,
    }),
  ]);

  const formattedOrders = orders.map((o) => {
    const refundedAmount = o.refunds
      .filter((r) => r.status === "SUCCESS")
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      id: o.id,
      orderNumber: o.orderNumber || o.id,
      invoiceNumber: o.invoiceNumber,
      studentName: o.student.user.name,
      studentEmail: o.student.user.email,
      studentId: o.studentId,
      studentRoll: o.student.enrollmentNumber,
      batchId: o.batchId,
      batchName: o.batch.name,
      batchCode: o.batch.code,
      originalAmount: o.originalAmount ?? o.amount,
      discountAmount: o.discountAmount ?? 0,
      amount: o.amount,
      currency: o.currency,
      status: o.status,
      gatewayProvider: o.gatewayProvider || (o.razorpayOrderId ? "RAZORPAY" : "ONLINE"),
      gatewayOrderId: o.gatewayOrderId || o.razorpayOrderId,
      gatewayPaymentId: o.razorpayPaymentId || o.paymentRecords[0]?.gatewayPaymentId || null,
      couponCode: o.coupon?.code || null,
      refundedAmount,
      refundable: o.status === "SUCCESS" && o.amount - refundedAmount > 0,
      createdAt: o.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/team" className="hover:text-primary transition-colors">
              Team Portal
            </Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <Link href="/team/finance" className="hover:text-primary transition-colors">
              Finance
            </Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span>Commerce Orders</span>
          </div>
          <h1 className="font-headline-lg text-2xl font-black text-slate-900 dark:text-white">
            Batch Orders &amp; Sales Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time batch cohort purchases, discount audits, receipts, and refund operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/team/finance"
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            Subscription Billing
          </Link>
          <Link
            href="/team/coupons"
            className="px-4 py-2 text-xs font-bold rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition"
          >
            Manage Coupons
          </Link>
        </div>
      </div>

      <CommerceOrdersManager
        initialOrders={formattedOrders}
        initialSummary={{
          totalSuccessfulOrders: allSummary._count || 0,
          grossSales: allSummary._sum.originalAmount || allSummary._sum.amount || 0,
          totalDiscounts: allSummary._sum.discountAmount || 0,
          netRevenue: allSummary._sum.amount || 0,
        }}
        canRefund={canRefund}
      />
    </div>
  );
}
