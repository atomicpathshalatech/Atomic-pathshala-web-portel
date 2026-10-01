import "server-only";
import { prisma } from "@/lib/db";
import { refreshYoutubeVideoStats } from "@/lib/youtube/video-stats";

/**
 * A YouTube video's length in whole minutes, read from YouTube itself (so a
 * recorded class's duration comes from its link, never typed in). Null when
 * YouTube can't tell us (API not configured, private/deleted video).
 */
export async function youtubeVideoDurationMin(videoId: string | null | undefined): Promise<number | null> {
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  try {
    let stat = await prisma.youtubeVideoStat.findUnique({ where: { videoId }, select: { durationSec: true } });
    if (!stat?.durationSec) {
      await refreshYoutubeVideoStats([videoId]);
      stat = await prisma.youtubeVideoStat.findUnique({ where: { videoId }, select: { durationSec: true } });
    }
    return stat?.durationSec ? Math.max(1, Math.ceil(stat.durationSec / 60)) : null;
  } catch {
    return null;
  }
}
