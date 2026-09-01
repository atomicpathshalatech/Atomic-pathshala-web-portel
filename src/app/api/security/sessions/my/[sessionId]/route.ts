import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Self-service "log out this device" — revokes one of the caller's own
 * DeviceSession rows. If it happens to be the session making this very
 * request, that's fine: the session callback re-checks validity on the
 * next request from that device and signs it out naturally, no special
 * handling needed here.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const target = await prisma.deviceSession.findUnique({ where: { id: params.sessionId } });
    if (!target) return apiError("Session not found", 404);
    if (target.userId !== session.user.id) throw new ForbiddenError();

    if (target.revokedAt) return apiSuccess({ revoked: true });

    await prisma.deviceSession.update({
      where: { id: params.sessionId },
      data: { revokedAt: new Date(), revokedReason: "USER_REVOKED" },
    });

    return apiSuccess({ revoked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
