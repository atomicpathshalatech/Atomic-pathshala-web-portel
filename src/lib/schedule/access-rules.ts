/**
 * AUTHORITATIVE LIVE CLASS SCHEDULE ACCESS & STATE MACHINE RULES
 *
 * Enforces the authoritative time rules and lifecycle state machine for Live Classes:
 * 
 * TIME RULES:
 * - scheduled_start_at: The scheduled start timestamp
 * - Teacher Entry Window: scheduled_start_at - 15 minutes (T-15)
 *     -> T-15 to T-5: Teacher Entry = ENABLED, Start Class = DISABLED
 * - Teacher Start Window: scheduled_start_at - 5 minutes (T-5)
 *     -> T-5 to T-0: Teacher Entry = ENABLED, Start Class = ENABLED
 *     -> T-0 & After: Teacher Entry = ENABLED, Start Class = ENABLED (until completed/cancelled)
 * - Schedule Expiry: scheduled_start_at + 30 minutes (T+30) without start -> CANCELLED/EXPIRED
 * - Student Join Window: scheduled_start_at - 15 minutes (T-15) or whenever class is LIVE
 *
 * Timezone: Asia/Kolkata (UTC+05:30)
 * All checks strictly evaluated against server-authoritative time.
 */

export const TEACHER_ENTRY_WINDOW_MINUTES = 15;
export const TEACHER_ENTRY_WINDOW_MS = TEACHER_ENTRY_WINDOW_MINUTES * 60 * 1000;

export const TEACHER_START_WINDOW_MINUTES = 5;
export const TEACHER_START_WINDOW_MS = TEACHER_START_WINDOW_MINUTES * 60 * 1000;

export const STUDENT_JOIN_WINDOW_MINUTES = 15;
export const STUDENT_JOIN_WINDOW_MS = STUDENT_JOIN_WINDOW_MINUTES * 60 * 1000;

export const SCHEDULE_EXPIRY_MINUTES = 30;
export const SCHEDULE_EXPIRY_MS = SCHEDULE_EXPIRY_MINUTES * 60 * 1000;

// Backward-compatibility aliases
export const JOIN_WINDOW_MINUTES = TEACHER_ENTRY_WINDOW_MINUTES;
export const JOIN_WINDOW_MS = TEACHER_ENTRY_WINDOW_MS;

export type NormalizedScheduleStatus =
  | "SCHEDULED"
  | "TEACHER_ENTRY_OPEN"
  | "READY"
  | "STARTING_SOON"
  | "LIVE"
  | "ENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
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
    actualStartedAt?: Date | string | null;
  } | null;
}

export interface AccessEvaluation {
  allowed: boolean;
  status: NormalizedScheduleStatus;
  code: "OK" | "START_TOO_EARLY" | "START_NOT_ALLOWED" | "ENTRY_TOO_EARLY" | "JOIN_TOO_EARLY" | "CANCELLED" | "COMPLETED" | "NOT_FOUND";
  reason?: string;
  opensAt: Date;        // T-15 (teacher entry & student lobby opening)
  startOpensAt: Date;   // T-5 (teacher live start opening)
  startsAt: Date;       // T-0 (scheduled start)
  endsAt: Date;         // Scheduled end
  isLive: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  isWindowOpen: boolean;
  secondsUntilWindowOpens: number;  // Seconds until T-15
  secondsUntilStartOpens: number;   // Seconds until T-5
  secondsUntilStartsAt: number;      // Seconds until T-0
}

/**
 * Normalizes start, end, T-15, and T-5 window dates from any schedule target
 */
export function getScheduleWindowDates(schedule: ScheduleAccessTarget): {
  startsAt: Date;
  endsAt: Date;
  opensAt: Date;
  startOpensAt: Date;
  expiresAt: Date;
} {
  const startsAt = new Date(schedule.startsAt);
  const endsAt = new Date(schedule.endsAt);
  const opensAt = new Date(startsAt.getTime() - TEACHER_ENTRY_WINDOW_MS);
  const startOpensAt = new Date(startsAt.getTime() - TEACHER_START_WINDOW_MS);
  const expiresAt = new Date(startsAt.getTime() + SCHEDULE_EXPIRY_MS);
  return { startsAt, endsAt, opensAt, startOpensAt, expiresAt };
}

