import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { mergeLeads } from "@/lib/crm/crm-service";
import { z } from "zod";

const mergeSchema = z.object({
  primaryLeadId: z.string().min(1),
  duplicateLeadId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_UPDATE);

    const body = await req.json();
    const { primaryLeadId, duplicateLeadId } = mergeSchema.parse(body);

    const result = await mergeLeads(primaryLeadId, duplicateLeadId, session.user.id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
