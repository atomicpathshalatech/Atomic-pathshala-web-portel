import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api/response";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

/**
 * Opens an uploaded file (e.g. a lecture's notes PDF) in the browser: a
 * stable link that can be stored on the lecture and used as an <a href> or
 * <iframe src>; each visit gets a fresh short-lived signed R2 URL.
 * Same rule as /api/files/[id]/access: any signed-in user.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Authentication required to open this file.", 401);

    const fileAsset = await prisma.fileAsset.findUnique({ where: { id: params.id } });
    if (!fileAsset) return apiError("File not found", 404);
    if (fileAsset.status !== "ACTIVE") return apiError("File is not ready or has been deleted", 410);

    if (
      fileAsset.visibility === "PRIVATE" &&
      fileAsset.ownerId !== session.user.id &&
      !(await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS))
    ) {
      return apiError("Forbidden", 403);
    }

    if (
      fileAsset.storageKey.startsWith("content-studio/") &&
      fileAsset.ownerId !== session.user.id &&
      !(await hasPermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_ACCESS))
    ) {
      return apiError("Forbidden", 403);
    }

    const url = await createPresignedDownloadUrl({
      key: fileAsset.storageKey,
      expiresInSeconds: 600,
      contentDisposition: `inline; filename="${encodeURIComponent(fileAsset.originalFilename)}"`,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    return handleApiError(error);
  }
}