/**
 * Helper to determine if a class has genuinely started and is currently live
 */
export function isScheduleGenuinelyLive(schedule: ScheduleAccessTarget): boolean {
  if (schedule.status === "CANCELLED" || schedule.status === "COMPLETED") return false;
  if (schedule.liveWhiteboardSession?.status === "ENDED" || schedule.liveWhiteboardSession?.livePhase === "ENDED") {
    return false;
  }
  return (
    schedule.liveWhiteboardSession?.livePhase === "LIVE" ||
    (schedule.status === "LIVE" &&
      schedule.liveWhiteboardSession?.livePhase !== "PREPARING" &&
      schedule.liveWhiteboardSession?.livePhase !== "SCHEDULED")
  );
}

/**
 * Authoritative Teacher Pre-Class Room Entry Check
 * Window: scheduled_start_at - 15 minutes (T-15)
 * Teacher may enter the pre-flight whiteboard room starting at T-15.
 */
export function canTeacherEnterClass(
  schedule: ScheduleAccessTarget,
  serverNow: Date = new Date()
): AccessEvaluation {
  const { startsAt, endsAt, opensAt, startOpensAt, expiresAt } = getScheduleWindowDates(schedule);
  const nowMs = serverNow.getTime();

  const isCancelled = schedule.status === "CANCELLED";
  const isCompleted =
    schedule.status === "COMPLETED" ||
    (schedule.liveWhiteboardSession?.status === "ENDED" &&
      schedule.liveWhiteboardSession?.livePhase === "ENDED");
  const isLive = isScheduleGenuinelyLive(schedule);

  const secondsUntilWindowOpens = Math.max(0, Math.ceil((opensAt.getTime() - nowMs) / 1000));
  const secondsUntilStartOpens = Math.max(0, Math.ceil((startOpensAt.getTime() - nowMs) / 1000));
  const secondsUntilStartsAt = Math.max(0, Math.ceil((startsAt.getTime() - nowMs) / 1000));

  if (isCancelled) {
    return {
      allowed: false,
      status: "CANCELLED",
      code: "CANCELLED",
      reason: "This class has been cancelled.",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: true,
      isWindowOpen: false,
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  if (isCompleted) {
    return {
      allowed: false,
      status: "COMPLETED",
      code: "COMPLETED",
      reason: "This live class has already concluded.",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: true,
      isCancelled: false,
      isWindowOpen: false,
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  if (isLive) {
    return {
      allowed: true,
      status: "LIVE",
      code: "OK",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: true,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: true,
      secondsUntilWindowOpens: 0,
      secondsUntilStartOpens: 0,
      secondsUntilStartsAt: 0,
    };
  }

  // If 30 minutes have passed since scheduled startsAt and class was never started -> CANCELLED
  if (!isLive && nowMs >= expiresAt.getTime()) {
    return {
      allowed: false,
      status: "CANCELLED",
      code: "CANCELLED",
      reason: "Class window has expired (educator did not start session within 30 minutes of scheduled time).",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: true,
      isWindowOpen: false,
      secondsUntilWindowOpens: 0,
      secondsUntilStartOpens: 0,
      secondsUntilStartsAt: 0,
    };
  }

  // Check if before T-15 entry window
  if (nowMs < opensAt.getTime()) {
    return {
      allowed: false,
      status: "SCHEDULED",
      code: "ENTRY_TOO_EARLY",
      reason: "Pre-class room entry is not open yet. Teacher entry opens 15 minutes before scheduled start time.",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: false,
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  // Between T-15 and T-5: Teacher entry is enabled, preparing
  if (nowMs < startOpensAt.getTime()) {
    return {
      allowed: true,
      status: "TEACHER_ENTRY_OPEN",
      code: "OK",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: true,
      secondsUntilWindowOpens: 0,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  // T-5 and after: Ready to start
  return {
    allowed: true,
    status: "READY",
    code: "OK",
    opensAt,
    startOpensAt,
    startsAt,
    endsAt,
    isLive: false,
    isCompleted: false,
    isCancelled: false,
    isWindowOpen: true,
    secondsUntilWindowOpens: 0,
    secondsUntilStartOpens: 0,
    secondsUntilStartsAt,
  };
}

/**
 * Authoritative Teacher Start Class Check
 * Rule: Start Class is strictly FORBIDDEN before (scheduled_start_at - 5 minutes).
 * T-15 to T-5: Teacher entry = ENABLED, Start Class = DISABLED
 * T-5 to T-0: Teacher entry = ENABLED, Start Class = ENABLED
 * T-0 & After: Teacher entry = ENABLED, Start Class = ENABLED (until concluded/expired)
 */
export function canTeacherStartClass(
  schedule: ScheduleAccessTarget,
  serverNow: Date = new Date()
): AccessEvaluation {
  const { startsAt, endsAt, opensAt, startOpensAt, expiresAt } = getScheduleWindowDates(schedule);
  const nowMs = serverNow.getTime();

  const isCancelled = schedule.status === "CANCELLED";
  const isCompleted =
    schedule.status === "COMPLETED" ||
    (schedule.liveWhiteboardSession?.status === "ENDED" &&
      schedule.liveWhiteboardSession?.livePhase === "ENDED");
  const isLive = isScheduleGenuinelyLive(schedule);

  const secondsUntilWindowOpens = Math.max(0, Math.ceil((opensAt.getTime() - nowMs) / 1000));
  const secondsUntilStartOpens = Math.max(0, Math.ceil((startOpensAt.getTime() - nowMs) / 1000));
  const secondsUntilStartsAt = Math.max(0, Math.ceil((startsAt.getTime() - nowMs) / 1000));

  if (isCancelled) {
    return {
      allowed: false,
      status: "CANCELLED",
      code: "START_NOT_ALLOWED",
      reason: "This class has been cancelled and cannot be started.",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: true,
      isWindowOpen: false,
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  if (isCompleted) {
    return {
      allowed: false,
      status: "COMPLETED",
      code: "START_NOT_ALLOWED",
      reason: "This live class has already concluded.",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: true,
      isCancelled: false,
      isWindowOpen: false,
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  if (isLive) {
    return {
      allowed: true,
      status: "LIVE",
      code: "OK",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: true,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: true,
      secondsUntilWindowOpens: 0,
      secondsUntilStartOpens: 0,
      secondsUntilStartsAt: 0,
    };
  }

  // If 30 minutes have passed since scheduled startsAt and class was never started -> CANCELLED
  if (!isLive && nowMs >= expiresAt.getTime()) {
    return {
      allowed: false,
      status: "CANCELLED",
      code: "START_NOT_ALLOWED",
      reason: "Class window has expired (session was not started within 30 minutes of scheduled time).",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: true,
      isWindowOpen: false,
      secondsUntilWindowOpens: 0,
      secondsUntilStartOpens: 0,
      secondsUntilStartsAt: 0,
    };
  }

  // STRICT T-5 RULE: Cannot start before startsAt - 5 minutes
  if (nowMs < startOpensAt.getTime()) {
    return {
      allowed: false,
      status: nowMs >= opensAt.getTime() ? "TEACHER_ENTRY_OPEN" : "SCHEDULED",
      code: "START_TOO_EARLY",
      reason: "Start Class is not available yet. Classes can only be started starting 5 minutes before scheduled start time.",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: nowMs >= opensAt.getTime(),
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  // T-5 reached: Start Class is allowed
  return {
    allowed: true,
    status: "READY",
    code: "OK",
    opensAt,
    startOpensAt,
    startsAt,
    endsAt,
    isLive: false,
    isCompleted: false,
    isCancelled: false,
    isWindowOpen: true,
    secondsUntilWindowOpens: 0,
    secondsUntilStartOpens: 0,
    secondsUntilStartsAt,
  };
}

/**
 * Authoritative Student Live Class Access Check
 * Rule: Student can enter the lobby/waiting room starting at T-15 (or whenever class is LIVE).
 * Cannot enter before T-15.
 */
export function canStudentJoinClass(
  schedule: ScheduleAccessTarget,
  serverNow: Date = new Date()
): AccessEvaluation {
  const { startsAt, endsAt, opensAt, startOpensAt, expiresAt } = getScheduleWindowDates(schedule);
  const nowMs = serverNow.getTime();

  const isCancelled = schedule.status === "CANCELLED";
  const isCompleted =
    schedule.status === "COMPLETED" ||
    (schedule.liveWhiteboardSession?.status === "ENDED" &&
      schedule.liveWhiteboardSession?.livePhase === "ENDED");
  const isLive = isScheduleGenuinelyLive(schedule);

  const secondsUntilWindowOpens = Math.max(0, Math.ceil((opensAt.getTime() - nowMs) / 1000));
  const secondsUntilStartOpens = Math.max(0, Math.ceil((startOpensAt.getTime() - nowMs) / 1000));
  const secondsUntilStartsAt = Math.max(0, Math.ceil((startsAt.getTime() - nowMs) / 1000));

  if (isCancelled) {
    return {
      allowed: false,
      status: "CANCELLED",
      code: "CANCELLED",
      reason: "This class has been cancelled.",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: true,
      isWindowOpen: false,
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  if (isCompleted && !isLive) {
    return {
      allowed: false,
      status: "COMPLETED",
      code: "COMPLETED",
      reason: "This live class has already concluded.",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: true,
      isCancelled: false,
      isWindowOpen: false,
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  if (isLive) {
    return {
      allowed: true,
      status: "LIVE",
      code: "OK",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: true,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: true,
      secondsUntilWindowOpens: 0,
      secondsUntilStartOpens: 0,
      secondsUntilStartsAt: 0,
    };
  }

  // If 30 minutes have passed since scheduled startsAt and class was not started -> CANCELLED
  if (nowMs >= expiresAt.getTime()) {
    return {
      allowed: false,
      status: "CANCELLED",
      code: "CANCELLED",
      reason: "Class cancelled (educator did not commence session within 30 minutes of scheduled start).",
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: true,
      isWindowOpen: false,
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  // Before T-15 entry window -> Student cannot enter
  if (nowMs < opensAt.getTime()) {
    return {
      allowed: false,
      status: "SCHEDULED",
      code: "JOIN_TOO_EARLY",
      reason: `Classroom access opens 15 minutes before scheduled start time.`,
      opensAt,
      startOpensAt,
      startsAt,
      endsAt,
      isLive: false,
      isCompleted: false,
      isCancelled: false,
      isWindowOpen: false,
      secondsUntilWindowOpens,
      secondsUntilStartOpens,
      secondsUntilStartsAt,
    };
  }

  // T-15 to T-5 (or before live): Student can enter waiting room / lobby
  return {
    allowed: true,
    status: nowMs >= startOpensAt.getTime() ? "READY" : "STARTING_SOON",
    code: "OK",
    opensAt,
    startOpensAt,
    startsAt,
    endsAt,
    isLive: false,
    isCompleted: false,
    isCancelled: false,
    isWindowOpen: true,
    secondsUntilWindowOpens: 0,
    secondsUntilStartOpens,
    secondsUntilStartsAt,
  };
}

/**
 * Returns Unified Normalized Schedule Status across all lifecycle states
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

  const { startsAt, endsAt, opensAt, startOpensAt, expiresAt } = getScheduleWindowDates(schedule);
  const nowMs = serverNow.getTime();

  // Authoritative check: Truly live only if teacher has started the session
  const isLive = isScheduleGenuinelyLive(schedule);
  if (isLive && nowMs <= endsAt.getTime() + 4 * 60 * 60 * 1000) {
    return "LIVE";
  }

  // If 30 minutes have passed since scheduled startsAt and class hasn't started/live -> CANCELLED
  if (!isLive && nowMs >= expiresAt.getTime()) {
    return "CANCELLED";
  }

  // Before T-15: strictly SCHEDULED
  if (nowMs < opensAt.getTime()) {
    return "SCHEDULED";
  }

  // T-15 to T-5: TEACHER_ENTRY_OPEN / STARTING_SOON
  if (nowMs < startOpensAt.getTime()) {
    return "TEACHER_ENTRY_OPEN";
  }

  // T-5 onwards (until live or expired): READY
  return "READY";
}

// Aliases for backwards compatibility with existing callers
export const canTeacherStart = canTeacherStartClass;
export const canStudentJoin = canStudentJoinClass;
export const canTeacherEnter = canTeacherEnterClass;
