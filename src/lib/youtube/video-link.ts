/**
 * YouTube links as staff paste them: watch?v=, youtu.be/, /live/, /shorts/,
 * /embed/, m.youtube.com, or just the 11-character id. Pure (unit tested).
 */

const ID = /^[A-Za-z0-9_-]{11}$/;

/** The video id in any common YouTube link (or a bare id), else null. */
export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "").toLowerCase();
  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v) candidate = v;
    else {
      const [, kind, id] = url.pathname.split("/");
      if (kind && ["live", "shorts", "embed", "v"].includes(kind)) candidate = id ?? null;
    }
  }
  return candidate && ID.test(candidate) ? candidate : null;
}

/** The one link format every player in the app understands. */
export function canonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export type EmbedCheck = "ok" | "not_embeddable" | "not_found" | "unknown";

/**
 * Whether the video can play inside the app, via YouTube's public oEmbed
 * endpoint (no API quota; works for unlisted videos): 401 = embedding is
 * off, 404/400 = private, deleted or wrong id. Network trouble → "unknown"
 * (the caller decides; it must not block saving).
 */
export async function checkYouTubeEmbeddable(videoId: string, fetchImpl: typeof fetch = fetch): Promise<EmbedCheck> {
  try {
    const res = await fetchImpl(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalYouTubeUrl(videoId))}`,
      { signal: AbortSignal.timeout(6000), cache: "no-store" }
    );
    if (res.ok) return "ok";
    if (res.status === 401 || res.status === 403) return "not_embeddable";
    if (res.status === 404 || res.status === 400) return "not_found";
    return "unknown";
  } catch {
    return "unknown";
  }
}
