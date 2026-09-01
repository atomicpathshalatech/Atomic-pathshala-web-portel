import { prisma } from "@/lib/db";

export type ConflictCheckResult = {
  hasConflict: boolean;
  conflictType?: "BATCH" | "TEACHER" | "INTERNAL";
  message?: string;
  conflictingTitle?: string;
  conflictingBatchName?: string;
  conflictStart?: string;
  conflictEnd?: string;
};

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

/**
 * Format time range for conflict messages
 */
function formatTimeRange(start: Date, end: Date): string {
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return `${formatDate(start)} (${formatTime(start)} → ${formatTime(end)})`;
}

/**
 * Centralized Server-Side Conflict Detection Engine:
 * - Checks Batch Overlap (same batch cannot have overlapping classes)
 * - Checks Teacher Overlap (same faculty cannot teach two classes simultaneously across any batch)
 * - Excludes the current schedule entry when editing
 */
export async function checkScheduleConflict({
  batchId,
  teacherId,
  startsAt,
  endsAt,
  excludeScheduleId,
}: {
  batchId: string;
  teacherId?: string | null;
  startsAt: Date;
  endsAt: Date;
  excludeScheduleId?: string;
}): Promise<ConflictCheckResult> {
  // 1. Batch Overlap Check: Two classes in the same batch overlap if startsAt < B.endsAt AND endsAt > B.startsAt
  const batchConflict = await prisma.batchSchedule.findFirst({
    where: {
      batchId,
      status: { not: "CANCELLED" },
      ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    include: { batch: true },
  });

  if (batchConflict) {
    const range = formatTimeRange(batchConflict.startsAt, batchConflict.endsAt);
    return {
      hasConflict: true,
      conflictType: "BATCH",
      message: `Schedule Conflict: This batch already has a class scheduled from ${range} ("${batchConflict.title}").`,
      conflictingTitle: batchConflict.title,
      conflictingBatchName: batchConflict.batch.name,
      conflictStart: batchConflict.startsAt.toISOString(),
      conflictEnd: batchConflict.endsAt.toISOString(),
    };
  }

  // 2. Teacher Overlap Check: A faculty member cannot be booked across any batch during this time
  if (teacherId) {
    const teacherConflict = await prisma.batchSchedule.findFirst({
      where: {
        teacherId,
        status: { not: "CANCELLED" },
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      include: { batch: true, teacher: { include: { user: true } } },
    });

    if (teacherConflict) {
      const range = formatTimeRange(teacherConflict.startsAt, teacherConflict.endsAt);
      const teacherName = teacherConflict.teacher?.user.name || "This faculty member";
      return {
        hasConflict: true,
        conflictType: "TEACHER",
        message: `Teacher Schedule Conflict: ${teacherName} already has another class scheduled during this time (${teacherConflict.batch.name}: ${range} — "${teacherConflict.title}").`,
        conflictingTitle: teacherConflict.title,
        conflictingBatchName: teacherConflict.batch.name,
        conflictStart: teacherConflict.startsAt.toISOString(),
        conflictEnd: teacherConflict.endsAt.toISOString(),
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Bulk Internal Conflict Check:
 * Compares entries within a bulk scheduling array pairwise to prevent internal overlaps
 */
export function checkBulkInternalConflicts(
  entries: Array<{
    title: string;
    startsAt: Date;
    endsAt: Date;
    teacherId?: string | null;
  }>
): ConflictCheckResult {
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (!a || !b) continue;

      // Check time overlap: a.startsAt < b.endsAt AND a.endsAt > b.startsAt
      if (a.startsAt < b.endsAt && a.endsAt > b.startsAt) {
        const rangeA = formatTimeRange(a.startsAt, a.endsAt);
        const rangeB = formatTimeRange(b.startsAt, b.endsAt);
        return {
          hasConflict: true,
          conflictType: "INTERNAL",
          message: `Bulk Schedule Conflict: "${a.title}" (${rangeA}) overlaps with "${b.title}" (${rangeB}). Please resolve before confirming.`,
          conflictingTitle: a.title,
          conflictStart: a.startsAt.toISOString(),
          conflictEnd: a.endsAt.toISOString(),
        };
      }
    }
  }

  return { hasConflict: false };
}
