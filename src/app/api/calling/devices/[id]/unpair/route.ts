import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { unpairCallingDevice } from "@/lib/calling/calling-service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_READ);

    const result = await unpairCallingDevice(params.id);
    return apiSuccess(result);
  } catch (error: any) {
    console.error("[API_DEVICE_UNPAIR_ERROR]", error);
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return handleApiError(error);
    }
    return apiError(error.message || "Failed to unpair device", 400);
  }
}
