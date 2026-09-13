import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createBatchCheckout } from "@/server/services/batch-order-service";

/**
 * Creates a Razorpay order for buying this specific batch. The price is
 * always read from Batch.price (the trusted DB source) inside
 * createBatchCheckout — this route never accepts or forwards a
 * client-supplied amount.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const result = await createBatchCheckout(student.id, params.id);

    // CRM signal: a real checkout/payment-intent was created for this batch.
    try {
      const { recordActivity, syncCategoryToOutreach } = await import("@/lib/crm/lead-category");
      const category = await recordActivity({
        studentId: student.id,
        type: "PAYMENT_INTENT",
        batchId: params.id,
      });
      await syncCategoryToOutreach(student.id, category);
    } catch (err) {
      console.error("Activity tracking error (batch checkout intent):", err);
    }

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
