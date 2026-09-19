import "server-only";

/**
 * Controls the self-hosted WHIP -> RTMP relay (infra/media-relay/) used only
 * for ClassroomStreamMethod.BROWSER_RELAY sessions — the teacher's browser
 * publishes camera/mic via WHIP directly to that relay, which pushes RTMP
 * into the YouTube stream created by ./youtube-broadcast.ts.
 *
 * IMPORTANT: RUN_ON_READY_FIELD assumes the deployed MediaMTX version calls
 * its "a publisher just started on this path" hook "runOnReady" — verify
 * this against the exact pinned version's docs (see infra/media-relay/
 * README.md) before relying on this in production; some MediaMTX releases
 * call the equivalent hook "runOnAvailable". Update the constant below if so.
 */
const RUN_ON_READY_FIELD = "runOnReady" as const;

export class MediaRelayNotConfiguredError extends Error {
  constructor() {
    super("Media relay is not configured (MEDIA_RELAY_BASE_URL / MEDIA_RELAY_API_TOKEN / MEDIA_RELAY_WHIP_ORIGIN).");
    this.name = "MediaRelayNotConfiguredError";
  }
}

export function mediaRelayConfigured(): boolean {
  return Boolean(
    process.env.MEDIA_RELAY_BASE_URL && process.env.MEDIA_RELAY_API_TOKEN && process.env.MEDIA_RELAY_WHIP_ORIGIN
  );
}

function getConfig() {
  const baseUrl = process.env.MEDIA_RELAY_BASE_URL;
  const apiToken = process.env.MEDIA_RELAY_API_TOKEN;
  const whipOrigin = process.env.MEDIA_RELAY_WHIP_ORIGIN;
  if (!baseUrl || !apiToken || !whipOrigin) throw new MediaRelayNotConfiguredError();
  return { baseUrl, apiToken, whipOrigin };
}

async function relayApiFetch(path: string, init: RequestInit = {}): Promise<void> {
  const { baseUrl, apiToken } = getConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`Media relay API ${path} failed (${res.status}): ${text}`);
  }
}

export interface RelayPathHandle {
  relayPath: string;
  whipUrl: string;
}

/**
 * Registers a dynamic path on the relay for one classroom session and wires
 * its runOnReady hook to remux straight into the YouTube RTMP ingest — the
 * instant the teacher's browser starts publishing via WHIP, ffmpeg (running
 * on the relay host, not on Vercel) starts pushing to YouTube.
 */
export async function createRelayPathForSession(
  classroomSessionId: string,
  youtubeIngestUrl: string,
  youtubeStreamKey: string
): Promise<RelayPathHandle> {
  const { whipOrigin } = getConfig();
  const relayPath = `classroom-${classroomSessionId}`;
  const targetRtmpUrl = `${youtubeIngestUrl.replace(/\/$/, "")}/${youtubeStreamKey}`;

  await relayApiFetch(`/v3/config/paths/add/${encodeURIComponent(relayPath)}`, {
    method: "POST",
    body: JSON.stringify({
      source: "publisher",
      [RUN_ON_READY_FIELD]: `ffmpeg -i rtsp://127.0.0.1:8554/${relayPath} -c copy -f flv "${targetRtmpUrl}"`,
      runOnReadyRestart: true,
    }),
  });

  return { relayPath, whipUrl: `${whipOrigin.replace(/\/$/, "")}/${relayPath}/whip` };
}

/** Called on classroom end — stops the ffmpeg push and frees the path (grace-delayed by the caller, not here, in case of a brief reconnect). */
export async function deleteRelayPath(relayPath: string): Promise<void> {
  await relayApiFetch(`/v3/config/paths/delete/${encodeURIComponent(relayPath)}`, { method: "DELETE" });
}
