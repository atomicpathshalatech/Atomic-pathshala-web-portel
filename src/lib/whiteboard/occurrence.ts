/**
 * One class row is reused every time a class is run. Two very different
 * things reach the "this session already ended, start again" code:
 *
 *   - the SAME class started again — it was ended by mistake, auto-ended, or
 *     its stream failed and the teacher pressed Start once more. Its board
 *     (every slide written so far) must stay.
 *   - a class that was MOVED to a later time after it ended and is now being
 *     run again. That is a new lecture and starts with a clean board.
 *
 * The board used to be deleted in both cases, so restarting a class wiped
 * everything the teacher had written.
 */
export function isSameClassRestart(
  schedule: { startsAt: Date; rescheduledAt?: Date | null },
  session: { endedAt?: Date | null; actualEndedAt?: Date | null }
): boolean {
  const ended = session.actualEndedAt ?? session.endedAt ?? null;
  if (!ended) return true;
  if (schedule.rescheduledAt && schedule.rescheduledAt.getTime() > ended.getTime()) return false;
  // Scheduled to begin hours after the previous run ended = a later re-run.
  return schedule.startsAt.getTime() - ended.getTime() < 3 * 3600_000;
}
