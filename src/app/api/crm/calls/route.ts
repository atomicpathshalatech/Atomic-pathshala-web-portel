import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { logCall } from "@/lib/crm/crm-service";
import { z } from "zod";

const callLogSchema = z.object({
  leadId: z.string().min(1),
  counsellorId: z.string().optional(),
  direction: z.string().optional(),
  durationSeconds: z.number().optional(),
  outcome: z.any(),
  notes: z.string().optional(),
  nextFollowUpAt: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_UPDATE);

    const body = await req.json();
    const data = callLogSchema.parse(body);

    const call = await logCall({
      ...data,
      counsellorId: data.counsellorId || session.user.id,
    });

    return apiSuccess({ call }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
