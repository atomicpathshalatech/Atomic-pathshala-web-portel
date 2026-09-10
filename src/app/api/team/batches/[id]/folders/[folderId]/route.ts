import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isPublished: z.boolean().optional(),
});

/** Loads a folder and refuses ids that belong to a different batch. */
async function loadOwned(batchId: string, folderId: string) {
  const folder = await prisma.batchFolder.findUnique({
    where: { id: folderId },
    select: { id: true, batchId: true, parentId: true, name: true },
  });
  if (!folder || folder.batchId !== batchId) return null;
  return folder;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; folderId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const folder = await loadOwned(params.id, params.folderId);
    if (!folder) return apiError("Folder not found", 404);

    const data = patchSchema.parse(await request.json());
    if (data.name === undefined && data.isPublished === undefined) {
      return apiError("Nothing to update.", 400);
    }

    const updated = await prisma.batchFolder.update({
      where: { id: folder.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      },
    });

    return apiSuccess({ folder: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Deletes a folder with everything under it — subfolders and file listings
 * both cascade at the database level.
 *
 * The underlying FileAssets are deliberately left alone: the same upload can
 * be referenced elsewhere, and an orphaned asset costs storage while a
 * wrongly-deleted one costs the file itself.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; folderId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const folder = await loadOwned(params.id, params.folderId);
    if (!folder) return apiError("Folder not found", 404);

    await prisma.batchFolder.delete({ where: { id: folder.id } });

    await prisma.auditLog
      .create({
        data: {
          userId: session.user.id,
          action: "BATCH_FOLDER_DELETED",
          entityType: "BatchFolder",
          entityId: folder.id,
          metadata: { batchId: params.id, name: folder.name },
        },
      })
      .catch((err) => console.error("[batch_folder_delete_audit_error]", err));

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
