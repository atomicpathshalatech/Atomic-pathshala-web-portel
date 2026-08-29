import { getPrisma } from "@/lib/ai-chat/prisma";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export interface DashboardStats {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  accuracy: number | null;
  consistency: number;
  healthScore: number;
  heatmap: { date: string; count: number; level: number }[];
  subjectConfidence: { subject: string; confidence: number; attempts: number }[];
  weakChapters: string[];
  strongChapters: string[];
  favoriteSubject: string | null;
}

export async function computeDashboardStats(userId: string): Promise<DashboardStats> {
  const prisma = getPrisma();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [profile, recentAttempts, allAttemptsForSubjects, usageEvents] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.testAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.testAttempt.findMany({
      where: { userId, subject: { not: null } },
      select: { subject: true, score: true, maxScore: true },
    }),
    prisma.usageEvent.findMany({
      where: {
        userId,
        event: "QUESTION_ASKED",
        createdAt: { gte: ninetyDaysAgo },
      },
      select: { createdAt: true },
    }),
  ]);

  const attemptsInWindow = await prisma.testAttempt.findMany({
    where: { userId, startedAt: { gte: ninetyDaysAgo } },
    select: { startedAt: true },
  });

  const xp = profile?.xp ?? 0;
  const level = Math.floor(xp / 500) + 1;
  const xpIntoLevel = xp % 500;

  const scored = recentAttempts.filter(
    (a) => typeof a.score === "number" && typeof a.maxScore === "number" && a.maxScore! > 0
  );
  const accuracy =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, a) => sum + (a.score! / a.maxScore!) * 100, 0) / scored.length) * 10
        ) / 10
      : null;

  const activityByDay = new Map<string, number>();
  for (const event of usageEvents) {
    const key = dateKey(event.createdAt);
    activityByDay.set(key, (activityByDay.get(key) ?? 0) + 1);
  }
  for (const attempt of attemptsInWindow) {
    const key = dateKey(attempt.startedAt);
    activityByDay.set(key, (activityByDay.get(key) ?? 0) + 1);
  }

  const heatmap: { date: string; count: number; level: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const count = activityByDay.get(key) ?? 0;
    const lvl = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : 3;
    heatmap.push({ date: key, count, level: lvl });
  }

  const activeDaysLast30 = Array.from(activityByDay.keys()).filter(
    (key) => new Date(key) >= thirtyDaysAgo
  ).length;
  const consistency = Math.round((activeDaysLast30 / 30) * 100);

  const healthScore = accuracy !== null ? Math.round((consistency + accuracy) / 2) : consistency;

  const subjectMap = new Map<string, { totalScore: number; totalMax: number; attempts: number }>();
  for (const attempt of allAttemptsForSubjects) {
    if (!attempt.subject || typeof attempt.score !== "number" || typeof attempt.maxScore !== "number") continue;
    if (attempt.maxScore <= 0) continue;
    const entry = subjectMap.get(attempt.subject) ?? { totalScore: 0, totalMax: 0, attempts: 0 };
    entry.totalScore += attempt.score;
    entry.totalMax += attempt.maxScore;
    entry.attempts += 1;
    subjectMap.set(attempt.subject, entry);
  }

  const subjectConfidence = Array.from(subjectMap.entries()).map(([subject, entry]) => ({
    subject,
    confidence: Math.round((entry.totalScore / entry.totalMax) * 100),
    attempts: entry.attempts,
  }));

  return {
    xp,
    level,
    xpIntoLevel,
    xpForNextLevel: 500,
    currentStreak: profile?.currentStreak ?? 0,
    longestStreak: profile?.longestStreak ?? 0,
    accuracy,
    consistency,
    healthScore,
    heatmap,
    subjectConfidence,
    weakChapters: profile?.weakChapters ?? [],
    strongChapters: profile?.strongChapters ?? [],
    favoriteSubject: profile?.favoriteSubject ?? null,
  };
}
