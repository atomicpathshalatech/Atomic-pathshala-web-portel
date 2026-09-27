/**
 * The live-class lifecycle, as data. Pure (no I/O) so the transition rules
 * can be unit tested and shared by server code and tests alike.
 *
 *   SCHEDULED → READY → STARTING → YOUTUBE_CONNECTING → YOUTUBE_ACTIVE → LIVE
 *   LIVE → ENDING → RECORDING_PROCESSING → RECORDING_READY → COMPLETED
 *
 * Students see a class as live only in LIVE. A scheduled YouTube broadcast
 * or an existing youtubeVideoId never makes a class LIVE on its own.
 */

export const LIVE_SESSION_STATES = [
  "SCHEDULED",
  "READY",
  "STARTING",
  "YOUTUBE_CONNECTING",
  "YOUTUBE_ACTIVE",
  "LIVE",
  "ENDING",
  "RECORDING_PROCESSING",
  "RECORDING_READY",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
] as const;
export type LiveState = (typeof LIVE_SESSION_STATES)[number];

export type DeliveryModeName = "APP_YOUTUBE" | "MAIN_YOUTUBE" | "EXTERNAL_YOUTUBE" | "LEGACY_LIVEKIT";

/**
 * Allowed transitions. STARTING → LIVE is permitted for now because the
 * current pipeline has no YouTube stream-health gate yet; the stream-pool
 * step replaces it with STARTING → YOUTUBE_CONNECTING → YOUTUBE_ACTIVE → LIVE
 * for APP_YOUTUBE. ENDING → LIVE exists for a short "undo End Class" window
 * before the YouTube broadcast is completed.
 */
export const LIVE_TRANSITIONS: Readonly<Record<LiveState, readonly LiveState[]>> = {
  SCHEDULED: ["READY", "STARTING", "CANCELLED"],
  READY: ["STARTING", "CANCELLED"],
  STARTING: ["YOUTUBE_CONNECTING", "LIVE", "READY", "FAILED"],
  YOUTUBE_CONNECTING: ["YOUTUBE_ACTIVE", "READY", "FAILED"],
  YOUTUBE_ACTIVE: ["LIVE", "READY", "FAILED"],
  LIVE: ["ENDING"],
  ENDING: ["RECORDING_PROCESSING", "COMPLETED", "LIVE"],
  RECORDING_PROCESSING: ["RECORDING_READY", "COMPLETED", "FAILED"],
  RECORDING_READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

/** Occurrence still ahead of or inside its class time — at most one per schedule (DB partial unique index). */
export const OPEN_STATES: readonly LiveState[] = [
  "SCHEDULED",
  "READY",
  "STARTING",
  "YOUTUBE_CONNECTING",
  "YOUTUBE_ACTIVE",
  "LIVE",
  "ENDING",
];

/** Class hasn't gone live yet (safe to move in time or cancel). */
export const PRE_LIVE_STATES: readonly LiveState[] = ["SCHEDULED", "READY", "STARTING", "YOUTUBE_CONNECTING", "YOUTUBE_ACTIVE"];

export const TERMINAL_STATES: readonly LiveState[] = ["COMPLETED", "CANCELLED", "FAILED"];

export function canTransition(from: LiveState, to: LiveState): boolean {
  return LIVE_TRANSITIONS[from].includes(to);
}

/** Every state that may legally move to `to` — the CAS "from" set for a transition. */
export function predecessorsOf(to: LiveState): LiveState[] {
  return (Object.keys(LIVE_TRANSITIONS) as LiveState[]).filter((from) => LIVE_TRANSITIONS[from].includes(to));
}

export function isOpenState(state: LiveState): boolean {
  return OPEN_STATES.includes(state);
}

/**
 * Delivery mode for the CURRENT pipeline's transport choice. A YouTube class
 * is APP_YOUTUBE only when Atomic created its broadcast on the APP channel;
 * a pasted/mapped id is EXTERNAL_YOUTUBE (or MAIN_YOUTUBE when ownership was
 * verified against the MAIN channel); anything without a video is the
 * legacy LiveKit room.
 */
export function deliveryModeFor(input: {
  videoTransport: string;
  youtubeBroadcastId?: string | null;
  youtubeVideoId?: string | null;
  verifiedMainChannel?: boolean;
}): { deliveryMode: DeliveryModeName; youtubeChannel: "APP" | "MAIN" | null } {
  const youtube = input.videoTransport === "YOUTUBE" || input.videoTransport === "BOTH";
  if (youtube && input.verifiedMainChannel && input.youtubeVideoId) {
    return { deliveryMode: "MAIN_YOUTUBE", youtubeChannel: "MAIN" };
  }
  if (youtube && input.youtubeBroadcastId) return { deliveryMode: "APP_YOUTUBE", youtubeChannel: "APP" };
  if (youtube && input.youtubeVideoId) return { deliveryMode: "EXTERNAL_YOUTUBE", youtubeChannel: null };
  return { deliveryMode: "LEGACY_LIVEKIT", youtubeChannel: null };
}

/** State after END for a given mode: YouTube modes wait for YouTube to confirm the recording. */
export function stateAfterEnd(mode: DeliveryModeName, hasLegacyRecording: boolean): LiveState {
  if (mode === "LEGACY_LIVEKIT") return hasLegacyRecording ? "RECORDING_PROCESSING" : "COMPLETED";
  return "RECORDING_PROCESSING";
}
