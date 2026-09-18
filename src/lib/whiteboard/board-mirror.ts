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

export async function pushBoardUpdated(
  whiteboardSessionId: string,
  pageNumber: number,
  objects?: any[],
  background?: string
) {
  try {
    await pusherServer.trigger(sessionChannel(whiteboardSessionId), WB_EVENTS.BOARD_UPDATED, {
      pageNumber,
      objects,
      background,
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
 * Broadcasts a laser-pointer update — see WB_EVENTS.LASER_POINTER. `phase`
 * "move" carries the growing in-progress stroke; "end" carries the finished
 * stroke's full point list so the receiving engine can start the same fade
 * animation (see CanvasEngine.pushRemoteLaserStroke). Never touches the DB —
 * this is the one board-related broadcast that isn't a "go re-fetch" signal
 * for something durable, because there's nothing durable to fetch.
 */
export async function pushLaserPointer(
  whiteboardSessionId: string,
  points: { x: number; y: number }[],
  phase: "move" | "end"
) {
  try {
    await pusherServer.trigger(sessionChannel(whiteboardSessionId), WB_EVENTS.LASER_POINTER, {
      points,
      phase,
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
