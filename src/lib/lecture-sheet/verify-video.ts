/**
 * Can students play this YouTube video inside the app? Uses YouTube's public
 * oEmbed endpoint — no API key and no YouTube quota.
 *   OK           — exists and may be embedded
 *   NOT_EMBEDDABLE — exists, but the owner turned off embedding (students would see "Video unavailable")
 *   UNAVAILABLE  — private, deleted, or never existed
 *   UNKNOWN      — YouTube could not be reached; try again later
 * It cannot tell a finished recording from a live or still-processing one.
 */
export type VideoCheck = "OK" | "NOT_EMBEDDABLE" | "UNAVAILABLE" | "UNKNOWN";

export async function checkYoutubeVideo(videoId: string, fetchImpl: typeof fetch = fetch): Promise<VideoCheck> {
  try {
    const res = await fetchImpl(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (res.ok) return "OK";
    if (res.status === 401 || res.status === 403) return "NOT_EMBEDDABLE";
    if (res.status === 404 || res.status === 400) return "UNAVAILABLE";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
