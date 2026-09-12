import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { lookupPlatformResource } from "@/lib/resources/registry";
import { deleteTestCascading, deleteDppCascading } from "@/lib/team/resource-delete";

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

    // Delete the underlying model FIRST — if this throws, nothing else
    // happens: the registry row is never marked deleted and no
    // "SUCCESS" audit entry is ever written. The old version of this
    // route flipped isDeleted unconditionally, then swallowed any error
    // from the actual delete (a bare `.catch(() => {})`), so an admin
    // would see "permanently deleted" and the resource would vanish from
    // any registry-backed list while the real row (and everything tied to
    // it) was still sitting in the database untouched — exactly the
    // "delete nahi ho raha" symptom this fixes.
    let deletionDetail: { title: string; attemptsDeleted?: number; attemptsOrphaned?: number } | null = null;
    try {
      if (resource.type === "TEST") {
        deletionDetail = await deleteTestCascading(resource.targetId, session.user.id);
      } else if (resource.type === "DPP") {
        deletionDetail = await deleteDppCascading(resource.targetId, session.user.id);
      } else if (resource.type === "QUESTION") {
        await prisma.question.delete({ where: { id: resource.targetId } });
      } else if (resource.type === "LECTURE") {
        await prisma.lecture.delete({ where: { id: resource.targetId } });
      }
    } catch (deleteErr) {
      const reasonMsg =
        deleteErr instanceof Error && deleteErr.message.includes("Foreign key constraint")
          ? "This resource still has records referencing it that couldn't be automatically removed."
          : deleteErr instanceof Error
            ? deleteErr.message
            : "Unknown error";

      await prisma.resourceAuditLog.create({
        data: {
          resourceId: resource.resourceId,
          resourceType: resource.type,
          userId: session.user.id,
          userName: session.user.name || session.user.email,
          action: "DELETE",
          result: "FAILED",
          reason: reasonMsg,
          metadata: { title: resource.title, targetId: resource.targetId },
        },
      });

      return apiError(`Could not delete this resource: ${reasonMsg}`, 500);
    }

    // Underlying model is gone — now mark the registry entry deleted and
    // log success. The Resource ID remains recorded and will NEVER be reused.
    await prisma.platformResource.update({
      where: { resourceId: resource.resourceId },
      data: {
        isDeleted: true,
        deletedAt: now,
        deletedById: session.user.id,
        deletedReason: reason,
      },
    });

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
          ...deletionDetail,
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
