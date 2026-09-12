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
