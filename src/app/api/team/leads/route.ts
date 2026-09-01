import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getOutreachLeads, getOutreachUsers, OutreachIntegrationError } from "@/lib/integrations/outreach-leads";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Deliberately a live proxy, not a local Lead table — atomic-outreach-
 * system is the CRM of record (see Phase 5 integration). This just gives
 * the Team Portal a management view over it instead of duplicating data.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_READ);

    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const [leads, counselors] = await Promise.all([getOutreachLeads(status), getOutreachUsers()]);

    return apiSuccess({ leads, counselors });
  } catch (error) {
    if (error instanceof OutreachIntegrationError) return apiError(error.message, 502);
    return handleApiError(error);
  }
}
