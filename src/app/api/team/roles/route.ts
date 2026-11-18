import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS, ROLE_PERMISSION_DEFAULTS } from "@/lib/rbac/permissions";

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
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            photoUrl: true,
            department: true,
            position: true,
          },
          take: 100,
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Also get all active/invited staff users for quick assignment
    const assignableUsers = await prisma.user.findMany({
      where: {
        status: { in: ["ACTIVE", "INVITED", "PENDING_VERIFICATION", "APPROVAL_PENDING"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        photoUrl: true,
        department: true,
        position: true,
        role: {
          select: {
            id: true,
            name: true,
            label: true,
          },
        },
      },
      orderBy: { name: "asc" },
      take: 200,
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
        users: r.users,
        permissions: permissionCodes,
      };
    });

    return NextResponse.json({
      roles: formattedRoles,
      assignableUsers,
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
    const { action, roleName, label, description, userId, targetRoleName, sourceRoleName } = body;

    // Helper to ensure permissions exist in DB and return their IDs
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

    // 1. CREATE_ROLE
    if (action === "CREATE_ROLE") {
      if (!roleName || typeof roleName !== "string") {
        return NextResponse.json({ error: "Role identifier (unique code) is required." }, { status: 400 });
      }

      const cleanRoleName = roleName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      if (!cleanRoleName) {
        return NextResponse.json({ error: "Invalid role identifier." }, { status: 400 });
      }

      // Check if role code already exists
      const existing = await prisma.role.findUnique({ where: { name: cleanRoleName as any } });
      if (existing) {
        return NextResponse.json({ error: `Role '${cleanRoleName}' already exists.` }, { status: 409 });
      }

      // Ensure the PostgreSQL enum contains this role value
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TYPE "GlobalRole" ADD VALUE IF NOT EXISTS '${cleanRoleName}';`
        );
      } catch (alterErr) {
        console.warn("Notice on ALTER TYPE GlobalRole:", alterErr);
      }

      // Validate requested permissions from catalogue
      const known = new Set<string>(Object.values(PERMISSIONS));
      const requested: unknown[] = Array.isArray(body.permissions) ? body.permissions : [];
      const permissions = Array.from(
        new Set((requested as string[]).filter((c) => typeof c === "string" && known.has(c)))
      );

      const newRole = await prisma.role.create({
        data: {
          name: cleanRoleName as any,
          label: label?.trim() || cleanRoleName.replace(/_/g, " "),
          description: description?.trim() || null,
          isSystem: false,
        },
      });

      // Attach permissions
      const newIds = await permissionIdsFor(permissions);
      if (newIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: newIds.map((permissionId) => ({ roleId: newRole.id, permissionId })),
          skipDuplicates: true,
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ROLE_CREATED",
          entityType: "ROLE",
          entityId: newRole.id,
          metadata: { roleName: cleanRoleName, label: newRole.label, permissionsCount: permissions.length },
        },
      });

      return NextResponse.json({ success: true, role: newRole });
    }

    // 2. UPDATE_ROLE (Edit role name / display label / description)
    if (action === "UPDATE_ROLE") {
      if (!roleName) {
        return NextResponse.json({ error: "Role name is required." }, { status: 400 });
      }

      const role = await prisma.role.findUnique({ where: { name: roleName as any } });
      if (!role) {
        return NextResponse.json({ error: "Role not found." }, { status: 404 });
      }

      const updated = await prisma.role.update({
        where: { id: role.id },
        data: {
          label: label?.trim() || role.label,
          description: description !== undefined ? description?.trim() || null : role.description,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ROLE_DETAILS_UPDATED",
          entityType: "ROLE",
          entityId: role.id,
          metadata: { roleName, oldLabel: role.label, newLabel: updated.label },
        },
      });

      return NextResponse.json({ success: true, role: updated });
    }

    // 3. CLONE_ROLE (Clone an existing role with all its permissions)
    if (action === "CLONE_ROLE") {
      const srcName = sourceRoleName || roleName;
      if (!srcName || !targetRoleName) {
        return NextResponse.json({ error: "Source and target role names are required." }, { status: 400 });
      }

      const cleanTargetName = targetRoleName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      const existing = await prisma.role.findUnique({ where: { name: cleanTargetName as any } });
      if (existing) {
        return NextResponse.json({ error: `Role '${cleanTargetName}' already exists.` }, { status: 409 });
      }

      // Fetch source permissions
      const sourceRole = await prisma.role.findUnique({
        where: { name: srcName as any },
        include: { permissions: { include: { permission: true } } },
      });

      let permissionsToCopy: string[] = [];
      if (sourceRole && sourceRole.permissions.length > 0) {
        permissionsToCopy = sourceRole.permissions.map((p) => p.permission.code);
      } else if (ROLE_PERMISSION_DEFAULTS[srcName]) {
        permissionsToCopy = [...ROLE_PERMISSION_DEFAULTS[srcName]];
      }

      // Add to PostgreSQL enum
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TYPE "GlobalRole" ADD VALUE IF NOT EXISTS '${cleanTargetName}';`
        );
      } catch (alterErr) {
        console.warn("Notice on ALTER TYPE GlobalRole:", alterErr);
      }

      const clonedRole = await prisma.role.create({
        data: {
          name: cleanTargetName as any,
          label: label?.trim() || cleanTargetName.replace(/_/g, " "),
          description: description?.trim() || `Cloned from ${srcName}`,
          isSystem: false,
        },
      });

      const permIds = await permissionIdsFor(permissionsToCopy);
      if (permIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: permIds.map((permissionId) => ({ roleId: clonedRole.id, permissionId })),
          skipDuplicates: true,
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "ROLE_CLONED",
          entityType: "ROLE",
          entityId: clonedRole.id,
          metadata: { source: srcName, target: cleanTargetName, permissionsCount: permIds.length },
        },
      });

      return NextResponse.json({ success: true, role: clonedRole });
    }

    // 4. UPDATE_PERMISSIONS (Save all permissions for a role)
    if (action === "UPDATE_PERMISSIONS") {
      const role = await prisma.role.findUnique({ where: { name: roleName as any } });
      if (!role) {
        return NextResponse.json({ error: "Role not found." }, { status: 404 });
      }

      const known = new Set<string>(Object.values(PERMISSIONS));
      const requested: unknown[] = Array.isArray(body.permissions) ? body.permissions : [];
      const permissions = Array.from(
        new Set((requested as string[]).filter((c) => typeof c === "string" && known.has(c)))
      );

      const ids = await permissionIdsFor(permissions);
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
        prisma.rolePermission.createMany({
          data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
          skipDuplicates: true,
        }),
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

      return NextResponse.json({ success: true, message: "Permissions updated successfully." });
    }

    // 5. ASSIGN_USER_ROLE / REMOVE_USER_ROLE (Assign user to role or revoke access immediately)
    if (action === "ASSIGN_USER_ROLE" || action === "REMOVE_USER_ROLE") {
      if (!userId) {
        return NextResponse.json({ error: "Target userId is required." }, { status: 400 });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: { select: { id: true, name: true } } },
      });

      if (!targetUser) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }

      // If removing role or setting roleName to NONE / null => revoke access immediately
      if (action === "REMOVE_USER_ROLE" || !roleName || roleName === "NONE") {
        await prisma.user.update({
          where: { id: userId },
          data: { roleId: null },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "USER_ROLE_REVOKED",
            entityType: "USER",
            entityId: userId,
            metadata: {
              targetUserName: targetUser.name,
              targetUserEmail: targetUser.email,
              previousRole: targetUser.role?.name || null,
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: `Role removed from ${targetUser.name}. Staff access revoked immediately.`,
        });
      }

      // Assigning new role
      const roleToAssign = await prisma.role.findUnique({ where: { name: roleName as any } });
      if (!roleToAssign) {
        return NextResponse.json({ error: `Role '${roleName}' not found.` }, { status: 404 });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { roleId: roleToAssign.id },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "USER_ROLE_ASSIGNED",
          entityType: "USER",
          entityId: userId,
          metadata: {
            targetUserName: targetUser.name,
            targetUserEmail: targetUser.email,
            previousRole: targetUser.role?.name || null,
            newRole: roleToAssign.name,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `${targetUser.name} has been assigned role '${roleToAssign.label}'. Access updated immediately.`,
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("Error in POST /api/team/roles:", error);
    return NextResponse.json({ error: error.message || "Failed to update roles" }, { status: 500 });
  }
}
