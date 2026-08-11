import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { cancelSubscription } from "@/server/services/subscription-service";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const subscription = await cancelSubscription(student.id);
    return apiSuccess({ subscription });
  } catch (error) {
    return handleApiError(error);
  }
}
