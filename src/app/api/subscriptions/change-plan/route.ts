import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { schedulePlanChange } from "@/server/services/subscription-service";
import { changePlanSchema } from "@/lib/validation/subscription";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student record for this account", 404);

    const { plan } = changePlanSchema.parse(await request.json());
    const subscription = await schedulePlanChange(student.id, plan);

    return apiSuccess({
      subscription,
      message: `Plan change to ${plan} is scheduled for your next billing cycle.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
