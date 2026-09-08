import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getR2Client } from "@/lib/storage/r2-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canAccess = await hasPermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
    if (!canAccess) return apiError("Forbidden", 403);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return apiError("No presentation file provided", 400);

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    const isPpt =
      file.name.toLowerCase().endsWith(".ppt") ||
      file.name.toLowerCase().endsWith(".pptx") ||
      file.type.includes("presentation");

    if (!isPdf && !isPpt) {
      return apiError("Please upload a valid PDF or PPT/PPTX presentation document.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `modules/live-classes/${params.scheduleId}/${Date.now()}_${safeName}`;
    const bucket = process.env.R2_BUCKET_NAME || process.env.STORAGE_BUCKET_NAME || "atomic-pathshala";

    // Upload directly to R2 bucket via S3 client
    const s3 = getR2Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || (isPpt ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "application/pdf"),
      })
    );

    // Create FileAsset record
    const fileAsset = await prisma.fileAsset.create({
      data: {
        ownerId: session.user.id,
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        fileType: isPpt ? "DOCUMENT" : "PDF",
        sizeBytes: BigInt(buffer.length),
        storageKey: key,
        bucket,
        storageProvider: "r2",
        visibility: "PROTECTED",
        status: "ACTIVE",
        metadata: {
          scheduleId: params.scheduleId,
        },
      },
    });

    const accessUrl = `/api/files/${fileAsset.id}/access`;

    return apiSuccess({
      fileAssetId: fileAsset.id,
      storageKey: key,
      url: accessUrl,
      filename: file.name,
      fileType: isPpt ? "PPTX" : "PDF",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
