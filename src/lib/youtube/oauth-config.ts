/**
 * Fixed production base URL, deliberately NOT derived from the incoming
 * request's Host header or from NEXTAUTH_URL/APP_URL (both of which point
 * at other domains in this project's env — see .env). Google requires an
 * OAuth redirect_uri to match a pre-registered value byte-for-byte, so this
 * constant must always equal exactly what's entered in Google Cloud
 * Console's "Authorized redirect URIs" for the "Atomic Pathshala YouTube
 * Uploader" OAuth client — a request-derived value would silently break the
 * moment this route is hit from any other host (a preview deployment, the
 * bare *.vercel.app domain, etc.).
 */
export const YOUTUBE_OAUTH_PRODUCTION_URL = "https://ap.atomicpathshala.in";

export const YOUTUBE_OAUTH_REDIRECT_URI = `${YOUTUBE_OAUTH_PRODUCTION_URL}/api/team/youtube/oauth/callback`;
