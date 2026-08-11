import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { grantSubscriptionSchema } from "@/lib/validation/team-subscription";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { grantSubscriptionManually } from "@/server/services/subscription-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.SUBSCRIPTION_MANAGE);

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return apiError("Student not found.", 404);

    const input = grantSubscriptionSchema.parse(await request.json());

    const subscription = await grantSubscriptionManually({ studentId, ...input });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SUBSCRIPTION_GRANTED_MANUALLY",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: input,
      },
    });

    return apiSuccess({ subscription });
  } catch (error) {
    return handleApiError(error);
  }
}
