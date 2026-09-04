import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  buildR2StorageKey,
  createPresignedUploadUrl,
  type R2FolderPrefix,
} from "@/lib/storage/r2-client";
import { z } from "zod";

const requestSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  fileType: z.enum([
    "PDF",
    "IMAGE",
    "DOCUMENT",
    "DPP",
    "NOTES",
    "WHITEBOARD_SNAPSHOT",
    "PROFILE_IMAGE",
    "THUMBNAIL",
    "EXPORT",
  ]),
  prefix: z.enum([
    "pdf",
    "dpp",
    "modules",
    "notes",
    "solutions",
    "question-images",
    "profile-images",
    "course-thumbnails",
    "whiteboard",
    "documents",
    "exports",
  ]),
  subPath: z.string().optional(),
  entityId: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PROTECTED", "PRIVATE"]).default("PROTECTED"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized. Please log in to upload files.", 401);
    }

    const body = await request.json();
    const input = requestSchema.parse(body);

    const storageKey = buildR2StorageKey({
      prefix: input.prefix as R2FolderPrefix,
      subPath: input.subPath,
      entityId: input.entityId || session.user.id,
      originalFilename: input.filename,
    });

    const fileAsset = await prisma.fileAsset.create({
      data: {
        ownerId: session.user.id,
        fileType: input.fileType,
        storageProvider: "r2",
        bucket: process.env.R2_BUCKET_NAME || "atomic-pathshala",
        storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        status: "PENDING_UPLOAD",
        visibility: input.visibility,
      },
    });

    const presigned = await createPresignedUploadUrl({
      key: storageKey,
      contentType: input.mimeType,
      expiresInSeconds: 900, // 15 mins
    });

    return apiSuccess({
      fileAssetId: fileAsset.id,
      storageKey,
      uploadUrl: presigned.uploadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
