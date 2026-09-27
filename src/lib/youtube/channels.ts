import "server-only";
import { YoutubeApiError, extractYoutubeErrorReason, classifyYoutubeResponse } from "@/lib/youtube/errors";

/**
 * Atomic Pathshala operates two YouTube channels, and their credentials,
 * resources and lifecycle state must never mix:
 *
 *   APP  — the channel connected to the Atomic app. Atomic creates unlisted
 *          live broadcasts and ingest streams here for App classes, and
 *          archives recordings here.
 *   MAIN — the main public channel. Teachers run classes there directly;
 *          Atomic only ever READS it (to verify and map an existing video or
 *          broadcast to a class). Nothing in Atomic creates resources on MAIN.
 *
 * Each channel has its own refresh token, its own access-token cache and its
 * own expected channel id. When the expected id is configured, the first API
 * use of a channel in a process verifies that the refresh token really
 * belongs to that channel (channels.list?mine=true, 1 quota unit) and
 * refuses to operate otherwise — so a MAIN token pasted into the APP slot
 * can't silently create App classes on the main channel.
 *
 * Env (APP falls back to the original single-channel variables):
 *   YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET            shared OAuth client
 *   YOUTUBE_APP_REFRESH_TOKEN  (or YOUTUBE_REFRESH_TOKEN)
 *   YOUTUBE_APP_CHANNEL_ID     (or YOUTUBE_CHANNEL_ID)
 *   YOUTUBE_MAIN_REFRESH_TOKEN
 *   YOUTUBE_MAIN_CHANNEL_ID
 */

export type YoutubeChannelKey = "APP" | "MAIN";
export const YOUTUBE_CHANNEL_KEYS: readonly YoutubeChannelKey[] = ["APP", "MAIN"];

export interface YoutubeChannelConfig {
  key: YoutubeChannelKey;
  clientId: string | undefined;
  clientSecret: string | undefined;
  refreshToken: string | undefined;
  /** Expected YouTube channel id (UC…). Optional, but strongly recommended. */
  expectedChannelId: string | undefined;
  /** Env var names, for admin-facing diagnostics — never values. */
  refreshTokenEnv: string;
  channelIdEnv: string;
}

export function getYoutubeChannelConfig(key: YoutubeChannelKey): YoutubeChannelConfig {
  const clientId = process.env[`YOUTUBE_${key}_CLIENT_ID`] || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env[`YOUTUBE_${key}_CLIENT_SECRET`] || process.env.YOUTUBE_CLIENT_SECRET;
  if (key === "APP") {
    return {
      key,
      clientId,
      clientSecret,
      refreshToken: process.env.YOUTUBE_APP_REFRESH_TOKEN || process.env.YOUTUBE_REFRESH_TOKEN,
      expectedChannelId: process.env.YOUTUBE_APP_CHANNEL_ID || process.env.YOUTUBE_CHANNEL_ID,
      refreshTokenEnv: process.env.YOUTUBE_APP_REFRESH_TOKEN ? "YOUTUBE_APP_REFRESH_TOKEN" : "YOUTUBE_REFRESH_TOKEN",
      channelIdEnv: process.env.YOUTUBE_APP_CHANNEL_ID ? "YOUTUBE_APP_CHANNEL_ID" : "YOUTUBE_CHANNEL_ID",
    };
  }
  return {
    key,
    clientId,
    clientSecret,
    refreshToken: process.env.YOUTUBE_MAIN_REFRESH_TOKEN,
    expectedChannelId: process.env.YOUTUBE_MAIN_CHANNEL_ID,
    refreshTokenEnv: "YOUTUBE_MAIN_REFRESH_TOKEN",
    channelIdEnv: "YOUTUBE_MAIN_CHANNEL_ID",
  };
}

export function youtubeChannelConfigured(key: YoutubeChannelKey): boolean {
  const cfg = getYoutubeChannelConfig(key);
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.refreshToken);
}

/**
 * Configuration mistakes that would make the two channels collide. Checked
 * before every token fetch — cheap (env reads only) and it has to hold for
 * either channel to be trusted.
 */
