import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Spec: rescheduling a Live Class with 24+ hours' notice before its
// scheduled start costs nothing; under 24 hours costs the teacher 1% (a
// disruption-discourager, not a real punishment — see the option this was
// built against, chosen over "auto-flag only" or "add a real payout field
// first"). There is no payout/salary/stipend figure stored anywhere in this
// schema to multiply a percent against, so PenaltyRecord.amount stores the
// percent itself (1) rather than a computed rupee figure — Finance resolves
// the actual ₹ amount against the teacher's real payout when running that
// month's cycle, the same way every other PERCENT_OF_PAYOUT rule already
// works in this codebase (deductionValue is descriptive policy, not an
// auto-computed amount; see PenaltyRecord.amount's existing "must be a
// positive number the admin enters" contract in validation/penalty.ts).
const LATE_RESCHEDULE_RULE_NAME = "Late Reschedule Notice (<24h)";
const LATE_RESCHEDULE_NOTICE_HOURS = 24;
const LATE_RESCHEDULE_PERCENT = 1;

async function getOrCreateLateRescheduleRule(tx: Prisma.TransactionClient) {
  const existing = await tx.penaltyRule.findFirst({ where: { name: LATE_RESCHEDULE_RULE_NAME } });
  if (existing) return existing;
  return tx.penaltyRule.create({
    data: {
      name: LATE_RESCHEDULE_RULE_NAME,
      description:
        "Auto-applied when a Live Class is rescheduled with less than 24 hours' notice before its scheduled start.",
      deductionType: "PERCENT_OF_PAYOUT",
      deductionValue: LATE_RESCHEDULE_PERCENT,
      isActive: true,
    },
  });
}

/**
 * Called from the admin-only schedule-reschedule route whenever a Live
 * Class's startsAt/endsAt actually changes. No-ops (returns null) when the
 * notice given was 24h or more, or when the schedule has no assigned
 * teacher to penalize.
 */
export async function applyLateReschedulePenaltyIfDue(params: {
  scheduleId: string;
  teacherId: string | null;
  originalStartsAt: Date;
  rescheduledByUserId: string;
}) {
  if (!params.teacherId) return null;

  const hoursNotice = (params.originalStartsAt.getTime() - Date.now()) / 3_600_000;
  if (hoursNotice >= LATE_RESCHEDULE_NOTICE_HOURS) return null;

  const month = new Date().toISOString().slice(0, 7); // YYYY-MM payout cycle this reschedule falls in

  return prisma.$transaction(async (tx) => {
    const rule = await getOrCreateLateRescheduleRule(tx);

    const record = await tx.penaltyRecord.create({
      data: {
        teacherId: params.teacherId!,
        ruleId: rule.id,
        amount: LATE_RESCHEDULE_PERCENT,
        month,
        note: `Live class rescheduled with ${Math.max(0, hoursNotice).toFixed(1)}h notice (schedule ${params.scheduleId}).`,
        createdById: params.rescheduledByUserId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: params.rescheduledByUserId,
        action: "LATE_RESCHEDULE_PENALTY_APPLIED",
        entityType: "BatchSchedule",
        entityId: params.scheduleId,
        metadata: { teacherId: params.teacherId, penaltyRecordId: record.id, hoursNotice },
      },
    });

    const teacher = await tx.teacher.findUnique({ where: { id: params.teacherId! }, select: { userId: true } });
    if (teacher) {
      await tx.notification.create({
        data: {
          userId: teacher.userId,
          title: "Compliance penalty applied",
          body: `A 1% deduction ("${rule.name}") was applied for ${month} — this class was rescheduled with under 24 hours' notice.`,
        },
      });
    }

    return record;
  });
}
