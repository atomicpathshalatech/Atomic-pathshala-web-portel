/**
 * Can this YouTube video be played inside another site (our student room)?
 *
 * A class the team schedules on YouTube themselves only plays in the app if
 * the video allows embedding. With it off, YouTube shows "Video unavailable"
 * in the app while the same class plays fine on youtube.com — and nothing
 * told the teacher. YouTube's public oEmbed endpoint answers this without
 * any API key or quota: 200 = embeddable, 401/403 = embedding off or private.
 *
 * Returns null when it could not be checked (network, an unexpected reply).
 */
export async function youtubeEmbedAllowed(videoId: string): Promise<boolean | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { signal: AbortSignal.timeout(4000), cache: "no-store" }
    );
    if (res.status === 200) return true;
    if (res.status === 401 || res.status === 403) return false;
    return null;
  } catch {
    return null;
  }
}

export const EMBED_OFF_WARNING =
  "Students CANNOT watch this class inside the app: this YouTube video does not allow embedding (YouTube shows them \"Video unavailable\"). Fix now: YouTube Studio → this live stream → Edit → Show more → tick \"Allow embedding\" → Save. If that box is missing or greyed out, the channel is not allowed to embed live streams yet — stream from the main channel, or start this as an App class.";
