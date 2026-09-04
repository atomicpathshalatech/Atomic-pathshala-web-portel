/**
 * UNIVERSAL INDIAN STANDARD TIME (IST - Asia/Kolkata) DATE & TIME UTILITY
 *
 * Guarantees 100% time synchronization across all Student and Teacher portals,
 * schedules, tests, live classes, DPPs, and servers.
 *
 * Timezone: Asia/Kolkata (UTC+05:30)
 */

export const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Converts any Date or ISO string into formatted IST time (e.g. "12:00 PM", "10:30 AM")
 */
export function formatISTTime(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return "";
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleTimeString("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  });
}

/**
 * Converts any Date or ISO string into formatted IST date (e.g. "4 Sep 2026", "04/09/2026")
 */
export function formatISTDate(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return "";
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
}

/**
 * Converts any Date or ISO string into formatted IST Date & Time (e.g. "4 Sep 2026, 12:00 PM")
 */
export function formatISTDateTime(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return "";
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleString("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  });
}

/**
 * Formats day header in Indian calendar: "Today", "Tomorrow", "Yesterday", or "Friday, 4 Sep 2026"
 */
export function formatISTDayLabel(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();

  // Get IST date strings (YYYY-MM-DD) for comparison
  const istDateString = (target: Date) =>
    target.toLocaleDateString("en-CA", { timeZone: IST_TIMEZONE }); // en-CA gives YYYY-MM-DD

  const targetDay = istDateString(d);
  const today = istDateString(now);

  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrow = istDateString(tomorrowDate);

  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterday = istDateString(yesterdayDate);

  if (targetDay === today) return "Today";
  if (targetDay === tomorrow) return "Tomorrow";
  if (targetDay === yesterday) return "Yesterday";

  return d.toLocaleDateString("en-IN", {
    timeZone: IST_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Converts a Date to YYYY-MM-DDTHH:mm string in IST for <input type="datetime-local" />
 */
export function toISTDateTimeLocal(value: Date | string | number | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "object" ? value : new Date(value);
  if (isNaN(d.getTime())) return "";

  // Extract components in Asia/Kolkata timezone
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  // Ensure 24h format with 2 digits
  let hour = map.hour || "00";
  if (hour === "24") hour = "00";

  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute || "00"}`;
}

/**
 * Parses user input from <input type="datetime-local"> strictly as IST (UTC+05:30)
 * Prevents timezone offset shifts when saved to DB or rendered across servers.
 */
export function parseISTDateTimeInput(localString: string): Date {
  if (!localString) return new Date();

  // If already has timezone offset (+05:30 or Z)
  if (localString.includes("+") || localString.endsWith("Z")) {
    return new Date(localString);
  }

  // Format: "YYYY-MM-DDTHH:mm" -> Append IST offset "+05:30"
  const clean = localString.length === 16 ? `${localString}:00+05:30` : `${localString}+05:30`;
  const parsed = new Date(clean);

  if (isNaN(parsed.getTime())) {
    return new Date(localString);
  }

  return parsed;
}

/**
 * Checks if a given timestamp falls on Today in Indian Standard Time (Asia/Kolkata)
 */
export function isTodayInIST(date: Date | string | number): boolean {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return false;

  const istDateString = (target: Date) =>
    target.toLocaleDateString("en-CA", { timeZone: IST_TIMEZONE });

  return istDateString(d) === istDateString(new Date());
}

/**
 * Returns a day grouping key (YYYY-MM-DD) in Indian Standard Time
 */
export function getISTDayKey(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: IST_TIMEZONE });
}

/**
 * Calculates exact startsAt and endsAt in UTC given an Indian date, time string (e.g. "10:00" or "10:00 AM"),
 * and duration in minutes.
 * Guarantees identical time rendering in both Teacher and Student portals.
 */
export function computeISTScheduleDates(
  scheduledDate: Date | string | null | undefined,
  startTimeStr: string | null | undefined,
  durationMin: number = 60
): { startsAt: Date; endsAt: Date } {
  const dateBase = scheduledDate ? new Date(scheduledDate) : new Date();
  const yyyyMmDd = dateBase.toLocaleDateString("en-CA", { timeZone: IST_TIMEZONE });

  let hh = 10;
  let mm = 0;
  if (startTimeStr) {
    const cleanTime = startTimeStr.trim();
    const match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (match && match[1] && match[2]) {
      let rawH = parseInt(match[1], 10);
      const rawM = parseInt(match[2], 10);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem === "PM" && rawH < 12) rawH += 12;
      if (meridiem === "AM" && rawH === 12) rawH = 0;
      hh = rawH;
      mm = rawM;
    }
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  const isoWithOffset = `${yyyyMmDd}T${pad(hh)}:${pad(mm)}:00+05:30`;
  const startsAt = new Date(isoWithOffset);
  const endsAt = new Date(startsAt.getTime() + (durationMin || 60) * 60 * 1000);

  return { startsAt, endsAt };
}
