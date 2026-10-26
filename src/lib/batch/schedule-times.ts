/**
 * Lecture duration helpers with no server code — safe for browser components
 * (the batch schedule manager). The conflict check that uses the database
 * stays in ./schedule-conflict.
 */

export const COMMON_DURATIONS = [
  { label: "30 Mins", minutes: 30 },
  { label: "45 Mins", minutes: 45 },
  { label: "60 Mins (1 hr)", minutes: 60 },
  { label: "75 Mins (1.25 hr)", minutes: 75 },
  { label: "90 Mins (1.5 hr)", minutes: 90 },
  { label: "120 Mins (2 hrs)", minutes: 120 },
] as const;

/**
 * Calculates end time strictly from start time + duration in minutes
 */
export function calculateEndTime(startsAt: Date | string, durationMinutes: number): Date {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid start time provided.");
  }
  if (!durationMinutes || durationMinutes <= 0) {
    throw new Error("Lecture duration must be a positive number of minutes.");
  }
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}
