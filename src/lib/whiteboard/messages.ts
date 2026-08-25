import "server-only";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

export type WhiteboardMessagePayload = {
  id: string;
  authorRole: "TEACHER" | "STUDENT";
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
  // True for server-generated announcements (e.g. "X has joined the class",
  // see .../join/route.ts) rather than something a person actually typed —
  // optional/undefined is equivalent to false so existing callers that don't
  // pass it (the plain chat POST route) don't need to change.
  isSystemMessage?: boolean;
};

/**
 * Broadcasts one chat message. Unlike pushHandRaiseQueue/pushBoardUpdated,
 * this sends the actual message (not a "go re-fetch" signal) — chat history
 * is small and append-only, so there's no benefit to making every client
 * round-trip to GET .../messages on every send. The DB row created by the
 * caller just before this call is still the source of truth for anyone who
 * loads the room after the message was sent (missed-event recovery).
 */
export async function pushMessage(whiteboardSessionId: string, message: WhiteboardMessagePayload) {
  try {
    await pusherServer.trigger(sessionChannel(whiteboardSessionId), WB_EVENTS.MESSAGE_SENT, message);
  } catch (err) {
    console.error("[pusher_trigger_error]", err);
  }
}
