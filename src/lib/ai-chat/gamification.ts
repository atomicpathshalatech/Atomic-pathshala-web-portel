import { getPrisma } from "@/lib/ai-chat/prisma";

const prisma = getPrisma();

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(previous: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameCalendarDay(previous, yesterday);
}

export async function awardXp(userId: string, amount: number) {
  if (amount <= 0) return;
  await prisma.userProfile.update({
    where: { userId },
    data: { xp: { increment: Math.round(amount) } },
  });
}

// Call once per meaningful activity (chat message, quiz submit). Awards the
// "first activity of the day" bonus and updates streak counters. Safe to call
// multiple times per day — only the first call each day has any effect.
export async function registerDailyActivity(userId: string) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) return;

  const now = new Date();
  const last = profile.lastActiveDate;

  if (last && isSameCalendarDay(last, now)) {
    return;
  }

  const continuesStreak = last ? isYesterday(last, now) : false;
  const nextStreak = continuesStreak ? profile.currentStreak + 1 : 1;
  const nextLongest = Math.max(profile.longestStreak, nextStreak);

  await prisma.userProfile.update({
    where: { userId },
    data: {
      currentStreak: nextStreak,
      longestStreak: nextLongest,
      lastActiveDate: now,
      xp: { increment: 5 },
    },
  });
}

export function xpForQuizResult(scorePercent: number) {
  return 10 + Math.round(scorePercent * 0.5);
}
