import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, StorageNotConfiguredError } from "@/lib/storage";
import { MEDIA_MAX_BYTES, MEDIA_ALLOWED_TYPES } from "@/lib/validation/media";

/** Media Library — reuses the existing S3-compatible storage wrapper
 * (already backing profile photos / doubt attachments / whiteboard
 * backgrounds) rather than a new upload pipeline. Every upload is
 * recorded as a MediaAsset row so the library UI can list/search/reuse
 * assets across sections instead of re-uploading the same image. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MEDIA_MANAGE);

    const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return apiSuccess({ assets });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MEDIA_MANAGE);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("No file was uploaded.", 400);

    const extension = MEDIA_ALLOWED_TYPES[file.type];
    if (!extension) return apiError("Please upload a JPG, PNG, WEBP, GIF or SVG image.", 400);
    if (file.size > MEDIA_MAX_BYTES) return apiError("File is too large — please keep it under 8MB.", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `media-library/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const url = await uploadFile({ key, body: buffer, contentType: file.type });

    const asset = await prisma.mediaAsset.create({
      data: {
        url,
        storageKey: key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "MEDIA_UPLOADED",
        entityType: "MediaAsset",
        entityId: asset.id,
        metadata: { fileName: asset.fileName, sizeBytes: asset.sizeBytes },
      },
    });

    return apiSuccess({ asset }, 201);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return apiError(error.message, 503);
    return handleApiError(error);
  }
}
