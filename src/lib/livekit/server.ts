import "server-only";
import { AccessToken } from "livekit-server-sdk";

/** One LiveKit room per live-teaching session — same 1:1 pairing as the
 * Pusher session channel (see realtime/events.ts's sessionChannel), so
 * video, whiteboard, hand-raise and quiz all key off the same
 * WhiteboardSession id. */
export function videoRoomName(whiteboardSessionId: string) {
  return `wb-session-${whiteboardSessionId}`;
}

function getCredentials() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit is not configured (LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing).");
  }
  return { apiKey, apiSecret };
}

/**
 * Teacher publisher token — full two-way video/audio. Teacher can publish
 * their camera and mic to the room so students can subscribe.
 */
export async function createTeacherPublisherToken(opts: {
  identity: string;
  name: string;
  roomName: string;
}) {
  const { apiKey, apiSecret } = getCredentials();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name,
    ttl: "4h",
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: true,       // teacher publishes camera/mic
    canSubscribe: true,     // teacher can also see approved student speakers
    canPublishData: true,   // for board sync data messages if needed
  });
  return at.toJwt();
}

/**
 * Student viewer token — subscribe-only. Student watches teacher stream
 * without any camera/mic access. When a student is approved to speak
 * (hand raise approved), a separate APPROVED_SPEAKER grant is issued
 * via the hand-raise approval endpoint.
 */
export async function createStudentViewerToken(opts: {
  identity: string;
  name: string;
  roomName: string;
}) {
  const { apiKey, apiSecret } = getCredentials();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name,
    ttl: "4h",
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: false,      // student viewer cannot publish by default
    canSubscribe: true,     // student can watch teacher stream
    canPublishData: false,
  });
  return at.toJwt();
}

/**
 * Approved speaker token — issued to a student whose hand raise was
 * APPROVED by the teacher. Grants publish permission for audio/video.
 * Used by the hand-raise approval endpoint.
 */
export async function createApprovedSpeakerToken(opts: {
  identity: string;
  name: string;
  roomName: string;
  audioOnly: boolean;
}) {
  const { apiKey, apiSecret } = getCredentials();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name,
    ttl: "2h", // shorter TTL for speaker tokens
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: true,       // approved student can publish
    canSubscribe: true,
    canPublishData: false,
  });
  return at.toJwt();
}

/**
 * @deprecated Use createTeacherPublisherToken or createStudentViewerToken instead.
 * Kept only for any external callers during migration.
 */
export async function createVideoAccessToken(opts: { identity: string; name: string; roomName: string }) {
  return createTeacherPublisherToken(opts);
}
