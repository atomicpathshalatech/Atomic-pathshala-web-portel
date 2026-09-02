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

    if (!resourceId) {
      return apiError("Resource ID is required.", 400);
    }

    const resource = await lookupPlatformResource(resourceId);
    if (!resource) {
      return apiError("Resource not found.", 404);
    }

    if (resource.isDeleted) {
      await prisma.resourceAuditLog.create({
        data: {
          resourceId,
          resourceType: resource.type,
          userId: session.user.id,
          userName: session.user.name || session.user.email,
          action: "ATTEMPT_BLOCKED",
          result: "FAILED",
          reason: "Attempted to download a permanently deleted resource.",
        },
      });
      return apiError("This resource has been deleted and cannot be downloaded.", 410);
    }

    // Determine download URL
    let downloadUrl = resource.downloadUrl;
    if (!downloadUrl) {
      if (resource.type === "TEST") {
        downloadUrl = `/api/pdf/test/${resource.targetId}`;
      } else if (resource.type === "DPP") {
        downloadUrl = `/api/pdf/dpp/${resource.targetId}`;
      } else if (resource.type === "QUESTION") {
        downloadUrl = `/api/team/questions/${resource.targetId}`;
      }
    }

    // Write Complete Audit Log
    await prisma.resourceAuditLog.create({
      data: {
        resourceId: resource.resourceId,
        resourceType: resource.type,
        userId: session.user.id,
        userName: session.user.name || session.user.email,
        action: "DOWNLOAD",
        result: "SUCCESS",
        metadata: {
          title: resource.title,
          format: resource.format,
          downloadUrl,
        },
      },
    });

    return apiSuccess({
      resourceId: resource.resourceId,
      title: resource.title,
      type: resource.type,
      format: resource.format,
      downloadUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
