import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { mediaUpdateSchema } from "@/lib/validation/media";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { deleteFile } from "@/lib/storage";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MEDIA_MANAGE);

    const input = mediaUpdateSchema.parse(await request.json());
    const existing = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Asset not found.", 404);

    const asset = await prisma.mediaAsset.update({ where: { id: params.id }, data: input });
    return apiSuccess({ asset });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Deletes the DB row and best-effort deletes the underlying object.
 * Does NOT check whether the asset is referenced by a section's `config`
 * JSON (config is free-form per section type, not a real FK) — deleting
 * an in-use image is on the admin; the renderer just shows a broken
 * image rather than crashing, same tradeoff as any CMS media library. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MEDIA_MANAGE);

    const existing = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Asset not found.", 404);

    await prisma.mediaAsset.delete({ where: { id: params.id } });
    deleteFile(existing.storageKey).catch(() => undefined);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "MEDIA_DELETED",
        entityType: "MediaAsset",
        entityId: params.id,
        metadata: { fileName: existing.fileName },
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
