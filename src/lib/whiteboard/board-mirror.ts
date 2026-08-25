import "server-only";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Board-mirroring broadcast helpers — same "small snapshot signal, DB is the
 * source of truth" pattern as pushHandRaiseQueue: never put stroke data on
 * the wire here, just enough for a listener to know it should re-fetch
 * GET .../board. Called from the two routes that actually change what's on
 * screen (page autosave, active-page switch), so this stays the one place
 * that decides how "board changed" gets announced.
 */

export async function pushBoardUpdated(whiteboardSessionId: string, pageNumber: number) {
  try {
    await pusherServer.trigger(sessionChannel(whiteboardSessionId), WB_EVENTS.BOARD_UPDATED, {
      pageNumber,
    });
  } catch (err) {
    console.error("[pusher_trigger_error]", err);
  }
}

export async function pushPageChanged(whiteboardSessionId: string, activePageNumber: number) {
  try {
    await pusherServer.trigger(sessionChannel(whiteboardSessionId), WB_EVENTS.PAGE_CHANGED, {
      activePageNumber,
    });
  } catch (err) {
    console.error("[pusher_trigger_error]", err);
  }
}

/**
 * Nudges anyone sitting in the pre-class lobby the instant the teacher hits
 * Start Class, so they don't have to wait out the by-schedule poll interval
 * to see the board/video appear. Same "small signal, DB stays authoritative"
 * shape as the two helpers above — a client that misses this still picks up
 * livePhase: "LIVE" on its next poll.
 */
export async function pushLivePhaseChanged(whiteboardSessionId: string, livePhase: string) {
  try {
    await pusherServer.trigger(sessionChannel(whiteboardSessionId), WB_EVENTS.LIVE_PHASE_CHANGED, {
      livePhase,
    });
  } catch (err) {
    console.error("[pusher_trigger_error]", err);
  }
}
