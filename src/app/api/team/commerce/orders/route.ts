import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import type { Prisma, BatchOrderStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_READ);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const status = searchParams.get("status") as BatchOrderStatus | null;
    const batchId = searchParams.get("batchId")?.trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 25)));

    const where: Prisma.BatchOrderWhereInput = {
      ...(status ? { status } : {}),
      ...(batchId ? { batchId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q, mode: "insensitive" } },
              { invoiceNumber: { contains: q, mode: "insensitive" } },
              { id: { contains: q, mode: "insensitive" } },
              { razorpayOrderId: { contains: q, mode: "insensitive" } },
              { razorpayPaymentId: { contains: q, mode: "insensitive" } },
              {
                student: {
                  OR: [
                    { enrollmentNumber: { contains: q, mode: "insensitive" } },
                    { studentIdCode: { contains: q, mode: "insensitive" } },
                    { user: { name: { contains: q, mode: "insensitive" } } },
                    { user: { email: { contains: q, mode: "insensitive" } } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [orders, total, allSummary] = await Promise.all([
      prisma.batchOrder.findMany({
        where,
        include: {
          student: { include: { user: { select: { name: true, email: true, phone: true } } } },
          batch: { select: { id: true, name: true, code: true } },
          coupon: { select: { code: true } },
          refunds: true,
          paymentRecords: { orderBy: { createdAt: "desc" }, take: 3 },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.batchOrder.count({ where }),
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

    const formatted = orders.map((o) => {
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
        gatewayProvider: o.gatewayProvider || (o.razorpayOrderId ? "RAZORPAY" : "UNKNOWN"),
        gatewayOrderId: o.gatewayOrderId || o.razorpayOrderId,
        gatewayPaymentId: o.razorpayPaymentId || o.paymentRecords[0]?.gatewayPaymentId,
        couponCode: o.coupon?.code || null,
        refundedAmount,
        refundable: o.status === "SUCCESS" && o.amount - refundedAmount > 0,
        createdAt: o.createdAt,
      };
    });

    return apiSuccess({
      orders: formatted,
      total,
      page,
      pageSize,
      summary: {
        totalSuccessfulOrders: allSummary._count || 0,
        grossSales: allSummary._sum.originalAmount || allSummary._sum.amount || 0,
        totalDiscounts: allSummary._sum.discountAmount || 0,
        netRevenue: allSummary._sum.amount || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
