import "server-only";
import { prisma } from "@/lib/db";
import { youtubeApi } from "@/lib/youtube/client";
import { youtubeChannelConfigured } from "@/lib/youtube/channels";

/** "PT1H10M5S" → 4205 (YouTube's ISO-8601 video duration). Null if unreadable. */
export function parseIsoDuration(iso: string | null | undefined): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? "");
  if (!m || iso === "P" || iso === "PT") return null;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d! * 86400 + h! * 3600 + min! * 60 + s!;
}

type VideosListResponse = {
  items?: Array<{
    id: string;
    snippet?: { title?: string };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string };
  }>;
};

/**
 * Fetches length + views for up to thousands of videos, 50 per call
 * (videos.list costs 1 quota unit per call). Videos YouTube no longer
 * returns (private/deleted) are marked with an error, keeping their last
 * known numbers. Returns how many were updated.
 */
export async function refreshYoutubeVideoStats(videoIds: string[]): Promise<{ updated: number; missing: number; ok: boolean }> {
  const ids = Array.from(new Set(videoIds.filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id))));
  if (ids.length === 0) return { updated: 0, missing: 0, ok: true };
  if (!youtubeChannelConfigured("APP")) return { updated: 0, missing: 0, ok: false };

  let updated = 0;
  let missing = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const res = await youtubeApi<VideosListResponse>("APP", "/videos", {
      operation: "videos.list(stats)",
      query: { part: "snippet,contentDetails,statistics", id: chunk.join(","), maxResults: "50" },
    });
    const found = new Set<string>();
    for (const item of res.items ?? []) {
      found.add(item.id);
      const durationSec = parseIsoDuration(item.contentDetails?.duration);
      const viewCount = Math.min(2_000_000_000, Number(item.statistics?.viewCount ?? 0) || 0);
      await prisma.youtubeVideoStat.upsert({
        where: { videoId: item.id },
        create: { videoId: item.id, durationSec, viewCount, title: item.snippet?.title ?? null, error: null, fetchedAt: new Date() },
        update: { durationSec, viewCount, title: item.snippet?.title ?? null, error: null, fetchedAt: new Date() },
      });
      updated++;
    }
    for (const id of chunk) {
      if (found.has(id)) continue;
      missing++;
      await prisma.youtubeVideoStat.upsert({
        where: { videoId: id },
        create: { videoId: id, error: "Not returned by YouTube (private, deleted or wrong id)", fetchedAt: new Date() },
        update: { error: "Not returned by YouTube (private, deleted or wrong id)", fetchedAt: new Date() },
      });
    }
  }
  return { updated, missing, ok: true };
}
