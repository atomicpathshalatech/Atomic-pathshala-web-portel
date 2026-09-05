/**
 * Realtime event name + channel-naming constants shared between server code
 * (which publishes, via pusher-server.ts) and client components (which
 * subscribe, via pusher-client.ts). This file deliberately has NO
 * "server-only" import and no secrets in it — pusher-server.ts re-exports
 * these for convenience so existing server-side imports don't need to
 * change, but this is the canonical source, precisely so a client component
 * can import channel/event names without ever pulling in the server SDK.
 */

/** One channel per live-teaching session. Everyone subscribed (teacher +
 * enrolled students currently viewing) gets these events. */
export function sessionChannel(sessionId: string) {
  return `presence-wb-session-${sessionId}`;
}

/** Teacher-only channel — hand-raise queue and per-option response counts.
 * Never send this to students: it would leak who raised a hand before the
 * teacher sees it, and (for quiz) could leak vote counts before reveal. */
export function teacherChannel(sessionId: string) {
  return `private-wb-teacher-${sessionId}`;
}

export const WB_EVENTS = {
  HAND_RAISE_LIST: "hand-raise-list",
  QUIZ_LAUNCHED: "quiz-launched",
  QUIZ_METRICS: "quiz-metrics",
  QUIZ_REVEALED: "quiz-revealed",
  QUIZ_CLOSED: "quiz-closed",
  SESSION_ENDED: "session-ended",
  // Board mirroring (Test/Video update): both carry only an id/number, never
  // the stroke payload itself — Pusher is a "something changed, go re-fetch"
  // signal here same as every other event in this file, not a stroke
  // transport. The actual objects come from GET .../board.
  BOARD_UPDATED: "board-updated",
  PAGE_CHANGED: "page-changed",
  // Live chat. Unlike board/hand-raise events this one DOES carry the actual
  // payload (the message itself) rather than a "go re-fetch" signal — chat
  // history is small, append-only, and doesn't need a full re-fetch per
  // message the way a stroke-heavy board does. Sent to sessionChannel (not
  // teacherChannel) since both teacher and students see the same chat.
  MESSAGE_SENT: "message-sent",
  // Pre-class lobby → live transition (WhiteboardSession.livePhase flipping
  // to LIVE when the teacher clicks Start Class). A poller would catch this
  // within 5s anyway (see StudentLiveClassRoom's by-schedule poll), but this
  // lets a student sitting in the lobby jump straight into the board/video
  // the instant class actually starts instead of waiting out the interval.
  LIVE_PHASE_CHANGED: "live-phase-changed",
  SESSION_EXTENDED: "session-extended",
  PRESENCE_EVENT: "presence-event",
  CONFIG_UPDATED: "config-updated",
  // Hand Raise & Student Speaker Participation
  HAND_RAISE_UPDATED: "hand-raise-updated",
  SPEAKER_APPROVED: "speaker-approved",
  SPEAKER_REVOKED: "speaker-revoked",
} as const;

