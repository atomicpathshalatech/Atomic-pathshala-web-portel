import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { scheduleCounselling } from "@/lib/crm/crm-service";
import { prisma } from "@/lib/db";
import { z } from "zod";

const scheduleSchema = z.object({
  leadId: z.string().min(1),
  counsellorId: z.string().optional(),
  scheduledAt: z.string().transform((v) => new Date(v)),
  mode: z.string().optional(),
  meetingLink: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_READ);

    const sessions = await prisma.cRMCounsellingSession.findMany({
      orderBy: { scheduledAt: "desc" },
      take: 50,
      include: {
        lead: {
          select: {
            id: true,
            leadCode: true,
            name: true,
            phone: true,
            email: true,
            targetExam: true,
            studentClass: true,
            status: true,
          },
        },
        counsellor: { select: { id: true, name: true } },
      },
    });

    return apiSuccess({ sessions });
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
    const data = scheduleSchema.parse(body);

    const sessionRecord = await scheduleCounselling({
      ...data,
      counsellorId: data.counsellorId || session.user.id,
    });

    return apiSuccess({ session: sessionRecord }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
