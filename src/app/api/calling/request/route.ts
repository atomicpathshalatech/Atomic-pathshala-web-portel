import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { createCallingRequest } from "@/lib/calling/calling-service";
import { z } from "zod";

const requestCallSchema = z.object({
  leadId: z.string().optional(),
  studentId: z.string().optional(),
  studentPhone: z.string().min(10),
  deviceId: z.string().min(1),
  preferredSim: z.enum(["SIM_1", "SIM_2", "DEFAULT"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_UPDATE);

    const body = await req.json();
    const data = requestCallSchema.parse(body);

    const result = await createCallingRequest({
      ...data,
      requestedById: session.user.id,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
