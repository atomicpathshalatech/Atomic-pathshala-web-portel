import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { assignLeads } from "@/lib/crm/crm-service";
import { z } from "zod";

const assignSchema = z.object({
  leadIds: z.array(z.string()).min(1, "Select at least one lead"),
  assignedUserId: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_ASSIGN);

    const body = await req.json();
    const { leadIds, assignedUserId } = assignSchema.parse(body);

    const result = await assignLeads(leadIds, assignedUserId, session.user.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
