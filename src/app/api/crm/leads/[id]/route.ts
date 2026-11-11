import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getLeadById, updateLead } from "@/lib/crm/crm-service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_READ);

    const lead = await getLeadById(params.id);
    if (!lead) return apiError("Lead not found", 404);

    return apiSuccess({ lead });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_UPDATE);

    const body = await req.json();
    const updated = await updateLead(params.id, body, session.user.id);

    return apiSuccess({ lead: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
