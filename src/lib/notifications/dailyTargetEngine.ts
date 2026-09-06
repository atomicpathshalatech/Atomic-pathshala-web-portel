import { prisma } from "@/lib/db";
import { NotificationType } from "./types";
import { triggerNotificationEvent } from "./engine";

/**
 * Builds personalized daily targets for a student from live database entities.
 */
export async function generateDailyTargetsForStudent(userId: string): Promise<boolean> {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, name: true } },
      batchEnrollments: {
        where: { status: "ACTIVE" },
        include: { batch: true },
      },
    },
  });

  if (!student) return false;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const batchIds = student.batchEnrollments.map((e) => e.batchId);

  // 1. Today's live classes
  const todaysClasses = await prisma.batchSchedule.findMany({
    where: {
      batchId: { in: batchIds },
      startsAt: { gte: startOfDay, lte: endOfDay },
      status: { not: "CANCELLED" },
    },
    orderBy: { startsAt: "asc" },
    take: 3,
  });

  // 2. Today's tests
  const todaysTests = await prisma.test.findMany({
    where: {
      status: "PUBLISHED",
      openTime: { gte: startOfDay, lte: endOfDay },
    },
    take: 2,
  });

  // 3. Pending DPPs (e.g. published in the last 3 days)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const recentDpps = await prisma.dpp.findMany({
    where: {
      status: "PUBLISHED",
      createdAt: { gte: threeDaysAgo },
    },
    take: 2,
  });

  const targets: string[] = [];

  for (const c of todaysClasses) {
    const timeStr = c.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    targets.push(`Attend ${c.title} (${timeStr})`);
  }

  for (const t of todaysTests) {
    targets.push(`Attempt ${t.name}`);
  }

  for (const d of recentDpps) {
    targets.push(`Solve DPP: ${d.name}`);
  }

  // Fallback targets if no events scheduled for today
  if (targets.length === 0) {
    targets.push("Revise high-yield physics formulas");
    targets.push("Practice 30 MCQs in NEET Question Bank");
    targets.push("Review NCERT biology concepts");
  }

  const dateStr = now.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  const title = `🎯 Today's Targets (${dateStr})`;
  const body = targets.slice(0, 4).map((t, idx) => `${idx + 1}. ${t}`).join("\n");

  const idempotencyKey = `daily-target:${userId}:${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

  await triggerNotificationEvent({
    eventType: NotificationType.DAILY_TARGET,
    recipientUserIds: [userId],
    title,
    body,
    deepLink: "/student/practice",
    metadata: { targets, date: now.toISOString() },
    idempotencyKey,
  });

  return true;
}

/**
 * Bulk generate daily targets for all active enrolled students.
 */
export async function generateDailyTargetsForAllActiveStudents(): Promise<number> {
  const students = await prisma.student.findMany({
    where: {
      user: { status: "ACTIVE" },
      batchEnrollments: { some: { status: "ACTIVE" } },
    },
    select: { userId: true },
  });

  let count = 0;
  for (const s of students) {
    const sent = await generateDailyTargetsForStudent(s.userId);
    if (sent) count++;
  }

  return count;
}
