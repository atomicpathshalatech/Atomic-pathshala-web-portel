import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** The signed-in student's own billing history — every payment on their
 *  own subscription, ownership scoped by studentId like /api/doubts. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const payments = await prisma.subscriptionPayment.findMany({
      where: { subscription: { studentId: student.id } },
      include: { coupon: { select: { code: true } }, refunds: true },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        method: p.method,
        invoiceNumber: p.invoiceNumber,
        couponCode: p.coupon?.code ?? null,
        refundedAmount: p.refunds
          .filter((r) => r.status === "SUCCESS")
          .reduce((sum, r) => sum + r.amount, 0),
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
