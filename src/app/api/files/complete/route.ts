import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getR2ObjectMetadata } from "@/lib/storage/r2-client";
import { z } from "zod";

const completeSchema = z.object({
  fileAssetId: z.string().min(1, "fileAssetId is required"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const { fileAssetId } = completeSchema.parse(body);

    const fileAsset = await prisma.fileAsset.findUnique({
      where: { id: fileAssetId },
    });

    if (!fileAsset) {
      return apiError("File asset not found", 404);
    }

    if (fileAsset.ownerId !== session.user.id && session.user.role !== "ADMIN") {
      return apiError("Forbidden", 403);
    }

    // Verify file actually exists in R2
    const meta = await getR2ObjectMetadata(fileAsset.storageKey);
    if (!meta.exists) {
      return apiError("File not found in storage. Upload may not have completed.", 400);
    }

    const updated = await prisma.fileAsset.update({
      where: { id: fileAssetId },
      data: {
        status: "ACTIVE",
        sizeBytes: meta.contentLength ? BigInt(meta.contentLength) : BigInt(0),
      },
    });

    return apiSuccess({
      fileAsset: {
        id: updated.id,
        storageKey: updated.storageKey,
        originalFilename: updated.originalFilename,
        mimeType: updated.mimeType,
        sizeBytes: updated.sizeBytes.toString(),
        status: updated.status,
        visibility: updated.visibility,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
