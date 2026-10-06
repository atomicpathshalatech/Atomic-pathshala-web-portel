import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_READ);

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");

    const campaigns = await prisma.whatsAppCampaign.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        batch: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ campaigns });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_CAMPAIGN_MANAGE);

    const body = await req.json();
    const { name, description, templateName, templateParams, targetBatchId, targetTags, scheduledAt } = body;

    if (!name || !templateName) {
      return apiError("Campaign name and template name are required", 400);
    }

    // Query audience count
    const where: any = { status: "ACTIVE" };
    if (targetBatchId) where.batchId = targetBatchId;
    if (Array.isArray(targetTags) && targetTags.length > 0) {
      where.tags = { hasSome: targetTags };
    }

    const totalAudience = await prisma.whatsAppContact.count({ where });

    const campaign = await prisma.whatsAppCampaign.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        templateName: templateName.trim(),
        templateParams: templateParams || {},
        targetBatchId: targetBatchId || null,
        targetTags: Array.isArray(targetTags) ? targetTags : [],
        totalAudience,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdById: session.user.id,
      },
      include: {
        batch: { select: { id: true, name: true } },
      },
    });

    return apiSuccess({ campaign }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
