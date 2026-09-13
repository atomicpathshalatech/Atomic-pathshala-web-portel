import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/response";

/**
 * Admin-only diagnostic: confirms YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN are
 * actually configured and the refresh token actually works, WITHOUT ever
 * returning the token/secret values themselves — only booleans, Google's own
 * error code on failure, and (on success) the non-sensitive channel
 * name/id the token resolves to, so whoever authorized it can literally
 * confirm it's the right channel. Nothing here touches the upload feature
 * (not built yet) or the live-class streaming/recording pipeline.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_CONFIG_MANAGE);

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    const configured = {
      YOUTUBE_CLIENT_ID: Boolean(clientId),
      YOUTUBE_CLIENT_SECRET: Boolean(clientSecret),
      YOUTUBE_REFRESH_TOKEN: Boolean(refreshToken),
    };

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json({ success: false, configured, error: "One or more required env vars are missing." }, { status: 500 });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokenJson: { access_token?: string; scope?: string; error?: string; error_description?: string } = await tokenRes.json();

    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("[youtube_oauth_verify_error]", tokenJson.error, tokenJson.error_description);
      return NextResponse.json(
        { success: false, configured, refreshTokenValid: false, googleError: tokenJson.error, googleErrorDescription: tokenJson.error_description },
        { status: 400 }
      );
    }

    let channel: { id?: string; title?: string } = {};
    try {
      const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const channelJson = await channelRes.json();
      const item = channelJson?.items?.[0];
      if (item) channel = { id: item.id, title: item.snippet?.title };
    } catch (err) {
      console.error("[youtube_oauth_verify_channel_lookup_error]", err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      success: true,
      configured,
      refreshTokenValid: true,
      grantedScope: tokenJson.scope,
      channel,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
