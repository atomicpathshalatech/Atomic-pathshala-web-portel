import { getPrisma } from "@/lib/ai-chat/prisma";
import { awardActivityXp } from "@/lib/gamification/xp-engine";

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

export async function awardXp(
  userId: string,
  amount: number,
  options?: { sourceId?: string; activityName?: string; idempotencyKey?: string; metadata?: Record<string, any> }
) {
  if (amount <= 0) return;

  try {
    await prisma.userProfile.update({
      where: { userId },
      data: { xp: { increment: Math.round(amount) } },
    });
  } catch (err) {
    // User profile may not exist yet in test/seed environments
  }

  try {
    const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
    if (student) {
      const activityName = options?.activityName || "CORRECT_ANSWER";
      const sourceEntityId = options?.sourceId || `quiz_${Date.now()}`;
      const idempotencyKey =
        options?.idempotencyKey ||
        (options?.sourceId ? `${activityName}:${options.sourceId}:${student.id}` : undefined);

      await awardActivityXp({
        studentId: student.id,
        activityName,
        sourceEntityId,
        idempotencyKey,
        payload: {
          userId,
          ...(options?.metadata || {}),
        },
        customXp: Math.round(amount),
      });
    }
  } catch (err) {
    console.warn("[ai-chat] student XP not awarded:", err);
  }
}

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

  // Award student daily login XP through centralized engine (ONCE_PER_DAY)
  try {
    const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
    if (student) {
      const todayStr = now.toISOString().split("T")[0];
      await awardActivityXp({
        studentId: student.id,
        activityName: "DAILY_LOGIN",
        sourceEntityId: todayStr,
        idempotencyKey: `DAILY_LOGIN:${todayStr}:${student.id}`,
        payload: { userId, loginDate: todayStr },
      });
    }
  } catch (err) {
    console.warn("[ai-chat] daily login student XP award failed:", err);
  }
}

export function xpForQuizResult(scorePercent: number) {
  return 10 + Math.round(scorePercent * 0.5);
}
