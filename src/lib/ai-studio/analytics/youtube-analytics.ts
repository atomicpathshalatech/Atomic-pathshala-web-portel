import "server-only";
import {
  getYoutubeChannelAccessToken,
  YoutubeChannelKey,
  youtubeChannelConfigured,
} from "@/lib/youtube/channels";
import { parseIsoDuration } from "@/lib/youtube/video-stats";

export interface ChannelVideoMetric {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSec: number;
  format: "SHORTS" | "LONG" | "LIVE";
  views: number;
  likes: number | null;
  comments: number | null;
  thumbnailUrl: string | null;
  url: string;
}

export interface FetchedChannelAnalytics {
  channelKey: YoutubeChannelKey;
  dataSourcesAvailable: {
    dataApi: boolean;
    analyticsApi: boolean;
    limitations: string[];
  };
  channelMetrics: {
    channelTitle: string | null;
    subscriberCount: number | null;
    totalViews: number | null;
    videoCount: number | null;
    // YouTube Analytics API fields (null if scope unavailable)
    recent28dViews: number | null;
    estimatedMinutesWatched: number | null;
    averageViewDurationSec: number | null;
    averageViewPercentage: number | null;
    subscribersGained28d: number | null;
    impressions: number | null;
    ctrPercent: number | null;
    returningViewers: number | null;
    trafficSources: Array<{ source: string; views: number }>;
  };
  videos: ChannelVideoMetric[];
}

export async function fetchChannelAnalyticsData(
  channelKey: YoutubeChannelKey
): Promise<FetchedChannelAnalytics> {
  const limitations: string[] = [];
  let dataApiOk = false;
  let analyticsApiOk = false;

  const metrics: FetchedChannelAnalytics["channelMetrics"] = {
    channelTitle: null,
    subscriberCount: null,
    totalViews: null,
    videoCount: null,
    recent28dViews: null,
    estimatedMinutesWatched: null,
    averageViewDurationSec: null,
    averageViewPercentage: null,
    subscribersGained28d: null,
    impressions: null,
    ctrPercent: null,
    returningViewers: null,
    trafficSources: [],
  };
  const videos: ChannelVideoMetric[] = [];

  if (!youtubeChannelConfigured(channelKey)) {
    limitations.push(
      `YouTube OAuth credentials for ${channelKey} channel are not configured in environment.`
    );
    return {
      channelKey,
      dataSourcesAvailable: { dataApi: false, analyticsApi: false, limitations },
      channelMetrics: metrics,
      videos,
    };
  }

  let accessToken: string;
  try {
    accessToken = await getYoutubeChannelAccessToken(channelKey);
  } catch (err) {
    limitations.push(
      `Failed to obtain YouTube OAuth token for ${channelKey}: ${err instanceof Error ? err.message : String(err)}`
    );
    return {
      channelKey,
      dataSourcesAvailable: { dataApi: false, analyticsApi: false, limitations },
      channelMetrics: metrics,
      videos,
    };
  }

  // 1. Authorized YouTube Data API v3: channel stats + uploads playlist
  try {
    const chRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
    );
    if (chRes.ok) {
      const chData = (await chRes.json()) as {
        items?: Array<{
          snippet?: { title?: string };
          statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
          contentDetails?: { relatedPlaylists?: { uploads?: string } };
        }>;
      };
      const ch = chData.items?.[0];
      if (ch) {
        dataApiOk = true;
        metrics.channelTitle = ch.snippet?.title ?? null;
        metrics.subscriberCount = ch.statistics?.subscriberCount ? Number(ch.statistics.subscriberCount) : null;
        metrics.totalViews = ch.statistics?.viewCount ? Number(ch.statistics.viewCount) : null;
        metrics.videoCount = ch.statistics?.videoCount ? Number(ch.statistics.videoCount) : null;

        const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads;
        if (uploadsId) {
          const plRes = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=30&playlistId=${encodeURIComponent(uploadsId)}`,
            { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
          );
          if (plRes.ok) {
            const plData = (await plRes.json()) as {
              items?: Array<{ contentDetails?: { videoId?: string } }>;
            };
            const ids = (plData.items || [])
              .map((i) => i.contentDetails?.videoId)
              .filter((v): v is string => Boolean(v));

            if (ids.length > 0) {
              const vRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,liveStreamingDetails&id=${ids.join(",")}`,
                { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
              );
              if (vRes.ok) {
                const vData = (await vRes.json()) as {
                  items?: Array<{
                    id: string;
                    snippet?: { title?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } };
                    contentDetails?: { duration?: string };
                    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
                    liveStreamingDetails?: unknown;
                  }>;
                };
                for (const item of vData.items || []) {
                  const dur =
                    (item.contentDetails?.duration
                      ? parseIsoDuration(item.contentDetails.duration)
                      : 0) ?? 0;
                  const format: ChannelVideoMetric["format"] = item.liveStreamingDetails
                    ? "LIVE"
                    : dur > 0 && dur <= 65
                      ? "SHORTS"
                      : "LONG";
                  videos.push({
                    videoId: item.id,
                    title: item.snippet?.title || "Untitled",
                    publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
                    durationSec: dur,
                    format,
                    views: Number(item.statistics?.viewCount || 0),
                    likes: item.statistics?.likeCount ? Number(item.statistics.likeCount) : null,
                    comments: item.statistics?.commentCount ? Number(item.statistics.commentCount) : null,
                    thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
                    url: `https://www.youtube.com/watch?v=${item.id}`,
                  });
                }
              }
            }
          }
        }
      }
    } else {
      limitations.push(`YouTube Data API returned HTTP ${chRes.status}`);
    }
  } catch (err) {
    limitations.push(`YouTube Data API error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. YouTube Analytics API v2 (last 28 days)
  try {
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const aUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained`;
    const aRes = await fetch(aUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (aRes.ok) {
      const aData = (await aRes.json()) as { rows?: number[][] };
      const row = aData.rows?.[0];
      if (row) {
        analyticsApiOk = true;
        metrics.recent28dViews = row[0] ?? null;
        metrics.estimatedMinutesWatched = row[1] ?? null;
        metrics.averageViewDurationSec = row[2] ?? null;
        metrics.averageViewPercentage = row[3] ?? null;
        metrics.subscribersGained28d = row[4] ?? null;
      }
      // Traffic sources
      const tUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${startDate}&endDate=${endDate}&dimensions=insightTrafficSourceType&metrics=views&sort=-views`;
      const tRes = await fetch(tUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (tRes.ok) {
        const tData = (await tRes.json()) as { rows?: Array<[string, number]> };
        metrics.trafficSources = (tData.rows || []).slice(0, 8).map((r) => ({
          source: String(r[0]),
          views: Number(r[1]),
        }));
      }
    } else {
      limitations.push(
        `YouTube Analytics API (yt-analytics.readonly) unavailable (HTTP ${aRes.status}). Watch time, retention, CTR, and traffic sources require re-authorizing OAuth with yt-analytics.readonly scope.`
      );
    }
  } catch (err) {
    limitations.push(`YouTube Analytics API check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // CTR & Impressions are not exposed in standard v2 channel reports without Studio/Reporting API
  limitations.push("Impressions, CTR, and Returning Viewers are not exposed by standard Data/Analytics v2 queries unless specifically enabled in YouTube Reporting API.");

  return {
    channelKey,
    dataSourcesAvailable: { dataApi: dataApiOk, analyticsApi: analyticsApiOk, limitations },
    channelMetrics: metrics,
    videos,
  };
}
