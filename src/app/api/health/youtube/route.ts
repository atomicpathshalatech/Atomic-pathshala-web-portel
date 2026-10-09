import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Is the server's YouTube sign-in working? Answers with status words only
 * (never a token, key or id). Cached for 10 minutes: one check costs 1–2 of
 * the day's YouTube quota units.
 */
let cached: { at: number; body: Record<string, unknown> } | null = null;

export async function GET(request: NextRequest) {
  if (cached && Date.now() - cached.at < 10 * 60_000) return NextResponse.json({ ...cached.body, cached: true });
  const body: Record<string, unknown> = {};
  try {
    const { youtubeChannelConfigured } = await import("@/lib/youtube/channels");
    body.appChannelConfigured = youtubeChannelConfigured("APP");
    body.mainChannelConfigured = youtubeChannelConfigured("MAIN");
    if (body.appChannelConfigured) {
      const { youtubeApi } = await import("@/lib/youtube/client");
      const describe = (e: unknown) => {
        const err = e as { kind?: string; status?: number; reason?: string; message?: string };
        return { ok: false, kind: err?.kind ?? "UNKNOWN", status: err?.status ?? null, reason: String(err?.reason ?? "").slice(0, 80), message: String(err?.message ?? e).replace(/ya29\.[\w.-]+/g, "<token>").slice(0, 200) };
      };
      try {
        const me = await youtubeApi<{ items?: Array<{ snippet?: { title?: string } }> }>("APP", "/channels", { operation: "channels.list", query: { part: "snippet", mine: "true" } });
        body.signIn = { ok: true, channelTitle: me.items?.[0]?.snippet?.title ?? null };
      } catch (e) {
        body.signIn = describe(e);
      }
      const v = request.nextUrl.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) {
        try {
          const j = await youtubeApi<{ items?: Array<{ snippet?: { channelTitle?: string }; status?: { privacyStatus?: string; embeddable?: boolean }; liveStreamingDetails?: { activeLiveChatId?: string; actualEndTime?: string } }> }>("APP", "/videos", { operation: "videos.list", query: { part: "snippet,status,liveStreamingDetails", id: v } });
          const it = j.items?.[0];
          body.video = it
            ? { visible: true, channelTitle: it.snippet?.channelTitle, privacy: it.status?.privacyStatus, embeddable: it.status?.embeddable, hasActiveLiveChat: Boolean(it.liveStreamingDetails?.activeLiveChatId), ended: Boolean(it.liveStreamingDetails?.actualEndTime) }
            : { visible: false };
        } catch (e) {
          body.video = describe(e);
        }
      }
    }
  } catch (e) {
    body.error = String((e as Error)?.message ?? e).slice(0, 200);
  }
  cached = { at: Date.now(), body };
  return NextResponse.json(body);
}
