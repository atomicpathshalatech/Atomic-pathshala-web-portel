import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSuperAdminUser } from "@/lib/rbac/guard";
import { isSuperAdmin } from "@/lib/rbac/super-admin";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  simulateEmployee,
  simulateRole,
  compareSimulations,
} from "@/lib/rbac/role-simulator";

async function requireSuperAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  const isSuper =
    (await isSuperAdminUser(session.user.id)) ||
    (await isSuperAdmin(session.user.id)) ||
    (session.user as any)?.role === "ADMIN" ||
    (session.user as any)?.role === "FOUNDER";
  if (!isSuper) {
    throw new Error("FORBIDDEN");
  }
  return session.user;
}

/**
 * GET /api/team/role-preview
 * Returns all active employees and all roles with user counts.
 * Strictly restricted to Super Admin.
 */
export async function GET() {
  try {
    const adminUser = await requireSuperAdminSession();

    const [employees, roles] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: {
            name: { notIn: ["STUDENT", "PARENT", "GUEST"] },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          department: true,
          position: true,
          contractEnd: true,
          subjectScope: true,
          batchScope: true,
          role: {
            select: {
              id: true,
              name: true,
              label: true,
              isSystem: true,
            },
          },
          userPermissionOverrides: {
            select: {
              permissionCode: true,
              granted: true,
              reason: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { name: "asc" }],
      }),
      prisma.role.findMany({
        where: {
          name: { notIn: ["STUDENT", "PARENT", "GUEST"] },
        },
        select: {
          id: true,
          name: true,
          label: true,
          description: true,
          isSystem: true,
          _count: {
            select: { users: true },
          },
        },
        orderBy: [{ isSystem: "desc" }, { label: "asc" }],
      }),
    ]);

    return apiSuccess({
      adminId: adminUser.id,
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name || e.email,
        email: e.email,
        phone: e.phone,
        status: e.status,
        department: e.department || "General",
        position: e.position || e.role?.label || "Staff Member",
        role: e.role,
        contractEnd: e.contractEnd,
        overridesCount: e.userPermissionOverrides.length,
        subjectScope: e.subjectScope,
        batchScope: e.batchScope,
      })),
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        label: r.label,
        description: r.description,
        isSystem: r.isSystem,
        userCount: r._count.users,
      })),
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return apiError("Unauthorized: sign in required", 401);
    }
    if (error.message === "FORBIDDEN") {
      return apiError("Forbidden: only Super Admins can access Role Simulator", 403);
    }
    return handleApiError(error);
  }
}

/**
 * POST /api/team/role-preview
 * Body:
 *   - action: "SIMULATE_EMPLOYEE" | "SIMULATE_ROLE" | "COMPARE"
 *   - userId?: string
 *   - roleName?: string
 *   - compareTarget?: { type: "EMPLOYEE" | "ROLE"; idOrName: string }
 */
export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireSuperAdminSession();
    const body = await request.json();
    const { action, userId, roleName, compareTarget } = body;

    if (action === "SIMULATE_EMPLOYEE") {
      if (!userId) return apiError("User ID is required for employee simulation", 400);

      const simulation = await simulateEmployee(userId);

      // Audit log simulation
      try {
        await prisma.auditLog.create({
          data: {
            userId: adminUser.id,
            action: "ROLE_PREVIEW_OPENED",
            entityType: "ROLE_SIMULATOR",
            entityId: userId,
            metadata: {
              mode: "EMPLOYEE",
              targetUserName: simulation.targetUser.name,
              targetUserRole: simulation.targetUser.roleName,
            },
          },
        });
      } catch {
        // Non-blocking audit log
      }

      return apiSuccess({ simulation });
    }

    if (action === "SIMULATE_ROLE") {
      if (!roleName) return apiError("Role Name is required for role simulation", 400);

      const simulation = await simulateRole(roleName);

      try {
        await prisma.auditLog.create({
          data: {
            userId: adminUser.id,
            action: "ROLE_PREVIEW_OPENED",
            entityType: "ROLE_SIMULATOR",
            entityId: roleName,
            metadata: {
              mode: "ROLE",
              targetRoleName: roleName,
            },
          },
        });
      } catch {
        // Non-blocking audit log
      }

      return apiSuccess({ simulation });
    }

    if (action === "COMPARE") {
      if (!compareTarget || !compareTarget.type || !compareTarget.idOrName) {
        return apiError("Comparison target specification is required", 400);
      }

      // Base simulation (from userId or roleName)
      const baseSimulation = userId
        ? await simulateEmployee(userId)
        : await simulateRole(roleName);

      // Target simulation
      const targetSimulation =
        compareTarget.type === "EMPLOYEE"
          ? await simulateEmployee(compareTarget.idOrName)
          : await simulateRole(compareTarget.idOrName);

      const comparison = compareSimulations(baseSimulation, targetSimulation);

      return apiSuccess({
        baseSimulation,
        targetSimulation,
        comparison,
      });
    }

    return apiError("Invalid action specified", 400);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return apiError("Unauthorized: sign in required", 401);
    }
    if (error.message === "FORBIDDEN") {
      return apiError("Forbidden: only Super Admins can access Role Simulator", 403);
    }
    return handleApiError(error);
  }
}
