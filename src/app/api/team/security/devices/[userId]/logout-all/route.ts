import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function POST(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_DEVICE_MANAGE);

    const result = await prisma.deviceSession.updateMany({
      where: {
        userId: params.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: "ADMIN_LOGOUT_ALL",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "USER_ALL_DEVICES_LOGGED_OUT",
        entityType: "User",
        entityId: params.userId,
        metadata: { revokedCount: result.count },
      },
    });

    return apiSuccess({ success: true, count: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}
