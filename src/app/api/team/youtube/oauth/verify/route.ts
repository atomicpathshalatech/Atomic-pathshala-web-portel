import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/response";
import {
  YOUTUBE_CHANNEL_KEYS,
  clearCachedYoutubeToken,
  fetchAuthorizedChannel,
  getYoutubeChannelConfig,
  youtubeChannelMisconfiguration,
} from "@/lib/youtube/channels";
import { classifyYoutubeError, describeYoutubeError } from "@/lib/youtube/errors";

/**
 * Admin-only diagnostic for BOTH YouTube channels (APP and MAIN): confirms
 * each channel's credentials are configured, its refresh token works, and
 * the token resolves to the channel id configured for it — WITHOUT ever
 * returning a token or secret. Only env var names, booleans, Google's error
 * reason, and the non-sensitive channel name/id.
 *
 * Costs 1 quota unit per configured channel (channels.list?mine=true).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_CONFIG_MANAGE);

    const channels = await Promise.all(
      YOUTUBE_CHANNEL_KEYS.map(async (key) => {
        const cfg = getYoutubeChannelConfig(key);
        const configured = {
          clientId: Boolean(cfg.clientId),
          clientSecret: Boolean(cfg.clientSecret),
          refreshToken: Boolean(cfg.refreshToken),
          refreshTokenEnv: cfg.refreshTokenEnv,
          expectedChannelId: cfg.expectedChannelId ?? null,
          channelIdEnv: cfg.channelIdEnv,
        };
        if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken) {
          return { channel: key, ok: false, configured, error: "Not configured." };
        }
        try {
          clearCachedYoutubeToken(key); // always test a fresh token exchange
          const authorized = await fetchAuthorizedChannel(key);
          const identityMatches = Boolean(authorized && cfg.expectedChannelId && authorized.id === cfg.expectedChannelId);
          return {
            channel: key,
            ok: identityMatches,
            configured,
            refreshTokenValid: true,
            authorizedChannel: authorized,
            identityMatches,
            ...(cfg.expectedChannelId
              ? identityMatches
                ? {}
                : { error: `Token belongs to ${authorized?.id ?? "no channel"}, but ${cfg.channelIdEnv} is ${cfg.expectedChannelId}.` }
              : { error: `${cfg.channelIdEnv} is not set, so the server cannot verify this channel's identity.` }),
          };
        } catch (err) {
          return {
            channel: key,
            ok: false,
            configured,
            refreshTokenValid: classifyYoutubeError(err) !== "AUTH_REVOKED",
            errorKind: classifyYoutubeError(err),
            error: describeYoutubeError(err),
          };
        }
      })
    );

    const misconfiguration = youtubeChannelMisconfiguration();
    return NextResponse.json({
      success: !misconfiguration && channels.every((c) => c.ok || !c.configured.refreshToken),
      misconfiguration,
      channels,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
