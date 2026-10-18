import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Thin S3-compatible object storage wrapper for the simple
 * "upload a Buffer, get a public URL" callers (question images, module
 * assets, profile photos, whiteboard backgrounds, doubt attachments…).
 *
 * Credential resolution, in order:
 *   1. Cloudflare R2 via the dedicated R2_* vars (+ CLOUDFLARE_ACCOUNT_ID) —
 *      the same set src/lib/storage/r2-client.ts uses. Preferred because
 *      the generic STORAGE_* vars in .env have historically been duplicated
 *      / pointed at the wrong bucket, and a stray later block silently wins.
 *   2. Generic STORAGE_* vars (any S3-compatible provider).
 */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "File storage isn't set up. Provide either R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / " +
        "R2_BUCKET_NAME / R2_PUBLIC_BASE_URL (+ CLOUDFLARE_ACCOUNT_ID), or STORAGE_ENDPOINT / " +
        "STORAGE_BUCKET_NAME / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY / STORAGE_PUBLIC_URL."
    );
    this.name = "StorageNotConfiguredError";
  }
}

interface ResolvedStorage {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrlBase: string;
  provider: "r2" | "s3";
}

function resolveStorage(): ResolvedStorage | null {
  const env = process.env;

  // 1. Cloudflare R2 (dedicated vars) — takes precedence.
  const r2Key = env.R2_ACCESS_KEY_ID;
  const r2Secret = env.R2_SECRET_ACCESS_KEY;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || env.STORAGE_ACCOUNT_ID;
  if (r2Key && r2Secret && (accountId || env.STORAGE_ENDPOINT)) {
    const publicUrlBase = env.R2_PUBLIC_BASE_URL || env.STORAGE_PUBLIC_URL;
    const bucket = env.R2_BUCKET_NAME || env.STORAGE_BUCKET_NAME;
    if (publicUrlBase && bucket) {
      return {
        endpoint: accountId
          ? `https://${accountId}.r2.cloudflarestorage.com`
          : (env.STORAGE_ENDPOINT as string),
        accessKeyId: r2Key,
        secretAccessKey: r2Secret,
        bucket,
        publicUrlBase,
        provider: "r2",
      };
    }
  }

  // 2. Generic STORAGE_* (any S3-compatible provider).
  if (
    env.STORAGE_ENDPOINT &&
    env.STORAGE_BUCKET_NAME &&
    env.STORAGE_ACCESS_KEY_ID &&
    env.STORAGE_SECRET_ACCESS_KEY &&
    env.STORAGE_PUBLIC_URL
  ) {
    return {
      endpoint: env.STORAGE_ENDPOINT,
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
      bucket: env.STORAGE_BUCKET_NAME,
      publicUrlBase: env.STORAGE_PUBLIC_URL,
      provider: "s3",
    };
  }

  return null;
}

function requireStorage(): ResolvedStorage {
  const s = resolveStorage();
  if (!s) throw new StorageNotConfiguredError();
  return s;
}

/** True when a usable storage config (R2 or generic S3) is present. */
export function storageConfigured(): boolean {
  return resolveStorage() !== null;
}

/**
 * Non-secret description of the bucket that is actually active — the
 * endpoint host, bucket name, public URL base and which provider path
 * resolved. Handy in logs and the /api/upload debug payload.
 */
export function activeStorageInfo(): {
  configured: boolean;
  provider: "r2" | "s3" | null;
  endpointHost: string | null;
  bucket: string | null;
  publicUrlBase: string | null;
} {
  const s = resolveStorage();
  if (!s) {
    return { configured: false, provider: null, endpointHost: null, bucket: null, publicUrlBase: null };
  }
  let endpointHost: string | null = s.endpoint;
  try {
    endpointHost = new URL(s.endpoint).host;
  } catch {
    /* keep raw */
  }
  return {
    configured: true,
    provider: s.provider,
    endpointHost,
    bucket: s.bucket,
    publicUrlBase: s.publicUrlBase,
  };
}

