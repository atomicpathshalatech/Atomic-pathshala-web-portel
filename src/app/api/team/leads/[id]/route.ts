import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { leadUpdateSchema } from "@/lib/validation/integration";
import { updateOutreachLead, OutreachIntegrationError } from "@/lib/integrations/outreach-leads";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const input = leadUpdateSchema.parse(await request.json());
    if (Object.keys(input).length === 0) return apiError("Nothing to update.", 400);

    // assignedUserId is gated separately from status/stage — a counselor
    // might have LEAD_UPDATE (work a lead) without LEAD_ASSIGN (reassign
    // ownership), same split the CRM's own permission model implies.
    if (input.assignedUserId !== undefined) {
      await requirePermission(session.user.id, PERMISSIONS.LEAD_ASSIGN);
    }
    if (input.status !== undefined || input.stage !== undefined) {
      const canUpdate = await hasPermission(session.user.id, PERMISSIONS.LEAD_UPDATE);
      if (!canUpdate) throw new ForbiddenError();
    }

    const lead = await updateOutreachLead(params.id, input);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LEAD_UPDATED",
        entityType: "OutreachLead",
        entityId: params.id,
        metadata: input,
      },
    });

    return apiSuccess({ lead });
  } catch (error) {
    if (error instanceof OutreachIntegrationError) return apiError(error.message, 502);
    return handleApiError(error);
  }
}
