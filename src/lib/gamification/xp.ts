import "server-only";
import { prisma } from "@/lib/db";
import type { XPReason, Prisma } from "@prisma/client";

/**
 * XP → level curve. Deliberately simple (a smooth square-root ramp, so
 * early levels come quickly and later ones take progressively more XP) —
 * this is the one place that decides level thresholds; nothing else in the
 * codebase hardcodes them. Tune the divisor to change pacing.
 */
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}

function dateOnlyUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * The one and only way XP should ever be granted. Every route that awards
 * XP (test completion, DPP completion, live-class join, a resolved doubt,
 * ...) must call this instead of writing to XPEvent/Student directly — it's
 * what keeps the append-only event log and the Student.xp/level/streak
 * cache from ever drifting apart (see the comments on both in
 * schema.prisma).
 *
 * Also rolls the daily streak forward: if the student's last-XP day was
 * yesterday, currentStreakDays increments (longestStreakDays tracks the
 * high-water mark); if it was already today, the streak is left alone (XP
 * can be awarded more than once a day without inflating the streak); any
 * bigger gap resets the streak to 1. A brand-new student's first-ever award
 * also starts the streak at 1.
 */
export async function awardXp(
  studentId: string,
  amount: number,
  reason: XPReason,
  metadata?: Prisma.InputJsonValue
) {
  if (amount <= 0) return;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { xp: true, currentStreakDays: true, longestStreakDays: true, lastActivityDate: true },
  });
  if (!student) return;

  const today = dateOnlyUTC(new Date());
  const lastDay = student.lastActivityDate ? dateOnlyUTC(student.lastActivityDate) : null;
  const oneDayMs = 24 * 60 * 60 * 1000;

  let nextStreak: number;
  if (!lastDay) {
    nextStreak = 1;
  } else if (lastDay.getTime() === today.getTime()) {
    nextStreak = student.currentStreakDays;
  } else if (today.getTime() - lastDay.getTime() === oneDayMs) {
    nextStreak = student.currentStreakDays + 1;
  } else {
    nextStreak = 1;
  }
  const nextLongest = Math.max(student.longestStreakDays, nextStreak);
  const nextXp = student.xp + amount;

  await prisma.$transaction([
    prisma.xPEvent.create({
      data: { studentId, amount, reason, metadata },
    }),
    prisma.student.update({
      where: { id: studentId },
      data: {
        xp: nextXp,
        level: levelForXp(nextXp),
        currentStreakDays: nextStreak,
        longestStreakDays: nextLongest,
        lastActivityDate: today,
      },
    }),
  ]);
}
