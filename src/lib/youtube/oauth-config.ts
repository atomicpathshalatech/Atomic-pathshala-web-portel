/**
 * Production base URL for the YouTube OAuth flow. Defaults to the real
 * production domain — NOT derived from the incoming request's Host header
 * or from NEXTAUTH_URL/APP_URL (both of which point at other domains in
 * this project's env) — but can be overridden via YOUTUBE_OAUTH_PRODUCTION_URL
 * if the env var is set, without needing a code change/redeploy-from-git.
 *
 * Whatever this resolves to, the corresponding /api/team/youtube/oauth/callback
 * URL MUST exactly match — byte-for-byte — an "Authorized redirect URI"
 * already registered on the "Atomic Pathshala YouTube Uploader" OAuth
 * client in Google Cloud Console. If you override this env var, update the
 * registered redirect URI in Google Cloud first, or the OAuth flow will
 * fail with redirect_uri_mismatch.
 */
export const YOUTUBE_OAUTH_PRODUCTION_URL = process.env.YOUTUBE_OAUTH_PRODUCTION_URL || "https://ap.atomicpathshala.in";

/**
 * The exact redirect_uri sent to Google and used again in the token
 * exchange. Defaults to `${YOUTUBE_OAUTH_PRODUCTION_URL}/api/team/youtube/oauth/callback`,
 * but can be set directly via YOUTUBE_OAUTH_REDIRECT_URI to override the
 * whole value (not just the base) if ever needed.
 */
export const YOUTUBE_OAUTH_REDIRECT_URI =
  process.env.YOUTUBE_OAUTH_REDIRECT_URI || `${YOUTUBE_OAUTH_PRODUCTION_URL}/api/team/youtube/oauth/callback`;
