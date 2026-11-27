import "server-only";
import { Prisma, StudioAssetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildR2StorageKey,
  deleteR2Object,
  getR2Credentials,
  uploadBufferToR2,
} from "@/lib/storage/r2-client";

export async function persistGeneratedStudioAsset(params: {
  userId: string;
  projectId?: string;
  assetType: StudioAssetType;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  title?: string;
  prompt?: string;
  provider?: string;
  model?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}) {
  const { bucketName } = getR2Credentials();
  const key = buildR2StorageKey({
    prefix: "content-studio",
    subPath: params.projectId ? `${params.projectId}/${params.assetType.toLowerCase()}` : params.assetType.toLowerCase(),
    originalFilename: params.filename,
  });

  await uploadBufferToR2({
    key,
    buffer: params.buffer,
    contentType: params.mimeType,
    metadata: {
      assetType: params.assetType,
      ...(params.projectId ? { projectId: params.projectId } : {}),
    },
  });

  try {
    const fileAsset = await prisma.fileAsset.create({
      data: {
        ownerId: params.userId,
        fileType: params.assetType,
        storageProvider: "r2",
        bucket: bucketName,
        storageKey: key,
        originalFilename: params.filename,
        mimeType: params.mimeType,
        sizeBytes: BigInt(params.buffer.byteLength),
        status: "ACTIVE",
        visibility: "PROTECTED",
      },
    });

    const accessUrl = `/api/files/${fileAsset.id}/open`;

    const generatedAsset = await prisma.generatedAsset.create({
      data: {
        projectId: params.projectId ?? null,
        fileAssetId: fileAsset.id,
        storageKey: key,
        publicUrl: accessUrl,
        assetType: params.assetType,
        title: params.title ?? params.filename,
        prompt: params.prompt ?? null,
        provider: params.provider ?? null,
        model: params.model ?? null,
        width: params.width ?? null,
        height: params.height ?? null,
        durationMs: params.durationMs ?? null,
        tags: params.tags ?? [],
        metadata: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        createdById: params.userId,
      },
    });

    return { fileAsset, generatedAsset };
  } catch (err) {
    await deleteR2Object(key).catch(() => {});
    throw err;
  }
}
