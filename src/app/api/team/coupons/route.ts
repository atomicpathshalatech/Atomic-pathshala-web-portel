import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { couponCreateSchema } from "@/lib/validation/finance";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COUPON_READ);

    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
    return apiSuccess({ coupons });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COUPON_CREATE);

    const input = couponCreateSchema.parse(await request.json());

    const existing = await prisma.coupon.findUnique({ where: { code: input.code } });
    if (existing) return apiError("A coupon with this code already exists.", 409);

    const coupon = await prisma.coupon.create({
      data: {
        code: input.code,
        type: input.type,
        value: input.value,
        plan: input.plan,
        maxRedemptions: input.maxRedemptions,
        expiresAt: input.expiresAt,
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "COUPON_CREATED",
        entityType: "Coupon",
        entityId: coupon.id,
        metadata: { code: coupon.code, type: coupon.type, value: coupon.value },
      },
    });

    return apiSuccess({ coupon }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
