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

/** One private channel per Doubt Book Session booking — only the booked
 * student and the assigned teacher (or an admin override) ever have
 * authorization to subscribe; see /api/pusher/auth's doubt-booking branch. */
export function doubtBookingChannel(bookingId: string) {
  return `private-doubt-booking-${bookingId}`;
}

export const DOUBT_BOOKING_EVENTS = {
  SESSION_STARTED: "doubt-session-started",
  SESSION_ENDED: "doubt-session-ended",
} as const;

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
  // The laser pointer is intentionally local-only in the canvas engine
  // (never enters `objects`/autosave — see canvas-engine.ts's laserStrokes
  // comment), so unlike every stroke tool above, nothing about it ever
  // reaches a student through the normal board pipeline. This carries the
  // actual point list (throttled while drawing, once more on pointer-up)
  // so a student's read-only board mirror can render the same fading
  // laser trail the teacher sees, without persisting anything.
  LASER_POINTER: "laser-pointer",
  // Live chat. Unlike board/hand-raise events this one DOES carry the actual
  // payload (the message itself) rather than a "go re-fetch" signal — chat
  // history is small, append-only, and doesn't need a full re-fetch per
  // message the way a stroke-heavy board does. Sent to sessionChannel (not
  // teacherChannel) since both teacher and students see the same chat.
  MESSAGE_SENT: "message-sent",
  // Teacher pinned/unpinned a message (WhiteboardMessage.pinnedAt). Carries
  // the id + new pinnedAt so every client can update that one message
  // locally without a full history re-fetch.
  MESSAGE_PINNED: "message-pinned",
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
  // Teacher-initiated audio/video connection to a specific student — the
  // reverse direction of the hand-raise flow above (teacher grants, rather
  // than approves a student's request). One state-snapshot event per
  // change, filtered client-side by studentUserId, same pattern as
  // SPEAKER_APPROVED/SPEAKER_REVOKED — no per-student private channel exists
  // or is needed.
  TEACHER_CONNECT_UPDATED: "teacher-connect-updated",
} as const;

export function directConversationChannel(conversationId: string) {
  return `direct-chat-${conversationId}`;
}

export const DIRECT_MESSAGE_EVENTS = {
  NEW_MESSAGE: "new-message",
  MESSAGES_READ: "messages-read",
} as const;

// ----------------------------------------------------------------------------
// CLASSROOM — the new, independent YouTube-Live classroom module. Separate
// channel names and event constants from the WB_EVENTS/sessionChannel above
// on purpose: Whiteboard's realtime wiring must never be touched for
// Classroom's sake, even though the shapes are deliberately similar.
// ----------------------------------------------------------------------------

/** One presence channel per classroom session — teacher + students currently viewing. Presence membership doubles as the live student-count badge. */
export function classroomChannel(classroomSessionId: string) {
  return `presence-classroom-${classroomSessionId}`;
}

/** Teacher-only channel — hand-raise queue, never sent to students. */
export function classroomTeacherChannel(classroomSessionId: string) {
  return `private-classroom-teacher-${classroomSessionId}`;
}

export const CLASSROOM_EVENTS = {
  // Chat — carries the actual message payload (small, append-only), same
  // rationale as WB_EVENTS.MESSAGE_SENT.
  MESSAGE_SENT: "classroom-message-sent",
  MESSAGE_PINNED: "classroom-message-pinned",
  // Hand raise — sends a fresh queue snapshot, same pattern as WB_EVENTS.HAND_RAISE_LIST.
  HAND_RAISE_LIST: "classroom-hand-raise-list",
  HAND_RAISE_UPDATED: "classroom-hand-raise-updated",
  // ClassroomSession.phase transitions (SCHEDULED -> PREPARING -> LIVE ->
  // ENDED -> RECORDED). A poller catches this within its interval regardless
  // (see the student room's by-schedule poll), but this lets a student
  // sitting in the waiting state jump straight into the video the instant
  // the teacher goes live.
  PHASE_CHANGED: "classroom-phase-changed",
} as const;

