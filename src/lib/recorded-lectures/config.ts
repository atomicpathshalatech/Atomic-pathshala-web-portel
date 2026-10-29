/**
 * Configuration of the separate recorded-lecture R2 account — pure (no SDK,
 * no server-only import) so it is unit tested in scripts/test-recorded-lectures.ts.
 *
 *   RECORDED_R2_ACCOUNT_ID         Cloudflare account id of the NEW account
 *   RECORDED_R2_ACCESS_KEY_ID      R2 API token key id (that account)
 *   RECORDED_R2_SECRET_ACCESS_KEY  R2 API token secret (that account)
 *   RECORDED_R2_BUCKET_NAME        bucket for recorded lectures
 *   RECORDED_R2_ENDPOINT           optional; default https://<account>.r2.cloudflarestorage.com
 *   RECORDED_R2_PUBLIC_BASE_URL    optional; not used for playback (always signed)
 *   RECORDED_LECTURE_MAX_BYTES     optional upload limit (default 10 GiB)
 *
 * Only RECORDED_* variables are read. The main account's R2_* /
 * CLOUDFLARE_ACCOUNT_ID are looked at for one reason: to refuse a
 * configuration that points at the main account's bucket.
 */

export type RecordedStorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  maxBytes: number;
};

export const DEFAULT_MAX_BYTES = 10 * 1024 ** 3;

const clean = (v: string | undefined) => (v ?? "").replace(/^["']|["']$/g, "").trim();

export function resolveRecordedStorageConfig(
  env: Record<string, string | undefined>
): { ok: true; config: RecordedStorageConfig } | { ok: false; problems: string[] } {
  const accountId = clean(env.RECORDED_R2_ACCOUNT_ID);
  const accessKeyId = clean(env.RECORDED_R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(env.RECORDED_R2_SECRET_ACCESS_KEY);
  const bucket = clean(env.RECORDED_R2_BUCKET_NAME);
  const explicitEndpoint = clean(env.RECORDED_R2_ENDPOINT).replace(/\/+$/, "");

  const problems: string[] = [];
  if (!accountId && !explicitEndpoint) problems.push("RECORDED_R2_ACCOUNT_ID (or RECORDED_R2_ENDPOINT) is missing");
  if (!accessKeyId) problems.push("RECORDED_R2_ACCESS_KEY_ID is missing");
  if (!secretAccessKey) problems.push("RECORDED_R2_SECRET_ACCESS_KEY is missing");
  if (!bucket) problems.push("RECORDED_R2_BUCKET_NAME is missing");

  // Never share the main account: same account id, same key or same bucket
  // name as the main storage is refused, not silently accepted.
  const mainAccount = clean(env.CLOUDFLARE_ACCOUNT_ID);
  const mainKey = clean(env.R2_ACCESS_KEY_ID);
  const mainBuckets = [clean(env.R2_BUCKET_NAME), clean(env.R2_PRIVATE_BUCKET_NAME)].filter(Boolean);
  if (accountId && mainAccount && accountId === mainAccount) {
    problems.push("RECORDED_R2_ACCOUNT_ID is the main Cloudflare account — recorded lectures need their own account");
  }
  if (accessKeyId && mainKey && accessKeyId === mainKey) {
    problems.push("RECORDED_R2_ACCESS_KEY_ID is the main account's key — create a key in the recorded-lecture account");
  }
  if (bucket && mainBuckets.includes(bucket) && (!accountId || !mainAccount || accountId === mainAccount)) {
    problems.push("RECORDED_R2_BUCKET_NAME is the main storage bucket");
  }

  const maxRaw = Number(clean(env.RECORDED_LECTURE_MAX_BYTES));
  const maxBytes = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : DEFAULT_MAX_BYTES;

  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    config: {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      endpoint: explicitEndpoint || `https://${accountId}.r2.cloudflarestorage.com`,
      maxBytes,
    },
  };
}

/** Configuration state for the admin screen — problems only, never values. */
export function recordedStorageStatus(env: Record<string, string | undefined> = process.env) {
  const r = resolveRecordedStorageConfig(env);
  return r.ok ? { ready: true as const, maxBytes: r.config.maxBytes, problems: [] as string[] } : { ready: false as const, maxBytes: 0, problems: r.problems };
}
