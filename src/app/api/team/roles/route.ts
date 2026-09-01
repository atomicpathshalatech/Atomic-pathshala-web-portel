import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS, ROLE_PERMISSION_DEFAULTS, PermissionCode } from "@/lib/rbac/permissions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canRead = await hasPermission(session.user.id, PERMISSIONS.ROLE_MANAGE);
    if (!canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedRoles = roles.map((r) => {
      let permissionCodes: string[] = r.permissions.map((p) => p.permission.code);
      if (permissionCodes.length === 0 && ROLE_PERMISSION_DEFAULTS[r.name]) {
        permissionCodes = [...(ROLE_PERMISSION_DEFAULTS[r.name] || [])];
      }

      return {
        id: r.id,
        name: r.name,
        label: r.label,
        description: r.description,
        isSystem: r.isSystem,
        usersCount: r._count.users,
        permissions: permissionCodes,
      };
    });

    return NextResponse.json({
      roles: formattedRoles,
      allPermissions: Object.entries(PERMISSIONS).map(([key, code]) => ({
        key,
        code,
        module: code.split(".")[0],
        action: code.split(".")[1] || "action",
      })),
    });
  } catch (error: any) {
    console.error("Error in GET /api/team/roles:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canManage = await hasPermission(session.user.id, PERMISSIONS.ROLE_MANAGE);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { action, roleName, label, description, permissions = [] } = body;

    if (action === "CREATE_ROLE") {
      const existing = await prisma.role.findUnique({ where: { name: roleName } });
      if (existing) {
        return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
      }

      const newRole = await prisma.role.create({
        data: {
          name: roleName,
          label: label || roleName.replace(/_/g, " "),
          description: description || null,
          isSystem: false,
        },
      });

      // Attach permissions
      for (const code of permissions) {
        let perm = await prisma.permission.findUnique({ where: { code } });
        if (!perm) {
          perm = await prisma.permission.create({
            data: {
              code,
              module: code.split(".")[0],
              description: code,
            },
          });
        }

        await prisma.rolePermission.create({
          data: {
            roleId: newRole.id,
            permissionId: perm.id,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ROLE_CREATED",
          entityType: "ROLE",
          entityId: newRole.id,
          metadata: { roleName, label, permissionsCount: permissions.length },
        },
      });

      return NextResponse.json({ success: true, role: newRole });
    }

    if (action === "UPDATE_PERMISSIONS") {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        return NextResponse.json({ error: "Role not found" }, { status: 404 });
      }

      // Delete existing role permissions
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

      // Add new permissions
      for (const code of permissions) {
        let perm = await prisma.permission.findUnique({ where: { code } });
        if (!perm) {
          perm = await prisma.permission.create({
            data: {
              code,
              module: code.split(".")[0],
              description: code,
            },
          });
        }

        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ROLE_PERMISSIONS_UPDATED",
          entityType: "ROLE",
          entityId: role.id,
          metadata: { roleName, newPermissionsCount: permissions.length },
        },
      });

      return NextResponse.json({ success: true, message: "Permissions updated successfully" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in POST /api/team/roles:", error);
    return NextResponse.json({ error: error.message || "Failed to update roles" }, { status: 500 });
  }
}
