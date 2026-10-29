/**
 * Scheduled recorded lectures ("premieres"). A recorded lecture scheduled for
 * a batch is a BatchSchedule row (type LIVE_CLASS, classMode RECORDED) — so it
 * shows in the live schedule like any class. In its slot it plays like a live
 * class: everyone is at the same point of the video and cannot skip ahead.
 * After the slot it is an ordinary recording. Pure (no SDK, no server import)
 * so it is unit tested in scripts/test-recorded-lectures.ts.
 */

export const RECORDED_CLASS_MODE = "RECORDED";

export type PremiereState = "UPCOMING" | "LIVE" | "ENDED";

export function isRecordedClass(schedule: { classMode?: string | null } | null | undefined): boolean {
  return schedule?.classMode === RECORDED_CLASS_MODE;
}

function ms(d: Date | string): number {
  return typeof d === "string" ? new Date(d).getTime() : d.getTime();
}

export function premiereState(p: { startsAt: Date | string; endsAt: Date | string }, now: Date = new Date()): PremiereState {
  const t = now.getTime();
  if (t < ms(p.startsAt)) return "UPCOMING";
  if (t < ms(p.endsAt)) return "LIVE";
  return "ENDED";
}

/** Where the live video is now (seconds from the start), within [0, duration]. */
export function livePositionSec(startsAt: Date | string, now: Date = new Date(), durationSec?: number | null): number {
  const pos = Math.max(0, (now.getTime() - ms(startsAt)) / 1000);
  return durationSec && durationSec > 0 ? Math.min(pos, durationSec) : pos;
}

/** A seek past the live point goes back to it; earlier points are allowed (like a live stream's rewind). */
export function clampToLive(requestedSec: number, liveSec: number): number {
  return Math.max(0, Math.min(requestedSec, liveSec));
}

/** The slot of a premiere: the video's length, at least 1 minute. */
export function premiereEnd(startsAt: Date, durationSec: number | null | undefined): Date {
  const sec = durationSec && durationSec > 0 ? durationSec : 60 * 60;
  return new Date(startsAt.getTime() + Math.max(60, Math.ceil(sec)) * 1000);
}

/**
 * Which premiere applies to a student: the earliest not-cancelled slot of
 * their batch that has not ended; otherwise the last one that ended (the
 * lecture is then an ordinary recording).
 */
export function pickPremiere<T extends { startsAt: Date; endsAt: Date }>(slots: T[], now: Date = new Date()): T | null {
  if (!slots.length) return null;
  const sorted = [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return sorted.find((s) => s.endsAt.getTime() > now.getTime()) ?? sorted[sorted.length - 1] ?? null;
}

/** "<input type=datetime-local>" value (India time) → Date. Null if it does not parse. */
export function parseIstLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const utc = Date.UTC(y, mo - 1, d, h, mi) - (5 * 60 + 30) * 60 * 1000;
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → "<input type=datetime-local>" value in India time. */
export function toIstLocal(date: Date | string): string {
  const t = new Date(ms(date) + (5 * 60 + 30) * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}
