import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { updatePricingSchema } from "@/lib/validation/team-subscription";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getAllPlanPricing, updatePlanPricing } from "@/lib/subscription/pricing";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.SUBSCRIPTION_MANAGE);

    const { entries } = updatePricingSchema.parse(await request.json());

    await updatePlanPricing(entries, session.user.id);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PLAN_PRICING_UPDATED",
        entityType: "PlanPricing",
        metadata: entries,
      },
    });

    const pricing = await getAllPlanPricing();
    return apiSuccess({ pricing });
  } catch (error) {
    return handleApiError(error);
  }
}
