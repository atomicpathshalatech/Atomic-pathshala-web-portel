import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS, ROLE_PERMISSION_DEFAULTS, PermissionCode } from "@/lib/rbac/permissions";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canRead = await hasPermission(session.user.id, PERMISSIONS.USER_READ);
    if (!canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = params.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        teacher: true,
        userPermissionOverrides: true,
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate effective permissions
    const rolePermissionCodes = new Set<string>(
      user.role.permissions.map((p) => p.permission.code)
    );

    // Fallback to static defaults if DB role_permissions is empty
    const defaults = ROLE_PERMISSION_DEFAULTS[user.role.name];
    if (rolePermissionCodes.size === 0 && defaults) {
      defaults.forEach((c) => rolePermissionCodes.add(c));
    }

    const overridesMap: Record<string, boolean> = {};
    user.userPermissionOverrides.forEach((o) => {
      overridesMap[o.permissionCode] = o.granted;
    });

    const effectivePermissions: Record<string, boolean> = {};
    Object.values(PERMISSIONS).forEach((permCode) => {
      if (overridesMap[permCode] !== undefined) {
        effectivePermissions[permCode] = overridesMap[permCode];
      } else if (user.role.name === "SUPER_ADMIN" || user.role.name === "FOUNDER") {
        effectivePermissions[permCode] = true;
      } else {
        effectivePermissions[permCode] = rolePermissionCodes.has(permCode);
      }
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photoUrl: user.photoUrl,
        status: user.status,
        role: user.role.name,
        roleLabel: user.role.label,
        department: user.department,
        position: user.position,
        subjectScope: user.subjectScope,
        batchScope: user.batchScope,
        contractType: user.contractType,
        contractStart: user.contractStart,
        contractEnd: user.contractEnd,
        contractNote: user.contractNote,
        reportingManagerId: user.reportingManagerId,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        overrides: user.userPermissionOverrides,
        effectivePermissions,
        auditLogs: user.auditLogs,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/team/users/[id]:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canUpdate = await hasPermission(session.user.id, PERMISSIONS.USER_UPDATE);
    if (!canUpdate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = params.id;
    const body = await req.json();

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};
    const auditChanges: Record<string, { old: any; new: any }> = {};

    if (body.name !== undefined && body.name !== currentUser.name) {
      updateData.name = body.name;
      auditChanges.name = { old: currentUser.name, new: body.name };
    }

    if (body.phone !== undefined && body.phone !== currentUser.phone) {
      updateData.phone = body.phone;
      auditChanges.phone = { old: currentUser.phone, new: body.phone };
    }

    if (body.status !== undefined && body.status !== currentUser.status) {
      updateData.status = body.status;
      auditChanges.status = { old: currentUser.status, new: body.status };
    }

    if (body.department !== undefined && body.department !== currentUser.department) {
      updateData.department = body.department;
      auditChanges.department = { old: currentUser.department, new: body.department };
    }

    if (body.position !== undefined && body.position !== currentUser.position) {
      updateData.position = body.position;
      auditChanges.position = { old: currentUser.position, new: body.position };
    }

    if (body.contractType !== undefined && body.contractType !== currentUser.contractType) {
      updateData.contractType = body.contractType;
      auditChanges.contractType = { old: currentUser.contractType, new: body.contractType };
    }

    if (body.contractStart !== undefined) {
      updateData.contractStart = body.contractStart ? new Date(body.contractStart) : null;
    }

    if (body.contractEnd !== undefined) {
      updateData.contractEnd = body.contractEnd ? new Date(body.contractEnd) : null;
      auditChanges.contractEnd = { old: currentUser.contractEnd, new: body.contractEnd };
    }

    if (body.contractNote !== undefined) {
      updateData.contractNote = body.contractNote;
    }

    if (body.subjectScope !== undefined) {
      updateData.subjectScope = body.subjectScope;
      auditChanges.subjectScope = { old: currentUser.subjectScope, new: body.subjectScope };
    }

    if (body.batchScope !== undefined) {
      updateData.batchScope = body.batchScope;
      auditChanges.batchScope = { old: currentUser.batchScope, new: body.batchScope };
    }

    // Role Change
    if (body.roleName && body.roleName !== currentUser.role.name) {
      let newRole = await prisma.role.findUnique({ where: { name: body.roleName } });
      if (!newRole) {
        newRole = await prisma.role.create({
          data: {
            name: body.roleName,
            label: body.roleName.replace(/_/g, " "),
            isSystem: true,
          },
        });
      }
      updateData.roleId = newRole.id;
      auditChanges.role = { old: currentUser.role.name, new: body.roleName };
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { role: true },
    });

    // Write Audit Log if any changes occurred
    if (Object.keys(auditChanges).length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "USER_UPDATED",
          entityType: "USER",
          entityId: userId,
          metadata: {
            targetUserName: updatedUser.name,
            changes: auditChanges,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        status: updatedUser.status,
        role: updatedUser.role.name,
        department: updatedUser.department,
        position: updatedUser.position,
      },
    });
  } catch (error: any) {
    console.error("Error in PATCH /api/team/users/[id]:", error);
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canDelete = await hasPermission(session.user.id, PERMISSIONS.USER_DELETE);
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = params.id;

    // Safety rule: Soft deactivate user to preserve all tests, questions, audits, and history
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: "INACTIVE" },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "USER_DEACTIVATED",
        entityType: "USER",
        entityId: userId,
        metadata: {
          targetUserName: user.name,
          targetUserEmail: user.email,
        },
      },
    });

    return NextResponse.json({ success: true, message: "User deactivated successfully" });
  } catch (error: any) {
    console.error("Error in DELETE /api/team/users/[id]:", error);
    return NextResponse.json({ error: error.message || "Failed to deactivate user" }, { status: 500 });
  }
}
