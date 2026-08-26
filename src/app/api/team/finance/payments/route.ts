import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { SubscriptionPaymentStatus } from "@prisma/client";

const STATUS_VALUES = ["PENDING", "SUCCESS", "FAILED"] as const;

/** Payments across every student, newest first — the "reconciliation"
 *  half of Finance: every SubscriptionPayment row with its invoice
 *  number, coupon (if any), and refund history, in one list. */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_READ);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status: SubscriptionPaymentStatus | undefined = STATUS_VALUES.includes(statusParam as any)
      ? (statusParam as SubscriptionPaymentStatus)
      : undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = 25;

    const where = status ? { status } : {};

    const [payments, total] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        where,
        include: {
          subscription: { include: { student: { include: { user: { select: { name: true } } } } } },
          coupon: { select: { code: true } },
          refunds: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.subscriptionPayment.count({ where }),
    ]);

    return apiSuccess({
      payments: payments.map((p) => ({
        id: p.id,
        studentName: p.subscription.student.user.name,
        studentId: p.subscription.studentId,
        amount: p.amount,
        status: p.status,
        method: p.method,
        invoiceNumber: p.invoiceNumber,
        couponCode: p.coupon?.code ?? null,
        refundedAmount: p.refunds
          .filter((r) => r.status === "SUCCESS")
          .reduce((sum, r) => sum + r.amount, 0),
        createdAt: p.createdAt,
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
