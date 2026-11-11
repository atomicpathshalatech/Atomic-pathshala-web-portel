import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { CRMActivityType } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_UPDATE);

    const body = await req.json();
    const { status, outcome } = body;

    const followUp = await prisma.cRMLeadFollowUp.update({
      where: { id: params.id },
      data: {
        status: status || "COMPLETED",
        outcome: outcome || "Completed successfully",
        completedAt: status === "COMPLETED" ? new Date() : undefined,
      },
    });

    await prisma.cRMLeadActivity.create({
      data: {
        leadId: followUp.leadId,
        type: CRMActivityType.FOLLOW_UP_COMPLETED,
        title: `Follow-up ${status || "Completed"}`,
        description: outcome || `Task marked as ${status || "COMPLETED"}`,
        performedById: session.user.id,
      },
    });

    return apiSuccess({ followUp });
  } catch (error) {
    return handleApiError(error);
  }
}
