import "server-only";
import { getYoutubeChannelAccessToken, youtubeChannelConfigured } from "@/lib/youtube/channels";
import { parseIsoDuration } from "@/lib/youtube/video-stats";

export interface FetchedSourceItem {
  title: string;
  url: string;
  publishedAt: string; // ISO string
  sourceType: "YOUTUBE_RSS" | "YOUTUBE_API" | "GOOGLE_TRENDS" | "EDUCATION_NEWS";
  channelName?: string;
  videoId?: string;
  thumbnailUrl?: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  durationSec?: number | null;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1] ? decodeXmlEntities(m[1]) : null;
}

/**
 * Resolves a YouTube channel ID (UC...) from a raw ID or channel URL.
 */
export async function resolveYouTubeChannelId(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (/^UC[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{20,})/i);
  if (channelMatch?.[1]) return channelMatch[1];

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const isAllowedYouTubeHost =
        host === "youtube.com" ||
        host.endsWith(".youtube.com") ||
        host === "youtu.be";
      if (parsed.protocol !== "https:" || !isAllowedYouTubeHost) {
        return null;
      }
      const res = await fetch(parsed.toString(), {
        headers: { "User-Agent": "AtomicPathshalaStudio/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const html = await res.text();
      const metaMatch = html.match(/itemprop="channelId"\s+content="(UC[a-zA-Z0-9_-]{20,})"/i);
      if (metaMatch?.[1]) return metaMatch[1];
      const browseMatch = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{20,})"/);
      if (browseMatch?.[1]) return browseMatch[1];
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Fetches latest public videos for a YouTube channel via its official Atom RSS feed (0 API quota).
 */
export async function fetchYouTubeChannelRss(channelId: string): Promise<FetchedSourceItem[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "AtomicPathshalaStudio/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`YouTube RSS returned ${res.status} for channel ${channelId}`);
  }
  const xml = await res.text();
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];

  const items: FetchedSourceItem[] = [];
  for (const entry of entries.slice(0, 15)) {
    const videoId = extractTag(entry, "yt:videoId");
    const title = extractTag(entry, "title");
    const published = extractTag(entry, "published");
    const authorName = extractTag(entry, "name");
    const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/i);
    if (!videoId || !title) continue;
    items.push({
      title,
      url: linkMatch?.[1] || `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: published || new Date().toISOString(),
      sourceType: "YOUTUBE_RSS",
      channelName: authorName || undefined,
      videoId,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      views: null,
      likes: null,
      comments: null,
      durationSec: null,
    });
  }
  return items;
}

async function getOptionalYouTubeAuth(): Promise<{ token?: string; apiKey?: string }> {
  if (youtubeChannelConfigured("MAIN")) {
    try {
      const token = await getYoutubeChannelAccessToken("MAIN");
      return { token };
    } catch {
      // fall through
    }
  }
  if (youtubeChannelConfigured("APP")) {
    try {
      const token = await getYoutubeChannelAccessToken("APP");
      return { token };
    } catch {
      // fall through
    }
  }
  if (process.env.YOUTUBE_API_KEY) {
    return { apiKey: process.env.YOUTUBE_API_KEY };
  }
  return {};
}

/**
 * Enriches YouTube video IDs with real statistics & duration via YouTube Data API v3 (1 quota unit per 50 videos).
 */
export async function enrichYouTubeVideos(
  videoIds: string[]
): Promise<Map<string, { views: number | null; likes: number | null; comments: number | null; durationSec: number | null; channelTitle?: string }>> {
  const map = new Map<string, { views: number | null; likes: number | null; comments: number | null; durationSec: number | null; channelTitle?: string }>();
  if (videoIds.length === 0) return map;

  const auth = await getOptionalYouTubeAuth();
  if (!auth.token && !auth.apiKey) return map;

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const qs = new URLSearchParams({
      part: "snippet,contentDetails,statistics",
      id: batch.join(","),
      ...(auth.apiKey ? { key: auth.apiKey } : {}),
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${qs.toString()}`, {
      headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : undefined,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) continue;

    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet?: { channelTitle?: string };
        contentDetails?: { duration?: string };
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      }>;
    };

    for (const item of data.items || []) {
      const dur = item.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null;
      map.set(item.id, {
        views: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
        likes: item.statistics?.likeCount ? Number(item.statistics.likeCount) : null,
        comments: item.statistics?.commentCount ? Number(item.statistics.commentCount) : null,
        durationSec: dur,
        channelTitle: item.snippet?.channelTitle,
      });
    }
  }
  return map;
}

/**
 * Searches YouTube Data API v3 for recent high-view videos in India for a topic query (if configured).
 */
export async function searchYouTubeTrends(query: string, maxResults = 8): Promise<FetchedSourceItem[]> {
  const auth = await getOptionalYouTubeAuth();
  if (!auth.token && !auth.apiKey) return [];

  const publishedAfter = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const qs = new URLSearchParams({
    part: "snippet",
    type: "video",
    order: "viewCount",
    regionCode: "IN",
    publishedAfter,
    q: query,
    maxResults: String(maxResults),
    ...(auth.apiKey ? { key: auth.apiKey } : {}),
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${qs.toString()}`, {
    headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { high?: { url?: string } };
      };
    }>;
  };

  const ids = (data.items || []).map((i) => i.id?.videoId).filter((v): v is string => Boolean(v));
  const stats = await enrichYouTubeVideos(ids);

  return (data.items || [])
    .filter((i) => i.id?.videoId && i.snippet?.title)
    .map((i) => {
      const vid = i.id!.videoId!;
      const s = stats.get(vid);
      return {
        title: i.snippet!.title!,
        url: `https://www.youtube.com/watch?v=${vid}`,
        publishedAt: i.snippet!.publishedAt || new Date().toISOString(),
        sourceType: "YOUTUBE_API" as const,
        channelName: i.snippet?.channelTitle,
        videoId: vid,
        thumbnailUrl: i.snippet?.thumbnails?.high?.url,
        views: s?.views ?? null,
        likes: s?.likes ?? null,
        comments: s?.comments ?? null,
        durationSec: s?.durationSec ?? null,
      };
    });
}

/**
 * Fetches real Google Trends India daily trending RSS items (0 auth required).
 */
export async function fetchGoogleTrendsIndia(): Promise<FetchedSourceItem[]> {
  try {
    const res = await fetch("https://trends.google.com/trending/rss?geo=IN", {
      headers: { "User-Agent": "AtomicPathshalaStudio/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const out: FetchedSourceItem[] = [];
    for (const item of items.slice(0, 15)) {
      const title = extractTag(item, "title");
      const link = extractTag(item, "link");
      const pubDate = extractTag(item, "pubDate");
      if (!title) continue;
      out.push({
        title,
        url: link || "https://trends.google.com/trending?geo=IN",
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        sourceType: "GOOGLE_TRENDS",
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Fetches legitimate public news RSS for Indian education / NTA / NCERT / NEET / JEE updates.
 */
export async function fetchEducationNewsRss(query: string): Promise<FetchedSourceItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "AtomicPathshalaStudio/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const out: FetchedSourceItem[] = [];
    for (const item of items.slice(0, 10)) {
      const title = extractTag(item, "title");
      const link = extractTag(item, "link");
      const pubDate = extractTag(item, "pubDate");
      if (!title || !link) continue;
      out.push({
        title,
        url: link,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        sourceType: "EDUCATION_NEWS",
      });
    }
    return out;
  } catch {
    return [];
  }
}
