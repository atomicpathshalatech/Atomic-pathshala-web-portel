import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Admin force-revoke of any user's device session (e.g. a compromised
 * account, or a device the account owner reports lost). */
export async function DELETE(_request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.SECURITY_DEVICE_MANAGE);

    const target = await prisma.deviceSession.findUnique({ where: { id: params.sessionId } });
    if (!target) return apiError("Session not found", 404);

    if (!target.revokedAt) {
      await prisma.deviceSession.update({
        where: { id: params.sessionId },
        data: { revokedAt: new Date(), revokedReason: "ADMIN_REVOKED" },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DEVICE_SESSION_ADMIN_REVOKED",
          entityType: "DeviceSession",
          entityId: params.sessionId,
          metadata: { targetUserId: target.userId },
        },
      });
    }

    return apiSuccess({ revoked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
