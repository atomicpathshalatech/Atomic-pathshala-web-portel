import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canOverride = await hasPermission(session.user.id, PERMISSIONS.USER_PERMISSION_OVERRIDE);
    if (!canOverride) {
      return NextResponse.json({ error: "Forbidden: Super Admin permission required to override permissions" }, { status: 403 });
    }

    const userId = params.id;
    const body = await req.json();
    const { permissionCode, granted, reason, action } = body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "RESET") {
      // Remove specific override to revert to default role permission
      await prisma.userPermissionOverride.deleteMany({
        where: {
          userId,
          permissionCode,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PERMISSION_OVERRIDE_RESET",
          entityType: "USER_PERMISSION",
          entityId: userId,
          metadata: {
            targetUserName: user.name,
            permissionCode,
            reason: reason || "Reverted to role default",
          },
        },
      });

      return NextResponse.json({ success: true, message: "Override reset to role default" });
    }

    // Add or update override
    const override = await prisma.userPermissionOverride.upsert({
      where: {
        userId_permissionCode: {
          userId,
          permissionCode,
        },
      },
      create: {
        userId,
        permissionCode,
        granted: Boolean(granted),
        reason: reason || null,
        grantedById: session.user.id,
      },
      update: {
        granted: Boolean(granted),
        reason: reason || null,
        grantedById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: granted ? "PERMISSION_OVERRIDE_GRANTED" : "PERMISSION_OVERRIDE_DENIED",
        entityType: "USER_PERMISSION",
        entityId: userId,
        metadata: {
          targetUserName: user.name,
          permissionCode,
          granted: Boolean(granted),
          reason,
        },
      },
    });

    return NextResponse.json({ success: true, override });
  } catch (error: any) {
    console.error("Error in POST /api/team/users/[id]/permissions:", error);
    return NextResponse.json({ error: error.message || "Failed to update permission override" }, { status: 500 });
  }
}
