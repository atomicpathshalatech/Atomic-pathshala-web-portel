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

const attachSchema = z.object({
  fileAssetId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
});

/**
 * Records an already-uploaded file inside a folder.
 *
 * The bytes never pass through here — the browser PUTs straight to R2 via a
 * presigned URL (see lib/storage/upload-client) and this only files the
 * resulting FileAsset under a folder. Name, size and MIME type are read back
 * from the asset rather than trusted from the request body, so a caller
 * cannot list a 4 KB file as a 40 MB one or claim someone else's upload is a
 * PDF when it is not.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; folderId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const { fileAssetId, title } = attachSchema.parse(await request.json());

    const folder = await prisma.batchFolder.findUnique({
      where: { id: params.folderId },
      select: { id: true, batchId: true },
    });
    if (!folder || folder.batchId !== params.id) return apiError("Folder not found", 404);

    const asset = await prisma.fileAsset.findUnique({
      where: { id: fileAssetId },
      select: {
        id: true,
        ownerId: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
      },
    });
    if (!asset || asset.status !== "ACTIVE") return apiError("Uploaded file is unavailable.", 410);

    // Only the uploader may file their own asset. Without this, any staff
    // member could attach an arbitrary FileAsset id and expose a document
    // from elsewhere in the platform to a batch's students.
    if (asset.ownerId !== session.user.id) {
      return apiError("You can only attach files you uploaded.", 403);
    }

    const siblingCount = await prisma.batchFolderFile.count({ where: { folderId: folder.id } });

    const file = await prisma.batchFolderFile.create({
      data: {
        folderId: folder.id,
        fileAssetId: asset.id,
        title,
        fileName: asset.originalFilename,
        // sizeBytes is a BigInt on FileAsset; the listing only needs a number
        // for display, and Number() is exact well past any realistic upload.
        sizeBytes: Number(asset.sizeBytes),
        mimeType: asset.mimeType,
        order: siblingCount,
        uploadedById: session.user.id,
      },
    });

    return apiSuccess({ file });
  } catch (error) {
    return handleApiError(error);
  }
}
