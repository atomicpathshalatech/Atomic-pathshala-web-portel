import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { confirmTrialCheckout } from "@/server/services/subscription-service";
import { verifyTrialSchema } from "@/lib/validation/subscription";

/**
 * Called right after the Razorpay Checkout widget's success callback for a
 * trial signup — this is what actually creates the Subscription row, so
 * an abandoned/failed checkout leaves no record and no free access.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const payload = verifyTrialSchema.parse(await request.json());
    const subscription = await confirmTrialCheckout(student.id, payload);

    return apiSuccess({ subscription });
  } catch (error) {
    return handleApiError(error);
  }
}
