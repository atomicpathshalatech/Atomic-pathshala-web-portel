import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { validateBatchCoupon } from "@/server/services/commerce-order-service";
import { couponValidateSchema } from "@/lib/validation/finance";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record found for this account", 404);

    const input = couponValidateSchema.parse(await request.json());

    if (!input.batchId) {
      return apiError("Batch ID is required for coupon validation", 400);
    }

    const batch = await prisma.batch.findUnique({
      where: { id: input.batchId },
      select: { id: true, price: true },
    });

    if (!batch || batch.price == null) {
      return apiError("Batch not found or not sellable", 404);
    }

    const result = await validateBatchCoupon(input.code, batch.id, batch.price, student.id);

    return apiSuccess({
      code: result.coupon.code,
      discountAmount: result.discountAmount,
      finalPayable: result.finalPayable,
      type: result.coupon.type,
      value: result.coupon.value,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
