import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Thin S3-compatible object storage wrapper. Both providers this project's
 * .env already anticipates — Cloudflare R2 and Supabase Storage — expose an
 * S3-compatible API, so one client handles either: which provider is
 * actually active is purely a matter of which STORAGE_* credentials are
 * filled in (see README "Storage setup" for exact steps per provider).
 * No separate SDK per provider, and no code branch on STORAGE_PROVIDER —
 * it's kept in .env only as a human-readable note of which one you picked.
 */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "File storage isn't set up yet. Fill in STORAGE_ENDPOINT, STORAGE_BUCKET_NAME, " +
        "STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY and STORAGE_PUBLIC_URL in .env " +
        "— see README's Storage setup section for exact steps."
    );
    this.name = "StorageNotConfiguredError";
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new StorageNotConfiguredError();
  return value;
}

function getClient() {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv("STORAGE_ENDPOINT"),
    credentials: {
      accessKeyId: requiredEnv("STORAGE_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("STORAGE_SECRET_ACCESS_KEY"),
    },
    // Both R2 and Supabase Storage's S3-compatible endpoints expect
    // path-style requests (bucket in the path, not as a subdomain).
    forcePathStyle: true,
  });
}

export async function uploadFile(params: { key: string; body: Buffer; contentType: string }): Promise<string> {
  const bucket = requiredEnv("STORAGE_BUCKET_NAME");
  const publicUrlBase = requiredEnv("STORAGE_PUBLIC_URL");

  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );

  return `${publicUrlBase.replace(/\/$/, "")}/${params.key}`;
}

/** Best-effort delete — callers should not fail the request if this throws
 * (e.g. replacing a photo shouldn't fail just because the old file's
 * already gone or storage is briefly unreachable). */
export async function deleteFile(key: string): Promise<void> {
  const bucket = process.env.STORAGE_BUCKET_NAME;
  if (!bucket) return;
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Recovers the storage key from a public URL previously returned by
 * uploadFile, so a replace/remove can clean up the old object. Returns
 * null for anything that doesn't look like one of ours (e.g. a photoUrl
 * set some other way). */
export function keyFromPublicUrl(url: string): string | null {
  const base = process.env.STORAGE_PUBLIC_URL;
  if (!base) return null;
  const prefix = base.replace(/\/$/, "") + "/";
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}
