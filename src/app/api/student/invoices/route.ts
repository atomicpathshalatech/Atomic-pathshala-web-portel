import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Unified Billing & Invoices History:
 * Returns both Batch purchases and Subscriptions for the signed-in student,
 * sorted chronologically newest first.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

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
          batch: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const formattedSubscriptionPayments = subscriptionPayments.map((p) => ({
      id: p.id,
      type: "SUBSCRIPTION" as const,
      productName: `${p.subscription.plan} Plan (${p.subscription.billingCycle})`,
      amount: p.amount,
      status: p.status,
      method: p.method,
      invoiceNumber: p.invoiceNumber,
      orderNumber: null,
      couponCode: p.coupon?.code ?? null,
      refundedAmount: p.refunds
        .filter((r) => r.status === "SUCCESS")
        .reduce((sum, r) => sum + r.amount, 0),
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      createdAt: p.createdAt,
      viewUrl: `/subscription/billing/${p.id}`,
    }));

    const formattedBatchOrders = batchOrders.map((o) => ({
      id: o.id,
      type: "BATCH_ORDER" as const,
      productName: o.batch.name,
      amount: o.amount,
      originalAmount: o.originalAmount,
      discountAmount: o.discountAmount,
      status: o.status,
      method: o.gatewayProvider || "ONLINE",
      invoiceNumber: o.invoiceNumber,
      orderNumber: o.orderNumber,
      couponCode: o.coupon?.code ?? null,
      refundedAmount: o.refunds
        .filter((r) => r.status === "SUCCESS")
        .reduce((sum, r) => sum + r.amount, 0),
      createdAt: o.createdAt,
      viewUrl: `/orders/${o.id}/receipt`,
    }));

    // Merge and sort newest first
    const allTransactions = [...formattedSubscriptionPayments, ...formattedBatchOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return apiSuccess({
      payments: allTransactions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
