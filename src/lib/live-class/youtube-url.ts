/**
 * YouTube link helpers with no server code — safe to import from browser
 * components (the live-class room, the start-class window). The session /
 * broadcast functions that use the database stay in ./youtube.
 */

/**
 * Extracts an 11-character YouTube video or live ID from various URL formats or raw ID.
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle standard URLs: watch?v=, youtu.be/, embed/, live/
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );

  return match ? match[1] ?? null : null;
}

export const extractYoutubeVideoId = extractYouTubeVideoId;

export function isValidYouTubeVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  options?: { autoplay?: boolean; mute?: boolean; origin?: string }
): string {
  const params = new URLSearchParams({
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    enablejsapi: "1",
  });

  if (options?.autoplay) params.set("autoplay", "1");
  if (options?.mute) params.set("mute", "1");
  if (options?.origin) params.set("origin", options.origin);

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
