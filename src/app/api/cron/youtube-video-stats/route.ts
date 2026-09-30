import { NextRequest, NextResponse } from "next/server";
import { allClassVideoIds } from "@/lib/teaching/stats";
import { refreshYoutubeVideoStats } from "@/lib/youtube/video-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed in production: an unset secret must not leave the route open.
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily: refreshes length + view count of every class video from YouTube
 * (teachers' teaching time for recorded classes and their view totals).
 * ~1 quota unit per 50 videos.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const ids = await allClassVideoIds();
    const result = await refreshYoutubeVideoStats(ids);
    return NextResponse.json({ videos: ids.length, ...result });
  } catch (err) {
    console.error("[cron_youtube_video_stats]", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
