import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { verifyAndActivateOrderPayment } from "@/server/services/subscription-service";
import { verifyPaymentSchema } from "@/lib/validation/subscription";

/**
 * Called by the client right after the Razorpay Checkout widget's success
 * callback fires, for ONE-TIME (fixed-duration) Order payments only.
 * Recurring MONTHLY plans are activated by the `subscription.charged`
 * webhook instead (see /api/webhooks/razorpay) — never trust the client
 * alone for those since Razorpay charges them independently.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const payload = verifyPaymentSchema.parse(await request.json());
    const subscription = await verifyAndActivateOrderPayment(student.id, payload);

    return apiSuccess({ subscription });
  } catch (error) {
    return handleApiError(error);
  }
}
