/**
 * AUTHORITATIVE LIVE CLASS SCHEDULE ACCESS & STATE MACHINE RULES
 *
 * Enforces the exact 15-minute access window boundary for both Students and Teachers.
 * Time boundary rule: currentServerTime >= lectureStartTime - 15 minutes.
 * Timezone: Asia/Kolkata (UTC+05:30)
 */

export const JOIN_WINDOW_MINUTES = 15;
export const JOIN_WINDOW_MS = JOIN_WINDOW_MINUTES * 60 * 1000;

export type NormalizedScheduleStatus =
  | "SCHEDULED"
  | "STARTING_SOON"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "NOT_CONDUCTED";

export interface ScheduleAccessTarget {
  id: string;
  startsAt: Date | string;
  endsAt: Date | string;
  status: string; // SCHEDULED | LIVE | COMPLETED | CANCELLED
  type?: string;  // LIVE_CLASS | TEST | DPP | etc.
  liveWhiteboardSession?: {
    id?: string;
    status?: string;   // ACTIVE | ENDED
    livePhase?: string; // SCHEDULED | PREPARING | LIVE | ENDED
  } | null;
}

export interface AccessEvaluation {
  allowed: boolean;
  status: NormalizedScheduleStatus;
  reason?: string;
  opensAt: Date;
  startsAt: Date;
  endsAt: Date;
  isLive: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  isWindowOpen: boolean;
  secondsUntilWindowOpens: number;
}

/**
 * Normalizes start, end, and window dates from any schedule target
 */
export function getScheduleWindowDates(schedule: ScheduleAccessTarget): {
  startsAt: Date;
  endsAt: Date;
  opensAt: Date;
} {
  const startsAt = new Date(schedule.startsAt);
  const endsAt = new Date(schedule.endsAt);
  const opensAt = new Date(startsAt.getTime() - JOIN_WINDOW_MS);
  return { startsAt, endsAt, opensAt };
}

/**
 * Authoritative Student Live Class Access Check
 * Rule: Access is allowed if and only if (currentServerTime >= startsAt - 15 min) AND not cancelled/completed.
 * If the session is already marked LIVE by the teacher, student can always join.
 */
export function canStudentJoin(
  schedule: ScheduleAccessTarget,
  serverNow: Date = new Date()
): AccessEvaluation {
  const { startsAt, endsAt, opensAt } = getScheduleWindowDates(schedule);
  const nowMs = serverNow.getTime();

  const isCancelled = schedule.status === "CANCELLED";
  const isCompleted =
    schedule.status === "COMPLETED" ||
    schedule.liveWhiteboardSession?.status === "ENDED" ||
    schedule.liveWhiteboardSession?.livePhase === "ENDED";
  const isLive =
    schedule.status === "LIVE" ||
    schedule.liveWhiteboardSession?.livePhase === "LIVE";

  const isWindowOpen = nowMs >= opensAt.getTime();
  const secondsUntilWindowOpens = Math.max(0, Math.ceil((opensAt.getTime() - nowMs) / 1000));

  if (isCancelled) {
    return {
      allowed: false,
      status: "CANCELLED",
      reason: "This class has been cancelled.",
      opensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: true,
      isWindowOpen: false,
      secondsUntilWindowOpens: 0,
    };
  }

  if (isCompleted) {
    return {
      allowed: false,
      status: "COMPLETED",
      reason: "This live class has already concluded.",
      opensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: true,
      isCancelled: false,
      isWindowOpen: false,
      secondsUntilWindowOpens: 0,
    };
  }

  if (isLive) {
    return {
      allowed: true,
      status: "LIVE",
      opensAt,
      startsAt,
      endsAt,
      isLive: true,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: true,
      secondsUntilWindowOpens: 0,
    };
  }

  if (!isWindowOpen) {
    return {
      allowed: false,
      status: "SCHEDULED",
      reason: `Class access opens exactly 15 minutes before scheduled start time (${opensAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true })}).`,
      opensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: false,
      secondsUntilWindowOpens,
    };
  }

  // Window is open (T-15 onward)
  return {
    allowed: true,
    status: "STARTING_SOON",
    opensAt,
    startsAt,
    endsAt,
    isLive: false,
    isCompleted: false,
    isCancelled: false,
    isWindowOpen: true,
    secondsUntilWindowOpens: 0,
  };
}

