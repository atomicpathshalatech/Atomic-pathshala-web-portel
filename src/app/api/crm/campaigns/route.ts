import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { z } from "zod";

const campaignSchema = z.object({
  name: z.string().min(2),
  campaignCode: z.string().min(2),
  platform: z.any().optional(),
  budget: z.number().optional(),
  spend: z.number().optional(),
  targetAudience: z.string().optional(),
  targetCourseId: z.string().optional(),
  utmSource: z.string().optional(),
  utmCampaign: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_READ);

    const campaigns = await prisma.cRMCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { leads: true } },
      },
    });

    const enriched = campaigns.map((c) => ({
      ...c,
      leadsCount: c._count.leads,
      cpl: c._count.leads > 0 ? Math.round(c.spend / c._count.leads) : 0,
    }));

    return apiSuccess({ campaigns: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_CREATE);

    const body = await req.json();
    const data = campaignSchema.parse(body);

    const campaign = await prisma.cRMCampaign.create({
      data: {
        name: data.name,
        campaignCode: data.campaignCode,
        platform: data.platform || "META",
        budget: data.budget || 0,
        spend: data.spend || 0,
        targetAudience: data.targetAudience,
        targetCourseId: data.targetCourseId,
        utmSource: data.utmSource,
        utmCampaign: data.utmCampaign,
        notes: data.notes,
      },
    });

    return apiSuccess({ campaign }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
