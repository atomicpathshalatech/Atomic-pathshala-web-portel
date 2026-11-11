import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getFollowUps } from "@/lib/crm/crm-service";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createFollowUpSchema = z.object({
  leadId: z.string().min(1),
  counsellorId: z.string().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  type: z.any().optional(),
  priority: z.any().optional(),
  scheduledAt: z.string().transform((v) => new Date(v)),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_READ);

    const searchParams = req.nextUrl.searchParams;
    const counsellorId = searchParams.get("counsellorId") || undefined;
    const dateFilter = (searchParams.get("dateFilter") as any) || "all";
    const status = (searchParams.get("status") as any) || undefined;

    const followUps = await getFollowUps({ counsellorId, dateFilter, status });
    return apiSuccess({ followUps });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_UPDATE);

    const body = await req.json();
    const data = createFollowUpSchema.parse(body);

    const followUp = await prisma.cRMLeadFollowUp.create({
      data: {
        leadId: data.leadId,
        counsellorId: data.counsellorId || session.user.id,
        title: data.title,
        description: data.description,
        type: data.type || "PHONE_CALL",
        priority: data.priority || "WARM",
        scheduledAt: data.scheduledAt,
      },
    });

    await prisma.cRMLead.update({
      where: { id: data.leadId },
      data: { nextFollowUpAt: data.scheduledAt },
    });

    return apiSuccess({ followUp }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
