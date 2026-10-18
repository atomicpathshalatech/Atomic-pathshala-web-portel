import "server-only";
import {
  copyObject,
  deleteObject,
  getObjectBuffer,
  keyFromPublicUrl,
  mainBucketName,
  privateBucketName,
  putObject,
  signedGetUrl,
  uploadFile,
} from "@/lib/storage";

/**
 * Where a module's PDFs (the source, saved revisions, exports) live and how
 * they are reached.
 *
 * A stored value is one of:
 *   - "private:<key>"  — in the private bucket (R2_PRIVATE_BUCKET_NAME)
 *   - a public link of the main bucket (older files, or no private bucket set)
 *   - a path-style R2 link (signed or not) of the main bucket
 *   - any other link (not ours; passed through as it is)
 *
 * The browser never gets a stored value: it gets /api/team/modules/<id>/file,
 * which checks the user's permission and answers with a 10-minute signed link.
 * The server reads files with its own credentials, never through a public link.
 */

const PRIVATE_PREFIX = "private:";

export type ModuleFileRef = { bucket: string; key: string } | { external: string };

export function moduleFileRef(stored: string): ModuleFileRef | null {
  const value = (stored || "").trim();
  if (!value) return null;
  if (value.startsWith(PRIVATE_PREFIX)) {
    const bucket = privateBucketName();
    // A private file whose bucket is no longer configured cannot be reached.
    if (!bucket) return null;
    return { bucket, key: value.slice(PRIVATE_PREFIX.length) };
  }
  const main = mainBucketName();
  if (main) {
    const key = keyFromPublicUrl(value);
    if (key) return { bucket: main, key: decodeURIComponent(key) };
    try {
      const url = new URL(value);
      if (url.hostname.endsWith(".r2.cloudflarestorage.com")) {
        const path = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
        const key2 = path.startsWith(`${main}/`) ? path.slice(main.length + 1) : path;
        if (key2) return { bucket: main, key: key2 };
      }
    } catch {
      /* not a link */
    }
  }
  if (/^https?:\/\//i.test(value)) return { external: value };
  return null;
}

/** True for a value that points at a file in one of our buckets. */
export function isOurModuleFile(stored: string): boolean {
  const ref = moduleFileRef(stored);
  return !!ref && "bucket" in ref;
}

export function isPrivateModuleFile(stored: string): boolean {
  return (stored || "").startsWith(PRIVATE_PREFIX);
}

/** Stores a module PDF and returns the value to keep in the database. */
export async function storeModuleFile(params: { key: string; body: Buffer; contentType: string }): Promise<string> {
  const bucket = privateBucketName();
  if (!bucket) return uploadFile(params);
  await putObject({ bucket, ...params });
  return `${PRIVATE_PREFIX}${params.key}`;
}

/**
 * A PDF the browser uploaded straight to the main bucket (large files cannot
 * pass through a Vercel function). With a private bucket it is copied there and
 * the public copy removed; the value to store is returned.
 */
export async function adoptUploadedModuleFile(mainKey: string, toKey: string): Promise<string> {
  const main = mainBucketName();
  const priv = privateBucketName();
  if (!main) throw new Error("File storage isn't configured.");
  if (!priv) {
    const base = process.env.R2_PUBLIC_BASE_URL || process.env.STORAGE_PUBLIC_URL;
    if (!base) throw new Error("File storage isn't configured for public files.");
    return `${base.replace(/\/$/, "")}/${mainKey}`;
  }
  await copyObject({ fromBucket: main, fromKey: mainKey, toBucket: priv, toKey });
  try {
    await deleteObject(main, mainKey);
  } catch (err) {
    console.warn("[module_file_adopt_cleanup]", err instanceof Error ? err.message : err);
  }
  return `${PRIVATE_PREFIX}${toKey}`;
}

export class ModuleFileMissingError extends Error {
  constructor() {
    super("The PDF could not be found in storage. Upload it again.");
    this.name = "ModuleFileMissingError";
  }
}

/** The file's bytes, read with the server's credentials. */
export async function readModuleFile(stored: string, timeoutMs = 60_000): Promise<Buffer> {
  const ref = moduleFileRef(stored);
  if (!ref) throw new ModuleFileMissingError();
  if ("bucket" in ref) {
    const buf = await getObjectBuffer(ref.bucket, ref.key);
    if (!buf) throw new ModuleFileMissingError();
    return buf;
  }
  const res = await fetch(ref.external, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Could not download the PDF (HTTP ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

/** A short-lived link to the file, for a user who has already been checked. */
export async function moduleFileLink(stored: string, opts: { downloadName?: string; expiresInSeconds?: number } = {}): Promise<string | null> {
  const ref = moduleFileRef(stored);
  if (!ref) return null;
  if ("external" in ref) return ref.external;
  const name = (opts.downloadName || "").replace(/["\\\r\n]/g, "").trim();
  return signedGetUrl({
    bucket: ref.bucket,
    key: ref.key,
    expiresInSeconds: opts.expiresInSeconds ?? 600,
    contentType: "application/pdf",
    contentDisposition: name ? `attachment; filename*=UTF-8''${encodeURIComponent(name)}` : "inline",
  });
}

export async function deleteModuleFile(stored: string): Promise<boolean> {
  const ref = moduleFileRef(stored);
  if (!ref || !("bucket" in ref)) return false;
  await deleteObject(ref.bucket, ref.key);
  return true;
}

/** Same-origin link the browser uses for a module file. */
export function moduleFileRoute(moduleId: string, src: "original" | `export:${string}` | `version:${string}`): string {
  return `/api/team/modules/${encodeURIComponent(moduleId)}/file?src=${encodeURIComponent(src)}`;
}

/**
 * A module row as the browser may see it: every stored file value is replaced
 * by its /file link (source PDF, exports, saved revisions).
 */
export function withModuleFileRoutes<
  T extends {
    id: string;
    originalFileUrl?: string | null;
    exportHistory?: Array<{ id: string; fileUrl: string }>;
    versions?: Array<{ id: string; snapshot: unknown }>;
  },
>(m: T): T {
  const out = { ...m };
  if (typeof m.originalFileUrl === "string") out.originalFileUrl = m.originalFileUrl ? moduleFileRoute(m.id, "original") : "";
  if (m.exportHistory) out.exportHistory = m.exportHistory.map((e) => ({ ...e, fileUrl: moduleFileRoute(m.id, `export:${e.id}`) }));
  if (m.versions) out.versions = m.versions.map((v) => versionWithFileRoute(m.id, v));
  return out;
}

export function versionWithFileRoute<V extends { id: string; snapshot: unknown }>(moduleId: string, v: V): V {
  const snap = v.snapshot;
  if (!snap || typeof snap !== "object" || Array.isArray(snap)) return v;
  const fileUrl = (snap as { fileUrl?: unknown }).fileUrl;
  if (typeof fileUrl !== "string" || !fileUrl) return v;
  return { ...v, snapshot: { ...(snap as object), fileUrl: moduleFileRoute(moduleId, `version:${v.id}`) } };
}
