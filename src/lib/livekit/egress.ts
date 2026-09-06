import "server-only";
import { EgressClient, EgressStatus, EncodedFileOutput, EncodedFileType, S3Upload } from "livekit-server-sdk";
import { prisma } from "@/lib/db";

/**
 * LiveKit Egress (server-side room recording) writing straight to the same
 * Cloudflare R2 bucket already used for whiteboard/notes/profile storage
 * (see src/lib/storage/r2-client.ts) - no new cloud storage account or cost
 * decision needed, this reuses credentials already configured.
 *
 * Room Composite Egress records whatever video tracks are actually
 * published to the room, composited into one file - so once the whiteboard
 * canvas is published as its own LiveKit track (see
 * TeacherLiveClassRoom's publishWhiteboardTrack), it shows up in the
 * recording exactly like the teacher's camera does. Until that's wired in
 * for a given session, this still records camera + mic + screen-share (if
 * any) - never nothing, just less complete.
 */

function livekitHttpHost(): string {
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;
  if (!wsUrl) {
    throw new Error("LiveKit URL is not configured (NEXT_PUBLIC_LIVEKIT_URL).");
  }
  // EgressClient talks to LiveKit's REST API, not the realtime ws endpoint -
  // same host, http(s) scheme instead of ws(s).
  return wsUrl.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
}

function getEgressClient(): EgressClient {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit is not configured (LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing).");
  }
  return new EgressClient(livekitHttpHost(), apiKey, apiSecret);
}

export class RecordingStorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Cloudflare R2 storage is not configured for recordings (CLOUDFLARE_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME)."
    );
    this.name = "RecordingStorageNotConfiguredError";
  }
}

function getR2FileOutput(storageKey: string): EncodedFileOutput {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKey || !secret || !bucket) {
    throw new RecordingStorageNotConfiguredError();
  }

  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: storageKey,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey,
        secret,
        bucket,
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
      }),
    },
  });
}

/** Deterministic-ish, collision-free R2 key for one session's recording.
 * Kept as its own function so the start route and anything that needs to
 * predict/display the key before the webhook fires can agree on the shape. */
export function recordingStorageKey(whiteboardSessionId: string): string {
  return `recordings/${whiteboardSessionId}/${Date.now()}.mp4`;
}

/**
 * Starts a Room Composite Egress (records the whole room - every published
 * video track, mixed audio - into one MP4) and uploads it to R2 at
 * `storageKey`. Returns LiveKit's egressId, which the caller must persist
 * (WhiteboardSession.recordingEgressId) - it's the only way to stop the
 * recording later or match the eventual webhook back to this session.
 */
export async function startRoomRecording(roomName: string, storageKey: string) {
  const client = getEgressClient();
  const output = getR2FileOutput(storageKey);
  return client.startRoomCompositeEgress(roomName, output, { layout: "grid" });
}

/** Stops an in-progress egress. LiveKit finalizes and uploads the file
 * asynchronously after this returns - the real "it's ready" signal is the
 * egress_ended webhook (src/app/api/webhooks/livekit/route.ts), not this
 * call's return value. */
export async function stopRoomRecording(egressId: string) {
  const client = getEgressClient();
  return client.stopEgress(egressId);
}

type RecordingFields = {
  recordingStatus: string;
  recordingStorageKey: string | null;
  recordingDurationSeconds: number | null;
};

/**
 * Fallback for the LiveKit `egress_ended` webhook
 * (src/app/api/webhooks/livekit/route.ts) never arriving or failing signature
 * verification - e.g. the LiveKit Cloud project's webhook URL still pointing
 * at a stale/old deployment domain, or a dropped delivery (LiveKit does not
 * retry a failed webhook). That webhook was previously the ONLY way a
 * recording ever left "RECORDING"/"PROCESSING", so a single missed delivery
 * left the session - and every student looking at it - stuck showing
 * "Recording in Process" forever with no way to recover.
 *
 * Whenever a recording is read while still RECORDING/PROCESSING, this asks
 * LiveKit directly (outbound call we already rely on to start/stop egress
 * and mint join tokens, so it isn't subject to the same "did the inbound
 * webhook reach us" failure mode) for the egress's real status via
 * listEgress, and applies the same DB update the webhook would have. A
 * missed webhook then self-heals on the very next read instead of needing a
 * manual DB fix. Best-effort and side-effect-free on failure: never throws,
 * so a call site can await it without risking the page/route it's part of.
 */
export async function reconcileRecordingStatus(
  session: { id: string; recordingStatus: string; recordingEgressId: string | null }
): Promise<RecordingFields | null> {
  if (
    (session.recordingStatus !== "RECORDING" && session.recordingStatus !== "PROCESSING") ||
    !session.recordingEgressId
  ) {
    return null;
  }

  try {
    const client = getEgressClient();
    const results = await client.listEgress({ egressId: session.recordingEgressId });
    const info = results?.[0];
    if (!info) return null;

    if (info.status === EgressStatus.EGRESS_COMPLETE) {
      const file = info.fileResults?.[0];
      return await prisma.whiteboardSession.update({
        where: { id: session.id },
        data: {
          recordingStatus: "READY",
          recordingStorageKey: file?.filename || undefined,
          recordingDurationSeconds: file?.duration
            ? Math.round(Number(file.duration) / 1_000_000_000)
            : undefined,
        },
        select: {
          recordingStatus: true,
          recordingStorageKey: true,
          recordingDurationSeconds: true,
        },
      });
    }

    if (info.status === EgressStatus.EGRESS_FAILED || info.status === EgressStatus.EGRESS_ABORTED) {
      return await prisma.whiteboardSession.update({
        where: { id: session.id },
        data: { recordingStatus: "FAILED" },
        select: {
          recordingStatus: true,
          recordingStorageKey: true,
          recordingDurationSeconds: true,
        },
      });
    }

    // Still genuinely active/starting on LiveKit's side - nothing to
    // reconcile yet, the webhook (or the next read) will catch it later.
    return null;
  } catch (err) {
    console.error("[reconcileRecordingStatus] LiveKit lookup failed:", err);
    return null;
  }
}
