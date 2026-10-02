/**
 * When may a class be moved to another date/time?
 *
 * Only while it is still ahead: its start time hasn't come yet and nobody has
 * started it. A class that was taught, missed, cancelled or simply whose
 * start time has passed can only be deleted or have its notes updated — it
 * can't be rescheduled. And a class can only be moved to a time that is
 * still in the future.
 */

export type RescheduleTarget = {
  startsAt: Date | string;
  status?: string | null;
  liveWhiteboardSession?: {
    actualStartedAt?: Date | string | null;
    livePhase?: string | null;
  } | null;
};

const fmt = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Why this class can't be rescheduled, or null when it can. */
export function rescheduleBlockReason(target: RescheduleTarget, now: Date = new Date()): string | null {
  const startsAt = new Date(target.startsAt);
  const wb = target.liveWhiteboardSession;
  if (target.status === "COMPLETED") return "This class has already been taken — it can't be rescheduled. You can delete it or update its notes.";
  if (target.status === "CANCELLED") return "This class is over (cancelled) — it can't be rescheduled. You can delete it or update its notes.";
  if (target.status === "LIVE" || wb?.actualStartedAt || ["LIVE", "ENDING", "ENDED"].includes(wb?.livePhase ?? "")) {
    return "This class has already started — it can't be rescheduled. You can delete it or update its notes.";
  }
  if (startsAt.getTime() <= now.getTime()) {
    return `This class's start time (${fmt(startsAt)}) has passed — it can't be rescheduled. You can delete it or update its notes.`;
  }
  return null;
}

/** A class can only be moved to (or created at) a time that is still ahead. */
export function newTimeBlockReason(newStartsAt: Date, now: Date = new Date()): string | null {
  if (newStartsAt.getTime() <= now.getTime()) return `Pick a date and time in the future — ${fmt(newStartsAt)} has already passed.`;
  return null;
}
