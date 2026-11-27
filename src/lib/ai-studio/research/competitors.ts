import "server-only";
import { prisma } from "@/lib/prisma";
import { enrichYouTubeVideos, fetchYouTubeChannelRss } from "./sources";

function detectTitlePattern(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("one shot") || lower.includes("oneshot")) return "ONE_SHOT";
  if (lower.includes("pyq") || lower.includes("previous year")) return "PYQ_SOLVE";
  if (lower.includes("ncert")) return "NCERT_LINE_BY_LINE";
  if (lower.includes("#shorts") || lower.includes("shorts")) return "SHORTS_HOOK";
  if (lower.includes("nta") || lower.includes("update") || lower.includes("breaking")) return "NEWS_UPDATE";
  if (lower.includes("strategy") || lower.includes("timetable") || lower.includes("roadmap")) return "STRATEGY";
  return "CONCEPT_LECTURE";
}

export async function scanCompetitorChannel(competitorChannelId: string) {
  const channel = await prisma.competitorChannel.findUnique({
    where: { id: competitorChannelId },
  });
  if (!channel) throw new Error("Competitor channel not found");

  const rssItems = await fetchYouTubeChannelRss(channel.channelId);
  const videoIds = rssItems.map((i) => i.videoId).filter((v): v is string => Boolean(v));
  const statsMap = await enrichYouTubeVideos(videoIds);

  let upserted = 0;
  for (const item of rssItems) {
    if (!item.videoId) continue;
    const stats = statsMap.get(item.videoId);
    const publishedAt = new Date(item.publishedAt);
    const ageHours = Math.max(1, (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60));
    const views = stats?.views ?? null;
    const likes = stats?.likes ?? null;
    const comments = stats?.comments ?? null;
    const durationSec = stats?.durationSec ?? null;

    const viewVelocity = views !== null ? Number((views / ageHours).toFixed(2)) : null;
    const engagementRate =
      views && views > 0 && (likes !== null || comments !== null)
        ? Number((((likes ?? 0) + (comments ?? 0)) / views).toFixed(4))
        : null;

    const format =
      durationSec !== null && durationSec <= 65
        ? "SHORTS"
        : item.title.toLowerCase().includes("#shorts")
          ? "SHORTS"
          : "LONG";

    await prisma.competitorVideo.upsert({
      where: { videoId: item.videoId },
      create: {
        competitorChannelId: channel.id,
        videoId: item.videoId,
        title: item.title,
        url: item.url,
        publishedAt,
        durationSec,
        views,
        likes,
        comments,
        viewVelocity,
        engagementRate,
        format,
        thumbnailUrl: item.thumbnailUrl ?? null,
        category: channel.category,
        titlePattern: detectTitlePattern(item.title),
        fetchedAt: new Date(),
      },
      update: {
        title: item.title,
        durationSec,
        views,
        likes,
        comments,
        viewVelocity,
        engagementRate,
        format,
        fetchedAt: new Date(),
      },
    });
    upserted++;
  }

  await prisma.competitorChannel.update({
    where: { id: channel.id },
    data: { lastScannedAt: new Date() },
  });

  return { channelId: channel.id, channelName: channel.name, videosScanned: upserted };
}

export async function scanAllActiveCompetitors() {
  const channels = await prisma.competitorChannel.findMany({
    where: { isActive: true },
    orderBy: { lastScannedAt: "asc" },
    take: 25,
  });

  const results = [];
  for (const ch of channels) {
    try {
      const r = await scanCompetitorChannel(ch.id);
      results.push({ ...r, ok: true });
    } catch (err) {
      results.push({
        channelId: ch.id,
        channelName: ch.name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
