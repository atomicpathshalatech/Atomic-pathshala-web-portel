/**
 * Which video transport a class starts with: always YouTube.
 *
 * Every class is taught from the Atomic Pathshala Teacher app and goes out
 * as a YouTube stream — an App class on its own unlisted broadcast
 * (APP_YOUTUBE), a public class on the broadcast the team scheduled on
 * YouTube (they enter its link and stream key). The LiveKit room is no
 * longer a way to run a class, not even as a fallback: a class whose YouTube
 * stream can't be set up does not start, and says why.
 *
 * LiveKit itself stays for bringing a student on call (hand-raise /
 * teacher-connect) and for 1:1 doubt sessions.
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
  // Old clients and stored rows may still say LIVEKIT or BOTH.
  void asTransport(requested), void stored, void appYoutubeAvailable;
  return "YOUTUBE";
}

/** YouTube credentials present and the APP stream pool has a usable slot. */
export async function appYoutubeAvailable(): Promise<boolean> {
  const { youtubeLiveClassConfigured } = await import("@/lib/live-class/youtube-broadcast");
  if (!youtubeLiveClassConfigured()) return false;
  const { appYoutubePoolConfigured } = await import("@/lib/live-session/app-youtube");
  return appYoutubePoolConfigured();
}
