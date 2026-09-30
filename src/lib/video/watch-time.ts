/**
 * Student watch time for recorded classes — the pure rules (unit tested),
 * shared by the player heartbeat and the server.
 */

/** How often the player reports (ms). */
export const WATCH_BEAT_MS = 30_000;
/** Most seconds one beat may add (a beat is ~30 s; a little slack for timers). */
export const MAX_BEAT_SEC = 45;

/** "lecture:<id>" | "schedule:<id>" → its parts, or null if malformed. */
export function parseContentKey(key: string): { kind: "lecture" | "schedule"; id: string } | null {
  const m = /^(lecture|schedule):([A-Za-z0-9_-]{6,80})$/.exec(key);
  return m ? { kind: m[1] as "lecture" | "schedule", id: m[2]! } : null;
}

/**
 * Seconds a beat may add: what the player says it played, never more than
 * one beat's worth, and never more than the wall time since the last beat
 * this student sent for this video (+5 s) — so two open tabs or a replayed
 * request can't inflate watch time.
 */
export function allowedIncrement(playedSec: number, msSinceLastBeat: number | null): number {
  if (!Number.isFinite(playedSec) || playedSec <= 0) return 0;
  let sec = Math.min(Math.floor(playedSec), MAX_BEAT_SEC);
  if (msSinceLastBeat !== null) sec = Math.min(sec, Math.max(0, Math.floor(msSinceLastBeat / 1000) + 5));
  return sec;
}

/**
 * Client side: seconds the video really played between two samples, by wall
 * time — only while the position is moving forward (paused, buffering or a
 * backgrounded tab count as nothing; a seek is not "watching").
 */
export function playedBetween(prev: { at: number; pos: number } | null, now: { at: number; pos: number }): number {
  if (!prev) return 0;
  const wall = (now.at - prev.at) / 1000;
  const moved = now.pos - prev.pos;
  if (wall <= 0 || moved <= 0.2) return 0;
  // Moved much further than 4x speed allows → a seek, not viewing.
  if (moved > wall * 4 + 2) return 0;
  return Math.min(wall, moved + 1);
}
