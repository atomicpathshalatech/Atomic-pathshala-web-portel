import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { YOUTUBE_OAUTH_REDIRECT_URI } from "@/lib/youtube/oauth-config";

function htmlPage(bodyHtml: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>YouTube Channel Authorization</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;line-height:1.5;color:#111">${bodyHtml}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/**
 * Step 2 of the one-time, admin-only YouTube channel authorization flow —
 * this is where Google redirects back to after the admin consents on
 * accounts.google.com. Exchanges the one-time `code` for tokens and shows
 * the refresh token exactly once so it can be copied into the
 * YOUTUBE_REFRESH_TOKEN environment variable — this route never persists it
 * anywhere itself (no DB write here), matching the requirement that the
 * refresh token lives only as a server-side secret, never in application
 * data. Never logs the token or the exchanged access token.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_CONFIG_MANAGE);
  } catch {
    return htmlPage("<h1>Not authorized</h1><p>Sign in as an admin with security-config access and restart the flow.</p>", 403);
  }

  const { searchParams } = request.nextUrl;

  const googleError = searchParams.get("error");
  if (googleError) {
    return htmlPage(`<h1>Authorization declined</h1><p>Google returned: <code>${googleError}</code>. No changes were made.</p>`, 400);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = cookies().get("yt_oauth_state")?.value;
  cookies().delete("yt_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return htmlPage(
      "<h1>Invalid or expired request</h1><p>This authorization link is missing its verification token or has expired. Start the flow again from the admin panel.</p>",
      400
    );
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return htmlPage("<h1>Not configured</h1><p>YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET are missing on this environment.</p>", 500);
  }

  let tokenJson: { refresh_token?: string; access_token?: string; scope?: string; expires_in?: number; error?: string; error_description?: string };
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: YOUTUBE_OAUTH_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      // Never log tokenJson itself — it may echo back sensitive request
      // parameters. Log only Google's own error code/description.
      console.error("[youtube_oauth_callback_error]", tokenJson.error, tokenJson.error_description);
      return htmlPage(
        `<h1>Token exchange failed</h1><p>Google said: <code>${tokenJson.error ?? "unknown_error"}</code> — ${tokenJson.error_description ?? ""}</p>`,
        400
      );
    }
  } catch (err) {
    console.error("[youtube_oauth_callback_network_error]", err instanceof Error ? err.message : err);
    return htmlPage("<h1>Network error</h1><p>Could not reach Google's token endpoint. Try again.</p>", 502);
  }

  if (!tokenJson.refresh_token) {
    return htmlPage(
      "<h1>No refresh token returned</h1>" +
        "<p>Google did not return a refresh token. This usually means this exact Google account has already " +
        "granted this app consent before and Google chose not to re-issue one. Remove the app's access at " +
        "<a href=\"https://myaccount.google.com/permissions\">myaccount.google.com/permissions</a> for " +
        "\"Atomic Pathshala YouTube Uploader\", then restart the flow.</p>",
      409
    );
  }

  return htmlPage(
    "<h1>YouTube channel authorized</h1>" +
      "<p>Copy the value below into this environment's <code>YOUTUBE_REFRESH_TOKEN</code> secret, then close this page. " +
      "It will not be shown again — if lost, just restart this flow.</p>" +
      `<pre style="background:#f4f4f5;border:1px solid #ddd;border-radius:8px;padding:16px;white-space:pre-wrap;word-break:break-all;user-select:all">${tokenJson.refresh_token}</pre>` +
      "<p style=\"color:#666;font-size:14px\">Granted scope: " +
      `<code>${tokenJson.scope ?? "unknown"}</code></p>`
  );
}
