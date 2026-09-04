import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getR2Client } from "@/lib/storage/r2-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { snapshotData, pageCount = 1, snapshotType = "FINAL" } = body;

    if (!snapshotData) {
      return apiError("snapshotData payload is required.", 400);
    }

    const snapshotId = crypto.randomUUID();
    const storageKey = `whiteboard/${params.classId}/${snapshotId}.json`;
    const jsonString = JSON.stringify(snapshotData);
    const buffer = Buffer.from(jsonString, "utf-8");

    const bucketName = process.env.R2_BUCKET_NAME || "atomic-pathshala";
    const r2Client = getR2Client();

    // Upload snapshot directly to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
        Body: buffer,
        ContentType: "application/json",
      })
    );

    // Create FileAsset record
    const fileAsset = await prisma.fileAsset.create({
      data: {
        ownerId: session.user.id,
        fileType: "WHITEBOARD_SNAPSHOT",
        storageProvider: "r2",
        bucket: bucketName,
        storageKey,
        originalFilename: `whiteboard-snapshot-${snapshotId}.json`,
        mimeType: "application/json",
        sizeBytes: BigInt(buffer.length),
        status: "ACTIVE",
        visibility: "PROTECTED",
      },
    });

    // Create WhiteboardSnapshot record
    const snapshot = await prisma.whiteboardSnapshot.create({
      data: {
        liveClassId: params.classId,
        r2FileId: fileAsset.id,
        snapshotType,
        pageCount,
      },
    });

    return apiSuccess({
      snapshotId: snapshot.id,
      fileAssetId: fileAsset.id,
      storageKey,
      pageCount,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
