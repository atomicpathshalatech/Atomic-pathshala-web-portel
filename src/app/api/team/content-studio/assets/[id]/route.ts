import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { deleteR2Object } from "@/lib/storage/r2-client";

const updateAssetSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  projectId: z.string().trim().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_ASSETS);

    const body = updateAssetSchema.parse(await req.json());
    const existing = await prisma.generatedAsset.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Asset not found", 404);

    const updated = await prisma.generatedAsset.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
      },
      include: { project: { select: { id: true, title: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTENT_STUDIO_ASSET_UPDATE",
        entityType: "GeneratedAsset",
        entityId: updated.id,
        metadata: body,
      },
    });

    return apiSuccess({ asset: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_DELETE);

    const existing = await prisma.generatedAsset.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Asset not found", 404);

    if (existing.storageKey) {
      try {
        await deleteR2Object(existing.storageKey);
      } catch (err) {
        console.warn("[content-studio/assets] R2 delete warning:", err);
      }
    }

    await prisma.$transaction(async (tx) => {
      if (existing.fileAssetId) {
        await tx.fileAsset.updateMany({
          where: { id: existing.fileAssetId },
          data: { status: "DELETED" },
        });
      }
      await tx.generatedAsset.delete({ where: { id: params.id } });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CONTENT_STUDIO_ASSET_DELETE",
          entityType: "GeneratedAsset",
          entityId: params.id,
          metadata: { title: existing.title, assetType: existing.assetType },
        },
      });
    });

    return apiSuccess({ deleted: true, id: params.id });
  } catch (err) {
    return handleApiError(err);
  }
}
