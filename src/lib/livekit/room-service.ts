import "server-only";
import { RoomServiceClient } from "livekit-server-sdk";

/**
 * Server-side room management — genuinely new integration surface (nothing
 * in this codebase used RoomServiceClient before). Used as a defense-in-depth
 * backstop for teacher-initiated disconnect: the client-side setMicrophoneEnabled(false)
 * / setCameraEnabled(false) triggered by the TEACHER_CONNECT_UPDATED Pusher
 * event is the primary mechanism, but a compromised/malicious client could
 * ignore that event, so the server also force-mutes the participant's
 * already-published tracks directly with LiveKit. This never removes the
 * participant from the room — muting a track is not the same as
 * removeParticipant, and disconnect must never do that (spec requirement).
 */
function getRoomServiceClient(): RoomServiceClient {
  const host = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!host || !apiKey || !apiSecret) {
    throw new Error("LiveKit is not configured (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing).");
  }
  // RoomServiceClient talks HTTP/2 to LiveKit's twirp API, not the websocket
  // media path — the same project host works, just swap the ws(s):// scheme
  // the client SDK uses for http(s)://.
  const httpHost = host.replace(/^ws/, "http");
  return new RoomServiceClient(httpHost, apiKey, apiSecret);
}

/**
 * Upgrades (or downgrades) an ALREADY-CONNECTED participant's publish
 * permission in real time via LiveKit's server API.
 *
 * This is the actual fix for "approved student's mic/camera never turn
 * on": a hand-raise approval used to only mint a new canPublish:true JWT
 * (speakerToken) and hand it to the client as a new `token` prop on
 * <LiveKitRoom>. That looks like it should reconnect with the upgraded
 * grant, but livekit-client's Room.connect() short-circuits immediately
 * when the room is already Connected (see node_modules/livekit-client's
 * connect() - `if (this.state === ConnectionState.Connected) return`) -
 * so the new token is silently never sent, the student's connection keeps
 * its original view-only grant, and setMicrophoneEnabled(true)/
 * setCameraEnabled(true) are then called against a connection LiveKit's
 * own server never actually authorized to publish.
 *
 * updateParticipant() pushes the permission change to the SAME live
 * connection over LiveKit's existing signaling channel - no reconnect,
 * no flicker, and the server-side grant is what actually gates publish,
 * so this is the correct fix rather than trying to force a client
 * reconnect. Mirrors the exact grant shape createApprovedSpeakerToken()
 * already issues (canPublish: true, canSubscribe: true, canPublishData:
 * false) so the live permission matches what the token would have
 * granted on a fresh connection.
 */
export async function setParticipantPublishPermission(
  roomName: string,
  identity: string,
  canPublish: boolean
): Promise<void> {
  try {
    const client = getRoomServiceClient();
    await client.updateParticipant(roomName, identity, {
      permission: { canPublish, canSubscribe: true, canPublishData: false },
    });
  } catch (err) {
    console.error(`[room-service] setParticipantPublishPermission(${canPublish}) failed for ${identity} in ${roomName}:`, err);
  }
}

/**
 * Force-mutes every track a participant currently has published (audio
 * and/or video). Never throws — callers use this as a best-effort backstop
 * after the DB/Pusher disconnect has already completed, so a LiveKit-side
 * hiccup here must not block or fail the disconnect request itself.
 */
export async function muteStudentPublishedTracks(roomName: string, identity: string): Promise<void> {
  try {
    const client = getRoomServiceClient();
    const participant = await client.getParticipant(roomName, identity);
    for (const track of participant.tracks) {
      if (!track.muted) {
        await client.mutePublishedTrack(roomName, identity, track.sid, true).catch((err) => {
          console.error(`[room-service] failed to mute track ${track.sid} for ${identity}:`, err);
        });
      }
    }
  } catch (err) {
    // Participant may already be gone (refreshed/left) or LiveKit may be
    // briefly unreachable — either way, this is a backstop, not the
    // critical path; the DB state and Pusher event are already correct.
    console.warn(`[room-service] muteStudentPublishedTracks warning for ${identity} in ${roomName}:`, err);
  }
}
