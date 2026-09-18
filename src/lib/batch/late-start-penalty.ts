import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Same shape/reasoning as the sibling late-reschedule rule in
// reschedule-penalty.ts: a disruption-discourager, not a real punishment,
// and PenaltyRecord.amount stores the percent itself (not a computed rupee
// figure) for the same "no payout figure stored in this schema" reason
// documented there — Finance resolves the actual ₹ against the teacher's
// real payout when running that month's cycle.
const LATE_START_RULE_NAME = "Late Class Start (>5 min)";
const LATE_START_THRESHOLD_MINUTES = 5;
const LATE_START_PERCENT = 1;

async function getOrCreateLateStartRule(tx: Prisma.TransactionClient) {
  const existing = await tx.penaltyRule.findFirst({ where: { name: LATE_START_RULE_NAME } });
  if (existing) return existing;
  return tx.penaltyRule.create({
    data: {
      name: LATE_START_RULE_NAME,
      description: `Auto-applied when a teacher starts a Live Class ${LATE_START_THRESHOLD_MINUTES}+ minutes after its scheduled start time.`,
      deductionType: "PERCENT_OF_PAYOUT",
      deductionValue: LATE_START_PERCENT,
      isActive: true,
    },
  });
}

/**
 * Called from the "Start Class" route the moment a class's actualStartedAt
 * is first set (i.e. once per genuine class start, never on a reconnect/
 * resume — the caller is responsible for only calling this exactly once).
 * No-ops (returns null) when the class started on time, started early, or
 * has no assigned teacher to penalize.
 */
export async function applyLateStartPenaltyIfDue(params: {
  scheduleId: string;
  teacherId: string | null;
  scheduledStartsAt: Date;
  actualStartedAt: Date;
  startedByUserId: string;
}) {
  if (!params.teacherId) return null;

  const minutesLate = (params.actualStartedAt.getTime() - params.scheduledStartsAt.getTime()) / 60_000;
  if (minutesLate < LATE_START_THRESHOLD_MINUTES) return null;

  const month = params.actualStartedAt.toISOString().slice(0, 7); // YYYY-MM payout cycle

  return prisma.$transaction(async (tx) => {
    const rule = await getOrCreateLateStartRule(tx);

    const record = await tx.penaltyRecord.create({
      data: {
        teacherId: params.teacherId!,
        ruleId: rule.id,
        amount: LATE_START_PERCENT,
        month,
        note: `Live class started ${minutesLate.toFixed(1)}min late (schedule ${params.scheduleId}).`,
        createdById: params.startedByUserId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: params.startedByUserId,
        action: "LATE_CLASS_START_PENALTY_APPLIED",
        entityType: "BatchSchedule",
        entityId: params.scheduleId,
        metadata: { teacherId: params.teacherId, penaltyRecordId: record.id, minutesLate },
      },
    });

    const teacher = await tx.teacher.findUnique({ where: { id: params.teacherId! }, select: { userId: true } });
    if (teacher) {
      await tx.notification.create({
        data: {
          userId: teacher.userId,
          title: "Compliance penalty applied",
          body: `A 1% deduction ("${rule.name}") was applied for ${month} — this class started ${Math.round(minutesLate)} minutes late.`,
        },
      });
    }

    return record;
  });
}
