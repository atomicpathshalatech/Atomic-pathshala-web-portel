import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { verifyAndActivateBatchOrder } from "@/server/services/batch-order-service";
import { verifyPaymentSchema } from "@/lib/validation/subscription";

/**
 * Called by the client right after the Razorpay Checkout widget's success
 * callback fires. Verifies the signature and activates the order
 * server-side — the client's redirect/callback firing is never, on its
 * own, treated as proof of payment. A payment.captured webhook
 * (/api/webhooks/razorpay) independently reconciles the same order as a
 * backup, so a student closing the tab right after paying still ends up
 * enrolled.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const payload = verifyPaymentSchema.parse(await request.json());
    const { order, alreadyProcessed } = await verifyAndActivateBatchOrder(student.id, payload);

    if (order.batchId !== params.id) {
      return apiError("This order does not match the requested batch.", 400);
    }

    return apiSuccess({ status: order.status, alreadyProcessed });
  } catch (error) {
    return handleApiError(error);
  }
}
