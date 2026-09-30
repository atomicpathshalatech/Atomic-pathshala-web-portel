/**
 * When a scheduled test is announced, and when its results are released.
 *
 *  - The "upcoming test" popup shows from 24 hours before the test opens
 *    until the test window ends — never after.
 *  - A student sees their score, analysis, leaderboard and the paper PDF only
 *    once the scheduled window is over for everyone (not the moment they
 *    submit), so early finishers can't share answers.
 *  - DPPs are practice: their results are shown as soon as they're submitted.
 */

export type ScheduledTestLike = {
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
  durationMin?: number | null;
  batchSchedule?: { startsAt?: Date | string | null; endsAt?: Date | string | null; type?: string | null } | null;
};

export const POPUP_LEAD_MS = 24 * 60 * 60 * 1000;

const toDate = (d: Date | string | null | undefined): Date | null => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function isDppTest(test: ScheduledTestLike): boolean {
  return (test.batchSchedule?.type ?? "").toUpperCase() === "DPP";
}

/** When the test opens (its own open time, else its class-schedule slot). */
export function testWindowStart(test: ScheduledTestLike): Date | null {
  return toDate(test.openTime) ?? toDate(test.batchSchedule?.startsAt);
}

/** When the test window closes for everyone; null when the test has no schedule at all. */
export function testWindowEnd(test: ScheduledTestLike): Date | null {
  const close = toDate(test.closeTime) ?? toDate(test.batchSchedule?.endsAt);
  if (close) return close;
  const start = testWindowStart(test);
  if (start && test.durationMin && test.durationMin > 0) return new Date(start.getTime() + test.durationMin * 60_000);
  return null;
}

/** When students may see results; null = straight away (unscheduled tests and DPPs). */
export function resultsReleaseAt(test: ScheduledTestLike): Date | null {
  if (isDppTest(test)) return null;
  return testWindowEnd(test);
}

export function areResultsReleased(test: ScheduledTestLike, now: Date = new Date()): boolean {
  const at = resultsReleaseAt(test);
  return !at || now.getTime() >= at.getTime();
}

/** The upcoming-test popup: 24 h before it opens → until its window ends. */
export function isInUpcomingPopupWindow(test: ScheduledTestLike, now: Date = new Date()): boolean {
  const start = testWindowStart(test);
  if (!start) return false;
  const end = testWindowEnd(test) ?? start;
  const t = now.getTime();
  return t >= start.getTime() - POPUP_LEAD_MS && t <= end.getTime();
}
