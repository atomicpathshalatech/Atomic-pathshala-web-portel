import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileAsset = await prisma.fileAsset.findUnique({
      where: { id: params.id },
    });

    if (!fileAsset) {
      return apiError("File not found", 404);
    }

    if (fileAsset.status !== "ACTIVE") {
      return apiError("File is not ready or has been deleted", 410);
    }

    // Public assets (thumbnails, public document banners)
    if (fileAsset.visibility === "PUBLIC") {
      const publicBase = process.env.R2_PUBLIC_BASE_URL || process.env.STORAGE_PUBLIC_URL;
      if (publicBase) {
        return apiSuccess({
          url: `${publicBase.replace(/\/$/, "")}/${fileAsset.storageKey}`,
          visibility: "PUBLIC",
          isDirect: true,
        });
      }
    }

    // Protected / Private assets require active session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required to access this file.", 401);
    }

    // Generate short-lived signed download URL (10 minutes)
    const downloadUrl = await createPresignedDownloadUrl({
      key: fileAsset.storageKey,
      expiresInSeconds: 600,
      contentDisposition: `inline; filename="${encodeURIComponent(fileAsset.originalFilename)}"`,
    });

    return apiSuccess({
      url: downloadUrl,
      visibility: fileAsset.visibility,
      expiresInSeconds: 600,
      mimeType: fileAsset.mimeType,
      originalFilename: fileAsset.originalFilename,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
