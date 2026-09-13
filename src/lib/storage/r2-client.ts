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
  | "slides"
  | "documents"
  | "exports";

/**
 * S3/R2 object metadata is sent as raw `x-amz-meta-*` HTTP headers — Node's
 * http client throws ERR_INVALID_CHAR for any header value containing a
 * character outside Latin-1 (anything above U+00FF), which includes every
 * Devanagari/Hindi character and most emoji. A whiteboard session or lecture
 * titled in Hindi (extremely normal content for this platform) would hit
 * this on every metadata-bearing upload and abort the whole PutObjectCommand
 * before any bytes were sent — not a partial/cosmetic failure, the entire
 * PDF/PPTX upload throws. `encodeURIComponent` is a cheap, always-ASCII,
 * fully reversible encoding, so this never loses information (unlike
 * stripping) and never crashes regardless of input.
 */
function sanitizeMetadata(metadata?: Record<string, string>): Record<string, string> | undefined {
  if (!metadata) return metadata;
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    safe[key] = encodeURIComponent(value);
  }
  return safe;
}

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
  // Deliberately R2_* / CLOUDFLARE_ACCOUNT_ID ONLY — no STORAGE_* fallback and
  // no STORAGE_ENDPOINT override. This file exists specifically to talk to
  // Cloudflare R2 (the presigned-URL direct-upload flow); the generic
  // STORAGE_* / STORAGE_ENDPOINT vars belong to lib/storage/index.ts's
  // multi-provider resolveStorage(), and a legacy Supabase-storage
  // STORAGE_ENDPOINT left set on Vercel was silently overriding the R2
  // endpoint here, sending browser direct-uploads to Supabase Storage (wrong
  // host entirely) while everything routed through lib/storage/index.ts kept
  // working — same production/local drift as the earlier duplicate STORAGE_*
  // block issue, recurring in this second, independent storage client. This
  // one is now immune to whatever STORAGE_ENDPOINT happens to be set to.
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || "atomic-pathshala";

  if (!accountId) throw new R2StorageNotConfiguredError("CLOUDFLARE_ACCOUNT_ID");
  if (!accessKeyId) throw new R2StorageNotConfiguredError("R2_ACCESS_KEY_ID");
  if (!secretAccessKey) throw new R2StorageNotConfiguredError("R2_SECRET_ACCESS_KEY");

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

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
    // @aws-sdk/client-s3 >= 3.729 adds a default CRC32 integrity checksum
    // (`x-amz-checksum-*`) to every PutObject. Cloudflare R2 rejects those
    // with a 410 + a non-XML body, which the SDK then fails to deserialize
    // ("AwsXmlParser.parse: unexpected content"). Restrict checksums to
    // operations that actually require them so R2 uploads work again.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
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
    Metadata: sanitizeMetadata(params.metadata),
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

/**
 * Directly uploads an in-memory Buffer/Uint8Array to Cloudflare R2.
 * Used by server-side background generators (e.g. Slide PDF / PPTX exporter).
 */
export async function uploadBufferToR2(params: {
  key: string;
  buffer: Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<{ key: string }> {
  const { bucketName } = getR2Credentials();
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    Body: params.buffer,
    ContentType: params.contentType,
    Metadata: sanitizeMetadata(params.metadata),
  });

  await client.send(command);
  return { key: params.key };
}
