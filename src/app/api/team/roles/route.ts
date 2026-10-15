import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS, ROLE_PERMISSION_DEFAULTS, PermissionCode, VALID_GLOBAL_ROLES } from "@/lib/rbac/permissions";

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
    const { action, roleName, label, description } = body;
    // Only permissions from the catalogue (src/lib/rbac/permissions.ts) can be granted.
    const known = new Set<string>(Object.values(PERMISSIONS));
    const requested: unknown[] = Array.isArray(body.permissions) ? body.permissions : [];
    const unknownCodes = requested.filter((c) => typeof c !== "string" || !known.has(c));
    if (unknownCodes.length > 0) {
      return NextResponse.json({ error: `Unknown permission: ${String(unknownCodes[0])}` }, { status: 400 });
    }
    const permissions = Array.from(new Set(requested as string[]));
    // The catalogue's permissions exist in the database once used (no seed run needed).
    const permissionIdsFor = async (codes: string[]) => {
      const ids: string[] = [];
      for (const code of codes) {
        const perm = await prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code, module: code.split(".")[0]!, description: code },
          select: { id: true },
        });
        ids.push(perm.id);
      }
      return ids;
    };

    if (action === "CREATE_ROLE") {
      // Role names are a fixed list in the database (enum GlobalRole); any other
      // name used to fail with a server error.
      if (!(VALID_GLOBAL_ROLES as readonly string[]).includes(roleName)) {
        return NextResponse.json(
          { error: `A role must be one of: ${VALID_GLOBAL_ROLES.join(", ")}. A new role name needs a database change first.` },
          { status: 400 }
        );
      }
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
      const newIds = await permissionIdsFor(permissions);
      if (newIds.length) await prisma.rolePermission.createMany({ data: newIds.map((permissionId) => ({ roleId: newRole.id, permissionId })) });

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

      // Replace the role's permissions in one step: a failure half-way used to
      // leave the role with only some (or none) of its permissions.
      const ids = await permissionIdsFor(permissions);
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
        prisma.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: role.id, permissionId })) }),
      ]);

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
