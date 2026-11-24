import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { recordBatchOrderRefund } from "@/server/services/commerce-order-service";
import { prisma } from "@/lib/db";
import { z } from "zod";

const batchRefundSchema = z.object({
  amount: z.number().positive("Refund amount must be greater than 0"),
  reason: z.string().max(500).optional(),
  revokeAccess: z.boolean().default(true).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_REFUND_APPROVE);

    const input = batchRefundSchema.parse(await request.json());

    const refund = await recordBatchOrderRefund({
      orderId: params.id,
      amount: input.amount,
      reason: input.reason,
      processedById: session.user.id,
      revokeAccess: input.revokeAccess ?? true,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_ORDER_REFUNDED",
        entityType: "BatchOrder",
        entityId: params.id,
        metadata: {
          amount: input.amount,
          reason: input.reason || null,
          revokeAccess: input.revokeAccess ?? true,
        },
      },
    });

    return apiSuccess({ refund }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
