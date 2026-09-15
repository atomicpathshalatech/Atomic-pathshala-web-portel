import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPresignedUploadUrl } from "@/lib/storage/r2-client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { academicClassId, academicSubjectId, academicChapterId, language, fileName, contentType } = body;

    if (!academicClassId || !academicSubjectId || !academicChapterId || !language || !fileName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const r2Key = `ncert/${academicClassId}/${academicSubjectId}/${academicChapterId}/${String(language).toLowerCase()}_${Date.now()}_${cleanFileName}`;

    let uploadUrl = "";
    try {
      const presigned = await createPresignedUploadUrl({
        key: r2Key,
        contentType: contentType || "application/pdf",
        expiresInSeconds: 1800,
      });
      uploadUrl = presigned.uploadUrl;
    } catch (r2Err) {
      console.warn("[NCERT Presign] R2 client presign failed, checking fallback:", r2Err);
      const endpoint = process.env.STORAGE_ENDPOINT;
      const bucket = process.env.STORAGE_BUCKET_NAME || process.env.R2_BUCKET_NAME || "atomic-pathshala";
      const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
      if (endpoint && accessKeyId && secretAccessKey) {
        const s3 = new S3Client({
          region: "auto",
          endpoint,
          credentials: { accessKeyId, secretAccessKey },
          forcePathStyle: true,
        });
        const cmd = new PutObjectCommand({
          Bucket: bucket,
          Key: r2Key,
          ContentType: contentType || "application/pdf",
        });
        uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 1800 });
      } else {
        throw r2Err;
      }
    }

    return NextResponse.json({
      success: true,
      uploadUrl,
      r2Key,
      fileName,
    });
  } catch (error: any) {
    console.error("[NCERT Presign Route] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create presigned upload URL" },
      { status: 500 }
    );
  }
}
