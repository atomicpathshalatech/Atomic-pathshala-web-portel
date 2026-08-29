import { getPrisma } from "@/lib/ai-chat/prisma";

const prisma = getPrisma();

const DAILY_FREE_LIMIT = 5;

// Uses the AI Chat UserAccess model — the "effective access" record.
// Active + non-FREE plan + not expired = unlimited questions.
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const access = await prisma.userAccess.findUnique({ where: { userId } });
  if (!access) return false;
  if (access.plan === "FREE") return false;
  if (access.status !== "ACTIVE") return false;
  if (access.expiresAt && access.expiresAt < new Date()) return false;
  return true;
}

// Counts today's QUESTION_ASKED events for a user using the AI Chat UsageEvent model.
export async function getDailyQuestionsUsed(userId: string): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return prisma.usageEvent.count({
    where: {
      userId,
      event: "QUESTION_ASKED",
      createdAt: { gte: startOfToday },
    },
  });
}

// Call this AFTER successfully answering a question (not before), so failed
// answers don't eat into the user's daily quota.
export async function recordQuestionUsage(userId: string) {
  await prisma.usageEvent.create({
    data: { userId, event: "QUESTION_ASKED" },
  });
}

const GUEST_DAILY_LIMIT = 5;

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Returns whether this guest still has free questions left today.
export async function checkGuestUsage(guestId: string, ip: string) {
  const now = new Date();
  const record = await prisma.guestUsage.findUnique({ where: { guestId } });

  if (!record) {
    return { allowed: true, remaining: GUEST_DAILY_LIMIT };
  }

  const usedToday = isSameDay(record.lastSeenAt, now) ? record.count : 0;
  return {
    allowed: usedToday < GUEST_DAILY_LIMIT,
    remaining: Math.max(0, GUEST_DAILY_LIMIT - usedToday),
  };
}

// Call AFTER a successful guest answer.
export async function recordGuestUsage(guestId: string, ip: string) {
  const now = new Date();
  const record = await prisma.guestUsage.findUnique({ where: { guestId } });

  if (!record || !isSameDay(record.lastSeenAt, now)) {
    // new guest OR new day -> reset to 1
    await prisma.guestUsage.upsert({
      where: { guestId },
      update: { count: 1, ip },
      create: { guestId, ip, count: 1 },
    });
  } else {
    await prisma.guestUsage.update({
      where: { guestId },
      data: { count: { increment: 1 } },
    });
  }
}

export { DAILY_FREE_LIMIT, GUEST_DAILY_LIMIT };
