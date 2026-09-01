import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { securityConfigUpdateSchema } from "@/lib/validation/security";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_CONFIG_MANAGE);

    const config = await prisma.securityConfig.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });

    return apiSuccess({ config });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.SECURITY_CONFIG_MANAGE);

    const data = securityConfigUpdateSchema.parse(await request.json());

    const config = await prisma.securityConfig.upsert({
      where: { id: "singleton" },
      update: { policy: data.policy },
      create: { id: "singleton", policy: data.policy },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SECURITY_CONFIG_UPDATED",
        entityType: "SecurityConfig",
        entityId: "singleton",
        metadata: { policy: data.policy },
      },
    });

    return apiSuccess({ config });
  } catch (error) {
    return handleApiError(error);
  }
}
