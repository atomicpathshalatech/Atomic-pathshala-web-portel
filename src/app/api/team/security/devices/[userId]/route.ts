import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_DEVICE_MANAGE);

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        allowedDeviceTypes: true,
        maxActiveDevices: true,
        role: { select: { name: true, label: true } },
      },
    });

    if (!user) return apiError("User not found", 404);

    const sessions = await prisma.deviceSession.findMany({
      where: { userId: params.userId },
      orderBy: { lastActiveAt: "desc" },
    });

    return apiSuccess({ user, sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_DEVICE_MANAGE);

    const body = await request.json();
    const { allowedDeviceTypes, maxActiveDevices } = body;

    const updated = await prisma.user.update({
      where: { id: params.userId },
      data: {
        ...(Array.isArray(allowedDeviceTypes) ? { allowedDeviceTypes } : {}),
        ...(typeof maxActiveDevices === "number" ? { maxActiveDevices } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        allowedDeviceTypes: true,
        maxActiveDevices: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "USER_DEVICE_POLICY_UPDATED",
        entityType: "User",
        entityId: params.userId,
        metadata: { allowedDeviceTypes, maxActiveDevices },
      },
    });

    return apiSuccess({ user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
