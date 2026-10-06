import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_CAMPAIGN_MANAGE);

    const body = await req.json();
    const { targetBatchId, targetTags } = body;

    const where: any = { status: "ACTIVE" };
    if (targetBatchId) where.batchId = targetBatchId;
    if (Array.isArray(targetTags) && targetTags.length > 0) {
      where.tags = { hasSome: targetTags };
    }

    const [totalAudience, sampleContacts] = await Promise.all([
      prisma.whatsAppContact.count({ where }),
      prisma.whatsAppContact.findMany({
        where,
        take: 10,
        select: {
          id: true,
          name: true,
          phone: true,
          tags: true,
          batch: { select: { name: true } },
        },
      }),
    ]);

    return apiSuccess({
      totalAudience,
      sampleContacts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
