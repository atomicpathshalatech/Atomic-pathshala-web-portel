import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

// Logout / revoke device session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_DEVICE_MANAGE);

    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("remove") === "true";

    const target = await prisma.deviceSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!target) return apiError("Session not found", 404);

    if (hardDelete) {
      await prisma.deviceSession.delete({
        where: { id: params.sessionId },
      });
      return apiSuccess({ removed: true });
    }

    await prisma.deviceSession.update({
      where: { id: params.sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: "ADMIN_REVOKED",
      },
    });

    return apiSuccess({ revoked: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// Block / Allow device
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_DEVICE_MANAGE);

    const body = await request.json();
    const { action } = body; // "BLOCK" | "ALLOW"

    const target = await prisma.deviceSession.findUnique({
      where: { id: params.sessionId },
    });
    if (!target) return apiError("Session not found", 404);

    if (action === "BLOCK") {
      const updated = await prisma.deviceSession.update({
        where: { id: params.sessionId },
        data: {
          isBlocked: true,
          revokedAt: target.revokedAt || new Date(),
          revokedReason: "ADMIN_BLOCKED",
        },
      });
      return apiSuccess({ success: true, session: updated });
    } else if (action === "ALLOW") {
      const updated = await prisma.deviceSession.update({
        where: { id: params.sessionId },
        data: {
          isBlocked: false,
          revokedAt: null,
          revokedReason: null,
        },
      });
      return apiSuccess({ success: true, session: updated });
    }

    return apiError("Invalid action. Must be BLOCK or ALLOW", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
