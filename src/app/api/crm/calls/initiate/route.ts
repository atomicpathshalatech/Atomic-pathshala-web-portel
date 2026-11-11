import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { CRMActivityType } from "@prisma/client";
import { z } from "zod";

const initiateCallSchema = z.object({
  leadId: z.string().min(1),
  virtualLine: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_UPDATE);

    const body = await req.json();
    const data = initiateCallSchema.parse(body);

    const lead = await prisma.cRMLead.findUnique({
      where: { id: data.leadId },
      select: { id: true, name: true, phone: true, cleanPhone: true },
    });

    if (!lead) {
      return handleApiError(new Error("Lead not found"));
    }

    const virtualLine = data.virtualLine || "+91 80 6902 4400";
    const callSessionId = `VIRT-CALL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    // Log outbound call initiation in lead activity history
    await prisma.cRMLeadActivity.create({
      data: {
        leadId: lead.id,
        type: CRMActivityType.CALL_LOGGED,
        title: `Outbound Virtual Call initiated via ${virtualLine}`,
        description: `Counsellor initiated masked telecalling bridge to student ${lead.phone}. Counsellor personal number hidden.`,
        performedById: session.user.id,
      },
    });

    return apiSuccess({
      callSessionId,
      virtualLine,
      studentPhone: lead.phone,
      studentName: lead.name,
      status: "INITIATED",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
