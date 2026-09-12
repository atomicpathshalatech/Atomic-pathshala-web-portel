import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createCheckout } from "@/server/services/subscription-service";
import { checkoutSchema } from "@/lib/validation/subscription";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const { plan, billingCycle, couponCode } = checkoutSchema.parse(await request.json());

    const result = await createCheckout(student.id, plan, billingCycle, couponCode);

    // CRM signal: a checkout was actually created (a PENDING SubscriptionPayment
    // now exists) — real payment intent, see src/lib/crm/lead-category.ts.
    try {
      const { recordActivity, syncCategoryToOutreach } = await import("@/lib/crm/lead-category");
      const category = await recordActivity({ studentId: student.id, type: "PAYMENT_INTENT" });
      await syncCategoryToOutreach(student.id, category);
    } catch (err) {
      console.error("Activity tracking error (subscription checkout intent):", err);
    }

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
