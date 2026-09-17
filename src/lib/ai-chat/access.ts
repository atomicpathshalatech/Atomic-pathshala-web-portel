import { getPrisma } from "@/lib/ai-chat/prisma";

const prisma = getPrisma();

const DAILY_FREE_LIMIT = 5;

// Uses the AI Chat UserAccess model — the "effective access" record.
// Active + non-FREE plan + not expired = unlimited questions.
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  // 1. Uses the AI Chat UserAccess model — the "effective access" record.
  const access = await prisma.userAccess.findUnique({ where: { userId } });
  if (access && access.plan !== "FREE" && access.status === "ACTIVE") {
    if (!access.expiresAt || access.expiresAt >= new Date()) {
      return true;
    }
  }

  // 2. Check main platform Student Subscription
  try {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: { subscription: true },
    });
    if (student?.subscription) {
      const sub = student.subscription;
      if (sub.status === "ACTIVE" || sub.status === "TRIAL") {
        if (sub.currentPeriodEnd > new Date()) return true;
      }
    }
  } catch (err) {
    console.warn("[Access] Student subscription check warning:", err);
  }

  // 3. Staff and Admins always have unlimited access
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { name: true } } },
    });
    if (
      user?.role?.name &&
      ["ADMIN", "SUPER_ADMIN", "SUB_ADMIN", "TEACHER", "FOUNDER"].includes(user.role.name)
    ) {
      return true;
    }
  } catch (err) {
    console.warn("[Access] User role check warning:", err);
  }

  return false;
}

// Counts today's events for a user using the AI Chat UsageEvent model.
export async function getDailyQuestionsUsed(
  userId: string,
  event: string = "QUESTION_ASKED"
): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return prisma.usageEvent.count({
    where: {
      userId,
      event,
      createdAt: { gte: startOfToday },
    },
  });
}

// Call this AFTER successfully fulfilling a request, specifying the feature event
export async function recordQuestionUsage(
  userId: string,
  event: string = "QUESTION_ASKED"
) {
  await prisma.usageEvent.create({
    data: { userId, event },
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
