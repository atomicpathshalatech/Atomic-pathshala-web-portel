import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { lookupPlatformResource } from "@/lib/resources/registry";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const body = await request.json();
    const resourceId = body.resourceId?.trim().toUpperCase();
    const confirmResourceId = body.confirmResourceId?.trim().toUpperCase();
    const reason = body.reason?.trim() || "User requested deletion";

    if (!resourceId || !confirmResourceId) {
      return apiError("Resource ID and Confirmation ID are required.", 400);
    }

    // STRICT VALIDATION: Deletion requires confirming the exact Resource ID
    if (resourceId !== confirmResourceId) {
      await prisma.resourceAuditLog.create({
        data: {
          resourceId,
          resourceType: "UNKNOWN",
          userId: session.user.id,
          userName: session.user.name || session.user.email,
          action: "ATTEMPT_BLOCKED",
          result: "FAILED",
          reason: `Resource ID mismatch during confirmation (Expected: ${resourceId}, Got: ${confirmResourceId})`,
        },
      });
      return apiError(`Resource ID confirmation mismatch. You must enter exact ID '${resourceId}'.`, 400);
    }

    const resource = await lookupPlatformResource(resourceId);
    if (!resource) {
      return apiError("Resource not found.", 404);
    }

    if (resource.isDeleted) {
      return apiError("This resource is already deleted.", 400);
    }

    const now = new Date();

    // 1. Mark resource permanently deleted in PlatformResource registry
    // The Resource ID remains recorded and will NEVER be reused!
    await prisma.platformResource.update({
      where: { resourceId: resource.resourceId },
      data: {
        isDeleted: true,
        deletedAt: now,
        deletedById: session.user.id,
        deletedReason: reason,
      },
    });

    // 2. Cascade delete underlying model
    try {
      if (resource.type === "TEST") {
        await prisma.test.delete({ where: { id: resource.targetId } }).catch(() => {});
      } else if (resource.type === "DPP") {
        await prisma.dpp.delete({ where: { id: resource.targetId } }).catch(() => {});
      } else if (resource.type === "QUESTION") {
        await prisma.question.delete({ where: { id: resource.targetId } }).catch(() => {});
      } else if (resource.type === "LECTURE") {
        await prisma.chapterLecture.delete({ where: { id: resource.targetId } }).catch(() => {});
      }
    } catch {
      // Ignore if already deleted
    }

    // 3. Write Complete Audit Log
    await prisma.resourceAuditLog.create({
      data: {
        resourceId: resource.resourceId,
        resourceType: resource.type,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        action: "DELETE",
        result: "SUCCESS",
        reason,
        metadata: {
          title: resource.title,
          targetId: resource.targetId,
        },
      },
    });

    return apiSuccess({
      deleted: true,
      resourceId: resource.resourceId,
      message: `Resource '${resource.resourceId}' has been permanently deleted.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
