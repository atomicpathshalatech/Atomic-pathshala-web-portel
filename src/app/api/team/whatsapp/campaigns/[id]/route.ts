import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_READ);

    const campaign = await prisma.whatsAppCampaign.findUnique({
      where: { id: params.id },
      include: {
        batch: true,
        createdBy: { select: { id: true, name: true, email: true } },
        recipients: {
          take: 100,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!campaign) {
      return apiError("Campaign not found", 404);
    }

    return apiSuccess({ campaign });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_CAMPAIGN_MANAGE);

    const body = await req.json();
    const { status, name, description } = body;

    const campaign = await prisma.whatsAppCampaign.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });

    return apiSuccess({ campaign });
  } catch (error) {
    return handleApiError(error);
  }
}
