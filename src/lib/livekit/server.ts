import "server-only";
import { AccessToken } from "livekit-server-sdk";

/** One LiveKit room per live-teaching session — same 1:1 pairing as the
 * Pusher session channel (see realtime/events.ts's sessionChannel), so
 * video, whiteboard, hand-raise and quiz all key off the same
 * WhiteboardSession id. */
export function videoRoomName(whiteboardSessionId: string) {
  return `wb-session-${whiteboardSessionId}`;
}

/**
 * Mints a short-lived LiveKit room-join token. Both teacher and student get
 * identical grants — full two-way video/audio, per the "poora video call
 * bhi (camera + mic dono taraf)" requirement — access control for WHO can
 * get a token at all is enforced by the caller (the video-token route),
 * same division of responsibility as everywhere else: this function only
 * signs what it's told to.
 *
 * Throws if LIVEKIT_API_KEY/LIVEKIT_API_SECRET aren't configured — the
 * caller is expected to catch this and degrade gracefully (video is
 * optional infrastructure; a missing LiveKit account should never break
 * the rest of the live class).
 */
export async function createVideoAccessToken(opts: { identity: string; name: string; roomName: string }) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit is not configured (LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing).");
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name,
    // A class shouldn't realistically run longer than this; if it does, the
    // client just re-fetches a token on reconnect the same way it already
    // re-polls session status.
    ttl: "4h",
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });

  return at.toJwt();
}
