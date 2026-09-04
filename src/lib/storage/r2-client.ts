import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export type R2FolderPrefix =
  | "pdf"
  | "dpp"
  | "modules"
  | "notes"
  | "solutions"
  | "question-images"
  | "profile-images"
  | "course-thumbnails"
  | "whiteboard"
  | "documents"
  | "exports";

export class R2StorageNotConfiguredError extends Error {
  constructor(missingVar?: string) {
    super(
      missingVar
        ? `Cloudflare R2 storage is missing environment variable: ${missingVar}. Check .env configuration.`
        : "Cloudflare R2 storage credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are not configured."
    );
    this.name = "R2StorageNotConfiguredError";
  }
}

function getR2Credentials() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.STORAGE_ACCOUNT_ID;
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY || process.env.STORAGE_SECRET_ACCESS_KEY;
  const bucketName =
    process.env.R2_BUCKET_NAME || process.env.STORAGE_BUCKET_NAME || "atomic-pathshala";

  // R2 endpoint format: https://<accountid>.r2.cloudflarestorage.com or custom STORAGE_ENDPOINT
  let endpoint = process.env.STORAGE_ENDPOINT;
  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  if (!accessKeyId) throw new R2StorageNotConfiguredError("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) throw new R2StorageNotConfiguredError("R2_SECRET_ACCESS_KEY");
  if (!endpoint) throw new R2StorageNotConfiguredError("CLOUDFLARE_ACCOUNT_ID / STORAGE_ENDPOINT");

  return { accountId, accessKeyId, secretAccessKey, bucketName, endpoint };
}

let cachedClient: S3Client | null = null;

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const { accessKeyId, secretAccessKey, endpoint } = getR2Credentials();

  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // R2 supports path-style requests
    forcePathStyle: true,
  });

  return cachedClient;
}

/**
 * Builds a collision-free standard storage key for Cloudflare R2
 * Example: "modules/physics/kinematics/7c0b2c5e-88f2-4e89/notes.pdf"
 * Example: "profile-images/user-123/7c0b2c5e-88f2-4e89-avatar.webp"
 */
export function buildR2StorageKey(params: {
  prefix: R2FolderPrefix;
  subPath?: string;
  entityId?: string;
  originalFilename: string;
}): string {
  const uniqueId = crypto.randomUUID();
  const sanitizedFilename = params.originalFilename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .toLowerCase();

  const parts: string[] = [params.prefix];

  if (params.subPath) {
    const cleanSubPath = params.subPath.replace(/^\/+|\/+$/g, "");
    if (cleanSubPath) parts.push(cleanSubPath);
  }

  if (params.entityId) {
    parts.push(params.entityId);
  }

  parts.push(`${uniqueId}-${sanitizedFilename}`);
  return parts.join("/");
}

/**
 * Generates a presigned PUT URL allowing browser/client to upload directly to Cloudflare R2.
 * Never loads large binary files into Node server memory.
 */
export async function createPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
  metadata?: Record<string, string>;
}): Promise<{ uploadUrl: string; key: string; expiresInSeconds: number }> {
  const { bucketName } = getR2Credentials();
  const client = getR2Client();
  const expiresIn = params.expiresInSeconds || 900; // Default: 15 minutes

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    ContentType: params.contentType,
    Metadata: params.metadata,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return { uploadUrl, key: params.key, expiresInSeconds: expiresIn };
}

/**
 * Generates a short-lived presigned GET URL for protected files (PDFs, premium notes, private assets).
 */
export async function createPresignedDownloadUrl(params: {
  key: string;
  expiresInSeconds?: number;
  contentDisposition?: string;
}): Promise<string> {
  const { bucketName } = getR2Credentials();
  const client = getR2Client();
  const expiresIn = params.expiresInSeconds || 600; // Default: 10 minutes

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    ResponseContentDisposition: params.contentDisposition,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Verifies if an object exists in Cloudflare R2 and retrieves its metadata/size.
 */
export async function getR2ObjectMetadata(key: string): Promise<{
  exists: boolean;
  contentLength?: number;
  contentType?: string;
  etag?: string;
}> {
  const { bucketName } = getR2Credentials();
  const client = getR2Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const head = await client.send(command);
    return {
      exists: true,
      contentLength: head.ContentLength,
      contentType: head.ContentType,
      etag: head.ETag,
    };
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    throw err;
  }
}

/**
 * Deletes an object from Cloudflare R2
 */
export async function deleteR2Object(key: string): Promise<void> {
  const { bucketName } = getR2Credentials();
  const client = getR2Client();

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await client.send(command);
  } catch (err) {
    console.warn("[R2] Delete warning for key:", key, err);
  }
}