export function youtubeChannelMisconfiguration(): string | null {
  const app = getYoutubeChannelConfig("APP");
  const main = getYoutubeChannelConfig("MAIN");
  if (app.refreshToken && main.refreshToken && app.refreshToken === main.refreshToken) {
    return "APP and MAIN YouTube channels are configured with the same refresh token.";
  }
  if (app.expectedChannelId && main.expectedChannelId && app.expectedChannelId === main.expectedChannelId) {
    return "APP and MAIN YouTube channels are configured with the same channel id.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Access tokens — one cache per channel. Module scope, so reused within one
// warm serverless instance; a cold instance just refreshes again (cheap, no
// quota cost).
// ---------------------------------------------------------------------------

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}
const tokenCache = new Map<YoutubeChannelKey, CachedToken>();

export function clearCachedYoutubeToken(key?: YoutubeChannelKey): void {
  if (key) tokenCache.delete(key);
  else tokenCache.clear();
}

export async function getYoutubeChannelAccessToken(key: YoutubeChannelKey, forceFresh = false): Promise<string> {
  const cached = tokenCache.get(key);
  if (!forceFresh && cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;

  const misconfig = youtubeChannelMisconfiguration();
  if (misconfig) {
    throw new YoutubeApiError({ kind: "CONFIG", status: null, reason: "channelMisconfigured", operation: "token refresh", detail: misconfig });
  }

  const cfg = getYoutubeChannelConfig(key);
  if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
    throw new YoutubeApiError({
      kind: "CONFIG",
      status: null,
      reason: "notConfigured",
      operation: "token refresh",
      detail: `YouTube OAuth credentials are not configured for the ${key} channel (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / ${cfg.refreshTokenEnv}).`,
    });
  }

  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: cfg.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new YoutubeApiError({
      kind: "NETWORK",
      status: null,
      reason: null,
      operation: `${key} token refresh`,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const text = await res.text().catch(() => "");
  let json: { access_token?: string; expires_in?: number } = {};
  try {
    json = JSON.parse(text);
  } catch {
    // handled below
  }
  if (!res.ok || !json.access_token) {
    const reason = extractYoutubeErrorReason(text);
    throw new YoutubeApiError({
      kind: reason === "invalid_grant" ? "AUTH_REVOKED" : classifyYoutubeResponse(res.status, reason),
      status: res.status,
      reason,
      operation: `${key} token refresh`,
    });
  }

  tokenCache.set(key, { accessToken: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Channel identity verification
// ---------------------------------------------------------------------------

const IDENTITY_TTL_MS = 6 * 60 * 60 * 1000;
const verifiedIdentity = new Map<YoutubeChannelKey, { channelId: string; at: number }>();
const warnedUnverified = new Set<YoutubeChannelKey>();

export function clearVerifiedYoutubeChannelIdentity(key?: YoutubeChannelKey): void {
  if (key) verifiedIdentity.delete(key);
  else verifiedIdentity.clear();
}

/** channels.list?mine=true with the channel's own token. 1 quota unit. */
export async function fetchAuthorizedChannel(
  key: YoutubeChannelKey
): Promise<{ id: string; title: string | null } | null> {
  const token = await getYoutubeChannelAccessToken(key);
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    const reason = extractYoutubeErrorReason(text);
    throw new YoutubeApiError({ kind: classifyYoutubeResponse(res.status, reason), status: res.status, reason, operation: `${key} channels.list` });
  }
  const item = JSON.parse(text)?.items?.[0];
  return item?.id ? { id: item.id, title: item.snippet?.title ?? null } : null;
}

/**
 * Confirms the channel's refresh token belongs to its configured channel id.
 * Cached per process. With no expected id configured this can't verify
 * anything — it logs once per process and lets the call through, so existing
 * single-channel deployments keep working until the id is set.
 */
export async function ensureYoutubeChannelIdentity(key: YoutubeChannelKey): Promise<void> {
  const cfg = getYoutubeChannelConfig(key);
  if (!cfg.expectedChannelId) {
    if (!warnedUnverified.has(key)) {
      warnedUnverified.add(key);
      console.warn(`[youtube_channel_unverified] ${cfg.channelIdEnv} is not set — cannot verify which channel the ${key} token belongs to.`);
    }
    return;
  }

  const hit = verifiedIdentity.get(key);
  if (hit && hit.channelId === cfg.expectedChannelId && Date.now() - hit.at < IDENTITY_TTL_MS) return;

  const channel = await fetchAuthorizedChannel(key);
  if (!channel || channel.id !== cfg.expectedChannelId) {
    throw new YoutubeApiError({
      kind: "CONFIG",
      status: null,
      reason: "channelIdentityMismatch",
      operation: `${key} channel identity check`,
      detail: `channel identity mismatch: ${cfg.refreshTokenEnv} belongs to ${channel?.id ?? "no channel"}, expected ${cfg.expectedChannelId} (${cfg.channelIdEnv}).`,
    });
  }
  verifiedIdentity.set(key, { channelId: channel.id, at: Date.now() });
}
