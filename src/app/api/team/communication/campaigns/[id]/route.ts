import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — a campaign plus its live delivery breakdown by status (spec section 12: "open a campaign and see delivery statistics"). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: params.id },
      include: { createdBy: { select: { name: true } }, template: { select: { name: true } } },
    });
    if (!campaign) return apiError("Campaign not found.", 404);

    const byStatus = await prisma.emailLog.groupBy({
      by: ["status"],
      where: { campaignId: params.id },
      _count: true,
    });

    return apiSuccess({
      campaign,
      breakdown: Object.fromEntries(byStatus.map((b) => [b.status, b._count])),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
