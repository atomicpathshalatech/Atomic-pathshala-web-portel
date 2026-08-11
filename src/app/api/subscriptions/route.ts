import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { syncSubscriptionStatus } from "@/lib/subscription/guard";
import { PLAN_FEATURES } from "@/lib/subscription/config";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const subscription = await prisma.subscription.findUnique({
      where: { studentId: student.id },
    });

    if (!subscription) {
      return apiSuccess({ subscription: null, features: [] });
    }

    const synced = await syncSubscriptionStatus(subscription);
    return apiSuccess({
      subscription: synced,
      features: PLAN_FEATURES[synced.plan],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
