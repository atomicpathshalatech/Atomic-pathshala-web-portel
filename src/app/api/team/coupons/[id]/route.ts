import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { couponUpdateSchema } from "@/lib/validation/finance";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Edit-in-place, not full CRUD — a coupon's code/type/value/plan are
 * fixed at creation (changing the discount on a code students may have
 * already seen or half-redeemed would be confusing); only isActive,
 * maxRedemptions, and expiresAt can move after the fact. There's no
 * DELETE — deactivate instead, so redemption history stays intact.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COUPON_UPDATE);

    const input = couponUpdateSchema.parse(await request.json());

    const existing = await prisma.coupon.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Coupon not found.", 404);

    const coupon = await prisma.coupon.update({
      where: { id: params.id },
      data: input,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "COUPON_UPDATED",
        entityType: "Coupon",
        entityId: coupon.id,
        metadata: input,
      },
    });

    return apiSuccess({ coupon });
  } catch (error) {
    return handleApiError(error);
  }
}