let cachedClient: S3Client | null = null;
let cachedFor = "";

function getClient(s: ResolvedStorage): S3Client {
  const sig = `${s.endpoint}|${s.accessKeyId}`;
  if (cachedClient && cachedFor === sig) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: s.endpoint,
    credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
    // Both R2 and Supabase Storage's S3-compatible endpoints expect
    // path-style requests (bucket in the path, not as a subdomain).
    forcePathStyle: true,
    // Recent @aws-sdk/client-s3 adds a default CRC32 checksum that
    // Cloudflare R2 rejects with a 410 + non-XML body (see r2-client.ts).
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  cachedFor = sig;
  return cachedClient;
}

export async function uploadFile(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const s = requireStorage();
  const client = getClient(s);
  await client.send(
    new PutObjectCommand({
      Bucket: s.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
  return `${s.publicUrlBase.replace(/\/$/, "")}/${params.key}`;
}

/** Best-effort delete — callers should not fail the request if this throws
 * (e.g. replacing a photo shouldn't fail just because the old file's
 * already gone or storage is briefly unreachable). */
export async function deleteFile(key: string): Promise<void> {
  const s = resolveStorage();
  if (!s) return;
  const client = getClient(s);
  await client.send(new DeleteObjectCommand({ Bucket: s.bucket, Key: key }));
}

/** Recovers the storage key from a public URL previously returned by
 * uploadFile, so a replace/remove can clean up the old object. Returns
 * null for anything that doesn't look like one of ours. */
export function keyFromPublicUrl(url: string): string | null {
  const s = resolveStorage();
  const base = s?.publicUrlBase ?? process.env.STORAGE_PUBLIC_URL ?? process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  const prefix = base.replace(/\/$/, "") + "/";
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/**
 * A bucket with no public access, for files that must only be reached through
 * a signed link (module PDFs). Optional: without it those files stay in the
 * main bucket. Same credentials and endpoint as the main bucket.
 */
export function privateBucketName(): string | null {
  const name = (process.env.R2_PRIVATE_BUCKET_NAME || "").replace(/^["']|["']$/g, "").trim();
  return name || null;
}

/** The main (public) bucket's name, or null when storage isn't configured. */
export function mainBucketName(): string | null {
  return resolveStorage()?.bucket ?? null;
}

export async function putObject(params: { bucket: string; key: string; body: Buffer; contentType: string }): Promise<void> {
  const s = requireStorage();
  await getClient(s).send(
    new PutObjectCommand({ Bucket: params.bucket, Key: params.key, Body: params.body, ContentType: params.contentType })
  );
}

/** The object's bytes, or null when it does not exist. Other failures throw. */
export async function getObjectBuffer(bucket: string, key: string): Promise<Buffer | null> {
  const s = requireStorage();
  try {
    const res = await getClient(s).send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) return null;
    return Buffer.from(await res.Body.transformToByteArray());
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/** A GET link that works for `expiresInSeconds`, signed with the server's credentials. */
export async function signedGetUrl(params: {
  bucket: string;
  key: string;
  expiresInSeconds?: number;
  contentDisposition?: string;
  contentType?: string;
}): Promise<string> {
  const s = requireStorage();
  return getSignedUrl(
    getClient(s),
    new GetObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
      ResponseContentDisposition: params.contentDisposition,
      ResponseContentType: params.contentType,
    }),
    { expiresIn: params.expiresInSeconds ?? 600 }
  );
}

export async function copyObject(params: { fromBucket: string; fromKey: string; toBucket: string; toKey: string }): Promise<void> {
  const s = requireStorage();
  await getClient(s).send(
    new CopyObjectCommand({
      Bucket: params.toBucket,
      Key: params.toKey,
      CopySource: `${params.fromBucket}/${params.fromKey.split("/").map(encodeURIComponent).join("/")}`,
    })
  );
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  const s = resolveStorage();
  if (!s) return;
  await getClient(s).send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
