import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { refundCreateSchema } from "@/lib/validation/finance";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createRefund } from "@/server/services/subscription-service";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_REFUND_APPROVE);

    const input = refundCreateSchema.parse(await request.json());

    const refund = await createRefund(params.id, input.amount, input.reason, session.user.id);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PAYMENT_REFUNDED",
        entityType: "SubscriptionPayment",
        entityId: params.id,
        metadata: { amount: input.amount, reason: input.reason ?? null, status: refund.status },
      },
    });

    return apiSuccess({ refund }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
