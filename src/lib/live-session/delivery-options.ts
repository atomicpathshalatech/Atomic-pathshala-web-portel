/**
 * Which video transport a class actually starts with.
 *
 * An App class goes out as this class's own unlisted YouTube stream
 * (APP_YOUTUBE) — LiveKit is no longer a video transport for classes. The
 * old LiveKit room (and its paid Egress recording) survives only as a
 * FALLBACK for servers where App YouTube isn't set up yet (no YouTube
 * credentials or no stream slots). As soon as it is, a LIVEKIT request —
 * including a stale stored choice or an old client — becomes an App class.
 *
 * LiveKit itself stays for the things only it can do: bringing a student on
 * call (teacher-connect) and 1:1 doubt sessions.
 */

export type VideoTransport = "LIVEKIT" | "YOUTUBE" | "BOTH";

function asTransport(v: unknown): VideoTransport | null {
  return v === "LIVEKIT" || v === "YOUTUBE" || v === "BOTH" ? v : null;
}

/**
 * @param requested  what the client asked for (may be missing / junk)
 * @param stored     the transport already saved on the whiteboard session
 * @param appYoutubeAvailable  YouTube configured AND at least one APP stream slot
 */
export function pickVideoTransport(requested: unknown, stored: unknown, appYoutubeAvailable: boolean): VideoTransport {
  const wanted = asTransport(requested) ?? asTransport(stored) ?? "LIVEKIT";
  if (wanted === "LIVEKIT" && appYoutubeAvailable) return "YOUTUBE";
  return wanted;
}

/** YouTube credentials present and the APP stream pool has a usable slot. */
export async function appYoutubeAvailable(): Promise<boolean> {
  const { youtubeLiveClassConfigured } = await import("@/lib/live-class/youtube-broadcast");
  if (!youtubeLiveClassConfigured()) return false;
  const { appYoutubePoolConfigured } = await import("@/lib/live-session/app-youtube");
  return appYoutubePoolConfigured();
}