/**
 * Authoritative Teacher Start Class Access Check
 * Rule: Teacher can only start/pre-flight if (currentServerTime >= startsAt - 15 min) AND not cancelled/completed.
 */
export function canTeacherStart(
  schedule: ScheduleAccessTarget,
  serverNow: Date = new Date()
): AccessEvaluation {
  const { startsAt, endsAt, opensAt } = getScheduleWindowDates(schedule);
  const nowMs = serverNow.getTime();

  const isCancelled = schedule.status === "CANCELLED";
  const isCompleted =
    schedule.status === "COMPLETED" ||
    schedule.liveWhiteboardSession?.status === "ENDED" ||
    schedule.liveWhiteboardSession?.livePhase === "ENDED";
  const isLive =
    schedule.status === "LIVE" ||
    schedule.liveWhiteboardSession?.livePhase === "LIVE";

  const isWindowOpen = nowMs >= opensAt.getTime();
  const secondsUntilWindowOpens = Math.max(0, Math.ceil((opensAt.getTime() - nowMs) / 1000));

  if (isCancelled) {
    return {
      allowed: false,
      status: "CANCELLED",
      reason: "This class has been cancelled and cannot be started.",
      opensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: true,
      isWindowOpen: false,
      secondsUntilWindowOpens: 0,
    };
  }

  if (isCompleted) {
    return {
      allowed: false,
      status: "COMPLETED",
      reason: "This live class has already concluded.",
      opensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: true,
      isCancelled: false,
      isWindowOpen: false,
      secondsUntilWindowOpens: 0,
    };
  }

  if (isLive) {
    return {
      allowed: true,
      status: "LIVE",
      opensAt,
      startsAt,
      endsAt,
      isLive: true,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: true,
      secondsUntilWindowOpens: 0,
    };
  }

  if (!isWindowOpen) {
    return {
      allowed: false,
      status: "SCHEDULED",
      reason: `Live class can only be started within 15 minutes of scheduled time (from ${opensAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true })}).`,
      opensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: false,
      secondsUntilWindowOpens,
    };
  }

  return {
    allowed: true,
    status: "STARTING_SOON",
    opensAt,
    startsAt,
    endsAt,
    isLive: false,
    isCompleted: false,
    isCancelled: false,
    isWindowOpen: true,
    secondsUntilWindowOpens: 0,
  };
}

/**
 * Returns Normalized Schedule Status across all lifecycle states
 */
export function getEffectiveScheduleStatus(
  schedule: ScheduleAccessTarget,
  serverNow: Date = new Date()
): NormalizedScheduleStatus {
  if (schedule.status === "CANCELLED") return "CANCELLED";
  if (
    schedule.status === "COMPLETED" ||
    schedule.liveWhiteboardSession?.status === "ENDED" ||
    schedule.liveWhiteboardSession?.livePhase === "ENDED"
  ) {
    return "COMPLETED";
  }
  if (
    schedule.status === "LIVE" ||
    schedule.liveWhiteboardSession?.livePhase === "LIVE"
  ) {
    return "LIVE";
  }

  const { startsAt, endsAt, opensAt } = getScheduleWindowDates(schedule);
  const nowMs = serverNow.getTime();

  if (nowMs > endsAt.getTime() + 15 * 60 * 1000) {
    return "NOT_CONDUCTED";
  }

  if (nowMs >= opensAt.getTime()) {
    return "STARTING_SOON";
  }

  return "SCHEDULED";
}
