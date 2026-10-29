import "server-only";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  ListMultipartUploadsCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolveRecordedStorageConfig, type RecordedStorageConfig } from "./config";

/**
 * Storage for recorded lectures — a SEPARATE Cloudflare R2 account.
 *
 * Talks only to the RECORDED_R2_* configuration (see ./config). It never
 * reads the main account's R2_* / CLOUDFLARE_ACCOUNT_ID variables and never
 * falls back to them: with an incomplete configuration every call throws
 * RecordedStorageNotConfiguredError and uploads stay disabled.
 *
 * Nothing here deletes or overwrites a finished object. The only removal is
 * AbortMultipartUpload, which discards the parts of an upload that never
 * completed.
 */

export const RECORDED_STORAGE_NAMESPACE = "recorded-r2";

export class RecordedStorageNotConfiguredError extends Error {
  constructor(public problems: string[]) {
    super(`Recorded-lecture storage is not set up: ${problems.join("; ")}.`);
    this.name = "RecordedStorageNotConfiguredError";
  }
}

let cached: { key: string; client: S3Client; config: RecordedStorageConfig } | null = null;

function connection() {
  const resolved = resolveRecordedStorageConfig(process.env);
  if (!resolved.ok) throw new RecordedStorageNotConfiguredError(resolved.problems);
  const config = resolved.config;
  const key = `${config.endpoint}|${config.accessKeyId}|${config.bucket}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      config,
      client: new S3Client({
        region: "auto",
        endpoint: config.endpoint,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        forcePathStyle: true,
      }),
    };
  }
  return cached;
}

/** The bucket recorded lectures go to (throws when storage is not set up). */
export function recordedBucket(): string {
  return connection().config.bucket;
}

export async function startMultipartUpload(params: { key: string; contentType: string }): Promise<string> {
  const { client, config } = connection();
  const out = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: params.key,
      ContentType: params.contentType,
      CacheControl: "private, max-age=0, no-store",
    })
  );
  if (!out.UploadId) throw new Error("R2 did not return an upload id.");
  return out.UploadId;
}

/** Short-lived URLs the browser PUTs each part to (the R2 keys never leave the server). */
export async function signUploadParts(params: { key: string; uploadId: string; partNumbers: number[]; expiresInSeconds?: number }) {
  const { client, config } = connection();
  const expiresIn = params.expiresInSeconds ?? 3600;
  return Promise.all(
    params.partNumbers.map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        client,
        new UploadPartCommand({ Bucket: config.bucket, Key: params.key, UploadId: params.uploadId, PartNumber: partNumber }),
        { expiresIn }
      ),
    }))
  );
}

/** Parts R2 already holds for an open upload — lets an interrupted upload resume. */
export async function listUploadedParts(params: { key: string; uploadId: string }) {
  const { client, config } = connection();
  const parts: { partNumber: number; etag: string; size: number }[] = [];
  let marker: string | undefined;
  for (let guard = 0; guard < 20; guard++) {
    const out = await client.send(
      new ListPartsCommand({ Bucket: config.bucket, Key: params.key, UploadId: params.uploadId, PartNumberMarker: marker })
    );
    for (const p of out.Parts ?? []) {
      if (p.PartNumber && p.ETag) parts.push({ partNumber: p.PartNumber, etag: p.ETag, size: Number(p.Size ?? 0) });
    }
    if (!out.IsTruncated || !out.NextPartNumberMarker) break;
    marker = out.NextPartNumberMarker;
  }
  return parts.sort((a, b) => a.partNumber - b.partNumber);
}

export async function completeMultipartUpload(params: { key: string; uploadId: string; parts: { partNumber: number; etag: string }[] }) {
  const { client, config } = connection();
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: params.key,
      UploadId: params.uploadId,
      MultipartUpload: { Parts: params.parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    })
  );
}

/** Discards the parts of an upload that never completed (not a finished file). */
export async function abortMultipartUpload(params: { key: string; uploadId: string }) {
  const { client, config } = connection();
  await client.send(new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: params.key, UploadId: params.uploadId }));
}

/** Uploads still open in the recorded-lecture bucket (for cleaning up abandoned ones). */
export async function listOpenMultipartUploads() {
  const { client, config } = connection();
  const out = await client.send(new ListMultipartUploadsCommand({ Bucket: config.bucket, MaxUploads: 1000 }));
  return (out.Uploads ?? [])
    .filter((u) => u.Key && u.UploadId)
    .map((u) => ({ key: u.Key!, uploadId: u.UploadId!, initiated: u.Initiated ?? null }));
}

export async function headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const { client, config } = connection();
  try {
    const out = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return { size: Number(out.ContentLength ?? 0), contentType: out.ContentType ?? null };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw err;
  }
}

/** The first bytes of an object (to check it really is a video). */
export async function readObjectHead(key: string, bytes = 64): Promise<Uint8Array> {
  const { client, config } = connection();
  const out = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
  if (!out.Body) return new Uint8Array();
  return new Uint8Array(await out.Body.transformToByteArray());
}

/** Short-lived playback URL (range requests work, so the player can seek). */
export async function signedPlaybackUrl(key: string, expiresInSeconds = 600): Promise<string> {
  const { client, config } = connection();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition: "inline",
      ResponseCacheControl: "private, max-age=0, no-store",
    }),
    { expiresIn: expiresInSeconds }
  );
}

/** Short-lived URL for a lecture thumbnail (the bucket stays private). */
export async function signedThumbnailUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const { client, config } = connection();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key, ResponseCacheControl: "private, max-age=3600" }), {
    expiresIn: expiresInSeconds,
  });
}

/** Single-request upload URL for a small file (the thumbnail). */
export async function signSingleUpload(params: { key: string; contentType: string; expiresInSeconds?: number }) {
  const { client, config } = connection();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: config.bucket, Key: params.key, ContentType: params.contentType }), {
    expiresIn: params.expiresInSeconds ?? 600,
  });
}
