import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { assignCallingDevice } from "@/lib/calling/calling-service";
import { z } from "zod";

const assignSchema = z.object({
  userId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_ASSIGN);

    const body = await req.json();
    const data = assignSchema.parse(body);

    const updated = await assignCallingDevice(params.id, data.userId, session.user.id);
    return apiSuccess({ device: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
