import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/response";
import { YOUTUBE_OAUTH_REDIRECT_URI } from "@/lib/youtube/oauth-config";

/**
 * Step 1 of the one-time, admin-only YouTube channel authorization flow —
 * NOT a per-user login (this app has no Google sign-in provider; NextAuth's
 * own [...nextauth] route is unrelated). This is run once by a platform
 * admin to grant this backend offline (refresh-token) access to upload
 * videos on the Atomic Pathshala YouTube channel. Never called by students
 * or teachers, and never wired into the live-class streaming path — it only
 * produces a refresh token for whoever runs the archive-upload feature
 * later.
 *
 * `state` is a random nonce stored in a short-lived httpOnly cookie and
 * re-checked in the callback, the standard CSRF defense for the OAuth
 * "authorization code" flow (defense in depth alongside the callback's own
 * permission check).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_CONFIG_MANAGE);

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "YOUTUBE_CLIENT_ID is not configured on this environment." },
        { status: 500 }
      );
    }

    const state = crypto.randomBytes(24).toString("hex");
    cookies().set("yt_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600, // 10 minutes — this is a short, interactive, one-time admin flow
      path: "/api/team/youtube/oauth",
    });

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", YOUTUBE_OAUTH_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    // Forces Google to return a refresh_token even if this admin/browser
    // already granted consent before — without this, a re-run of the flow
    // (e.g. after accidentally losing the first refresh token) can silently
    // return no refresh_token at all.
    url.searchParams.set("prompt", "consent");
    // youtube.upload alone is sufficient for the actual archive-upload
    // feature (videos.insert doesn't need a channel lookup first), but it is
    // NOT enough to call channels.list() for the admin-facing "which channel
    // is this?" verification step (confirmed live: Google returns 403
    // ACCESS_TOKEN_SCOPE_INSUFFICIENT for that call with upload-only scope).
    // youtube.readonly is added solely so that verification can resolve and
    // display the authorized channel's name/id.
    url.searchParams.set(
      "scope",
      ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"].join(" ")
    );
    url.searchParams.set("state", state);

    return NextResponse.redirect(url.toString());
  } catch (error) {
    return handleApiError(error);
  }
}
