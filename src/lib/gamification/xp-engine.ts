import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, XPReason } from "@prisma/client";

export type ActivityCategory =
  | "DAILY_LOGIN"
  | "LIVE_CLASS_ATTENDANCE"
  | "RECORDED_LECTURE"
  | "LIVE_CLASS_PARTICIPATION"
  | "DPP_COMPLETION"
  | "QUESTION_PRACTICE"
  | "CORRECT_ANSWER"
  | "TEST_SUBMISSION"
  | "TEST_PERFORMANCE"
  | "DAILY_STUDY_STREAK"
  | "WEEKLY_STUDY_STREAK"
  | "DOUBT_PARTICIPATION"
  | "ASSIGNMENT_COMPLETION"
  | "ACHIEVEMENT_UNLOCK"
  | "RANK_MILESTONE"
  | "MANUAL_ADJUSTMENT"
  | "REWARD_REDEMPTION"
  | "OTHER";

export interface ProcessRewardParams {
  studentId: string;
  activityName: string;
  sourceEntityId?: string;
  idempotencyKey?: string;
  payload?: Record<string, any>;
  customXp?: number; // Only allowed when calculated server-side
  overrideReason?: XPReason;
}

export interface RewardResult {
  success: boolean;
  awarded: boolean;
  xpAwarded: number;
  balanceBefore: number;
  balanceAfter: number;
  currentStreakDays: number;
  level: number;
  transactionId?: string;
  reason?: string;
  skippedReason?: string;
  error?: string;
}

/**
 * Standard square-root leveling curve
 */
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}

export function dateOnlyUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfWeekUTC(d: Date): Date {
  const date = dateOnlyUTC(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
}

/**
 * Main Centralized Reward Engine API
 * Validates, checks eligibility & limits, executes atomic transaction, updates ledger.
 */
export async function awardActivityXp(params: ProcessRewardParams): Promise<RewardResult> {
  const { studentId, activityName, sourceEntityId, payload = {}, customXp, overrideReason } = params;

  // 1. Resolve rule
  const rule = await prisma.xPRewardRule.findUnique({
    where: { activityName },
  });

  if (!rule || !rule.isActive) {
    return {
      success: true,
      awarded: false,
      xpAwarded: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      currentStreakDays: 0,
      level: 1,
      skippedReason: !rule ? `Reward rule '${activityName}' not found.` : `Reward rule '${activityName}' is inactive.`,
    };
  }

  // Check effective dates
  const now = new Date();
  if (rule.effectiveStartDate && now < rule.effectiveStartDate) {
    return {
      success: true,
      awarded: false,
      xpAwarded: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      currentStreakDays: 0,
      level: 1,
      skippedReason: `Rule '${activityName}' is not effective yet (starts ${rule.effectiveStartDate.toISOString()}).`,
    };
  }
  if (rule.effectiveEndDate && now > rule.effectiveEndDate) {
    return {
      success: true,
      awarded: false,
      xpAwarded: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      currentStreakDays: 0,
      level: 1,
      skippedReason: `Rule '${activityName}' has expired (ended ${rule.effectiveEndDate.toISOString()}).`,
    };
  }

  // 2. Determine Idempotency Key
  const derivedIdempotencyKey =
    params.idempotencyKey ||
    (sourceEntityId ? `${activityName}:${sourceEntityId}:${studentId}` : `${activityName}:${Date.now()}:${studentId}`);

  // Check if idempotencyKey already processed
  const existingTx = await prisma.xPTransaction.findUnique({
    where: { idempotencyKey: derivedIdempotencyKey },
  });
  if (existingTx) {
    // Already processed - idempotent return without duplicate XP
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { xp: true, level: true, currentStreakDays: true },
    });
    return {
      success: true,
      awarded: false,
      xpAwarded: 0,
      balanceBefore: existingTx.balanceBefore,
      balanceAfter: existingTx.balanceAfter,
      currentStreakDays: student?.currentStreakDays ?? 1,
      level: student?.level ?? 1,
      transactionId: existingTx.id,
      skippedReason: "Duplicate event: already rewarded for this idempotency key.",
    };
  }

  // 3. Frequency & Limit Checks
  const todayStart = dateOnlyUTC(now);
  const weekStart = startOfWeekUTC(now);

  if (rule.frequencyLimit === "ONCE_LIFETIME") {
    const previous = await prisma.xPTransaction.count({
      where: { studentId, ruleId: rule.id, status: "SUCCESSFUL" },
    });
    if (previous > 0) {
      return {
        success: true,
        awarded: false,
        xpAwarded: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        currentStreakDays: 0,
        level: 1,
        skippedReason: `Frequency limit reached: Rule '${activityName}' is ONCE_LIFETIME and already awarded.`,
      };
    }
  } else if (rule.frequencyLimit === "ONCE_PER_DAY") {
    const todayCount = await prisma.xPTransaction.count({
      where: {
        studentId,
        ruleId: rule.id,
        status: "SUCCESSFUL",
        createdAt: { gte: todayStart },
      },
    });
    if (todayCount > 0) {
      return {
        success: true,
        awarded: false,
        xpAwarded: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        currentStreakDays: 0,
        level: 1,
        skippedReason: `Frequency limit reached: Rule '${activityName}' is ONCE_PER_DAY and already awarded today.`,
      };
    }
  } else if (rule.frequencyLimit === "ONCE_PER_WEEK") {
    const weekCount = await prisma.xPTransaction.count({
      where: {
        studentId,
        ruleId: rule.id,
        status: "SUCCESSFUL",
        createdAt: { gte: weekStart },
      },
    });
    if (weekCount > 0) {
      return {
        success: true,
        awarded: false,
        xpAwarded: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        currentStreakDays: 0,
        level: 1,
        skippedReason: `Frequency limit reached: Rule '${activityName}' is ONCE_PER_WEEK and already awarded this week.`,
      };
    }
  }

  // Check Daily Limits
  if (rule.dailyLimit && rule.dailyLimit > 0) {
    const todayAgg = await prisma.xPTransaction.aggregate({
      where: {
        studentId,
        ruleId: rule.id,
        status: "SUCCESSFUL",
        createdAt: { gte: todayStart },
      },
      _sum: { amount: true },
    });
    const currentTodayXp = todayAgg._sum.amount ?? 0;
    if (currentTodayXp >= rule.dailyLimit) {
      return {
        success: true,
        awarded: false,
        xpAwarded: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        currentStreakDays: 0,
        level: 1,
        skippedReason: `Daily XP cap (${rule.dailyLimit} XP) reached for rule '${activityName}'.`,
      };
    }
  }

  // 4. Eligibility Condition Verification
  if (rule.eligibilityConditions && typeof rule.eligibilityConditions === "object") {
    const cond = rule.eligibilityConditions as Record<string, any>;
    if (cond.minScorePercent !== undefined && typeof payload.scorePercent === "number") {
      if (payload.scorePercent < cond.minScorePercent) {
        return {
          success: true,
          awarded: false,
          xpAwarded: 0,
          balanceBefore: 0,
          balanceAfter: 0,
          currentStreakDays: 0,
          level: 1,
          skippedReason: `Score requirement not met: received ${payload.scorePercent}%, required ${cond.minScorePercent}%.`,
        };
      }
    }
    if (cond.maxRank !== undefined && typeof payload.rank === "number") {
      if (payload.rank > cond.maxRank) {
        return {
          success: true,
          awarded: false,
          xpAwarded: 0,
          balanceBefore: 0,
          balanceAfter: 0,
          currentStreakDays: 0,
          level: 1,
          skippedReason: `Rank requirement not met: current rank #${payload.rank}, required <= #${cond.maxRank}.`,
        };
      }
    }
  }

  // 5. XP Calculation
  let calculatedXp = customXp !== undefined ? Math.max(0, customXp) : rule.xpPoints;
  if (rule.dailyLimit && rule.dailyLimit > 0) {
    const todayAgg = await prisma.xPTransaction.aggregate({
      where: {
        studentId,
        ruleId: rule.id,
        status: "SUCCESSFUL",
        createdAt: { gte: todayStart },
      },
      _sum: { amount: true },
    });
    const currentTodayXp = todayAgg._sum.amount ?? 0;
    calculatedXp = Math.min(calculatedXp, Math.max(0, rule.dailyLimit - currentTodayXp));
  }

  if (calculatedXp <= 0) {
    return {
      success: true,
      awarded: false,
      xpAwarded: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      currentStreakDays: 0,
      level: 1,
      skippedReason: "Calculated reward is 0 XP.",
    };
  }

  // Map XPReason
  const reasonEnum: XPReason =
    overrideReason ||
    (rule.category === "DAILY_LOGIN"
      ? "DAILY_LOGIN_STREAK"
      : rule.category === "LIVE_CLASS_ATTENDANCE"
      ? "LIVE_CLASS_ATTENDANCE"
      : rule.category === "RECORDED_LECTURE"
      ? "LECTURE_COMPLETED"
      : rule.category === "DPP_COMPLETION"
      ? "DPP_COMPLETED"
      : rule.category === "CORRECT_ANSWER" || rule.category === "QUESTION_PRACTICE"
      ? "QUIZ_CORRECT_ANSWER"
      : rule.category === "TEST_SUBMISSION" || rule.category === "TEST_PERFORMANCE"
      ? "TEST_COMPLETED"
      : rule.category === "DOUBT_PARTICIPATION"
      ? "DOUBT_RESOLVED"
      : "OTHER");

  // 6. Execute Atomic Transaction with safe retry
  let attemptCount = 0;
  const maxRetries = 3;

  while (attemptCount < maxRetries) {
    attemptCount++;
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Double-check idempotency key inside transaction
          const existingInside = await tx.xPTransaction.findUnique({
            where: { idempotencyKey: derivedIdempotencyKey },
          });
          if (existingInside) {
            return {
              isDuplicate: true,
              tx: existingInside,
            };
          }

          // Acquire exclusive row lock on student to prevent concurrent race conditions
          await tx.$executeRaw`SELECT id FROM students WHERE id = ${studentId} FOR UPDATE`;

          const student = await tx.student.findUnique({
            where: { id: studentId },
            select: { xp: true, currentStreakDays: true, longestStreakDays: true, lastActivityDate: true },
          });
          if (!student) {
            throw new Error(`Student ${studentId} not found.`);
          }

          const prevXp = student.xp;
          const nextXp = prevXp + calculatedXp;

          // Streak calculation
          const today = dateOnlyUTC(now);
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
          const nextLevel = levelForXp(nextXp);

          // Update student
          await tx.student.update({
            where: { id: studentId },
            data: {
              xp: nextXp,
              level: nextLevel,
              currentStreakDays: nextStreak,
              longestStreakDays: nextLongest,
              lastActivityDate: today,
            },
          });

          // Insert XPTransaction
          const transaction = await tx.xPTransaction.create({
            data: {
              studentId,
              amount: calculatedXp,
              reason: reasonEnum,
              status: "SUCCESSFUL",
              activity: activityName,
              rewardLabel: rule.displayLabel,
              idempotencyKey: derivedIdempotencyKey,
              ruleId: rule.id,
              ruleVersion: rule.version,
              balanceBefore: prevXp,
              balanceAfter: nextXp,
              metadata: {
                ...payload,
                sourceEntityId,
                ruleCategory: rule.category,
              },
            },
          });

          // Also insert into legacy xp_events for backward compatibility
          await tx.xPEvent.create({
            data: {
              id: transaction.id,
              studentId,
              amount: calculatedXp,
              reason: reasonEnum,
              metadata: {
                ...payload,
                sourceEntityId,
                ruleId: rule.id,
                transactionId: transaction.id,
              },
            },
          });

          // Activity event tracking
          await tx.xPActivityEvent.create({
            data: {
              studentId,
              activityType: activityName,
              sourceEntityId,
              idempotencyKey: derivedIdempotencyKey,
              payload: payload as Prisma.InputJsonValue,
              processed: true,
              transactionId: transaction.id,
            },
          });

          return {
            isDuplicate: false,
            tx: transaction,
            balanceBefore: prevXp,
            balanceAfter: nextXp,
            currentStreak: nextStreak,
            level: nextLevel,
          };
        },
        { timeout: 10000 }
      );

      if (result.isDuplicate) {
        return {
          success: true,
          awarded: false,
          xpAwarded: 0,
          balanceBefore: result.tx.balanceBefore,
          balanceAfter: result.tx.balanceAfter,
          currentStreakDays: 1,
          level: 1,
          transactionId: result.tx.id,
          skippedReason: "Duplicate event detected during transaction.",
        };
      }

      return {
        success: true,
        awarded: true,
        xpAwarded: calculatedXp,
        balanceBefore: result.balanceBefore!,
        balanceAfter: result.balanceAfter!,
        currentStreakDays: result.currentStreak!,
        level: result.level!,
        transactionId: result.tx.id,
        reason: rule.displayLabel,
      };
    } catch (err: any) {
      // Check if unique constraint violation on idempotencyKey
      if (err?.code === "P2002" || err?.message?.includes("idempotencyKey")) {
        const existingAfterCollision = await prisma.xPTransaction.findUnique({
          where: { idempotencyKey: derivedIdempotencyKey },
        });
        if (existingAfterCollision) {
          return {
            success: true,
            awarded: false,
            xpAwarded: 0,
            balanceBefore: existingAfterCollision.balanceBefore,
            balanceAfter: existingAfterCollision.balanceAfter,
            currentStreakDays: 1,
            level: 1,
            transactionId: existingAfterCollision.id,
            skippedReason: "Concurrent duplicate request blocked safely by unique key.",
          };
        }
      }

      if (attemptCount >= maxRetries) {
        // Record failed transaction in ledger
        try {
          const student = await prisma.student.findUnique({
            where: { id: studentId },
            select: { xp: true },
          });
          await prisma.xPTransaction.create({
            data: {
              studentId,
              amount: calculatedXp,
              reason: reasonEnum,
              status: "FAILED",
              activity: activityName,
              rewardLabel: rule.displayLabel,
              idempotencyKey: derivedIdempotencyKey ? `${derivedIdempotencyKey}_failed_${Date.now()}` : undefined,
              ruleId: rule.id,
              ruleVersion: rule.version,
              failureReason: err?.message || "Unknown database transaction error",
              balanceBefore: student?.xp ?? 0,
              balanceAfter: student?.xp ?? 0,
              metadata: { ...payload, sourceEntityId, error: String(err) },
            },
          });
        } catch {
          // ignore secondary failure logging error
        }

        return {
          success: false,
          awarded: false,
          xpAwarded: 0,
          balanceBefore: 0,
          balanceAfter: 0,
          currentStreakDays: 0,
          level: 1,
          error: `Transaction failed after ${maxRetries} attempts: ${err?.message || err}`,
        };
      }

      // Exponential backoff before retry
      await new Promise((res) => setTimeout(res, 100 * Math.pow(2, attemptCount)));
    }
  }

  return {
    success: false,
    awarded: false,
    xpAwarded: 0,
    balanceBefore: 0,
    balanceAfter: 0,
    currentStreakDays: 0,
    level: 1,
    error: "Reward engine exhausted retry loop.",
  };
}

/**
 * Super Admin Manual XP Adjustment
 * Fully transactional, updates balance, creates XPTransaction, XPAdjustment, and XPAuditLog.
 */
export async function manualAdjustStudentXp(params: {
  studentId: string;
  adminId: string;
  amount: number;
  reason: string;
  ipAddress?: string;
}): Promise<{
  success: boolean;
  previousBalance: number;
  updatedBalance: number;
  transactionId: string;
}> {
  const { studentId, adminId, amount, reason, ipAddress } = params;
  if (!amount || amount === 0) {
    throw new Error("Adjustment amount cannot be zero.");
  }
  if (!reason || reason.trim().length < 3) {
    throw new Error("A valid adjustment reason is required (at least 3 characters).");
  }

  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM students WHERE id = ${studentId} FOR UPDATE`;
    const student = await tx.student.findUnique({
      where: { id: studentId },
      select: { id: true, xp: true, user: { select: { name: true } } },
    });
    if (!student) {
      throw new Error(`Student ${studentId} not found.`);
    }

    const previousBalance = student.xp;
    const updatedBalance = Math.max(0, previousBalance + amount);
    const newLevel = levelForXp(updatedBalance);

    await tx.student.update({
      where: { id: studentId },
      data: {
        xp: updatedBalance,
        level: newLevel,
      },
    });

    const isAddition = amount > 0;
    const transaction = await tx.xPTransaction.create({
      data: {
        studentId,
        amount,
        reason: "MANUAL_ADJUSTMENT",
        status: "SUCCESSFUL",
        activity: "MANUAL_ADJUSTMENT",
        rewardLabel: isAddition ? `Manual XP Addition: ${reason}` : `Manual XP Deduction: ${reason}`,
        idempotencyKey: `adj_${Date.now()}_${studentId}_${Math.random().toString(36).substring(2, 7)}`,
        balanceBefore: previousBalance,
        balanceAfter: updatedBalance,
        metadata: {
          adminId,
          reason,
          adjustedAmount: amount,
        },
      },
    });

    await tx.xPAdjustment.create({
      data: {
        transactionId: transaction.id,
        studentId,
        amount,
        reason,
        previousBalance,
        updatedBalance,
        adminId,
      },
    });

    await tx.xPAuditLog.create({
      data: {
        action: "MANUAL_XP_ADJUSTED",
        entityType: "Student",
        entityId: studentId,
        adminId,
        details: {
          studentName: student.user.name,
          amount,
          previousBalance,
          updatedBalance,
          reason,
          transactionId: transaction.id,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    // Also write to legacy xp_events for complete parity
    await tx.xPEvent.create({
      data: {
        id: transaction.id,
        studentId,
        amount,
        reason: "MANUAL_ADJUSTMENT",
        metadata: {
          adminId,
          reason,
          transactionId: transaction.id,
        },
      },
    });

    return {
      success: true,
      previousBalance,
      updatedBalance,
      transactionId: transaction.id,
    };
  });
}

/**
 * Reward Store XP Redemption with Immutable Ledger Transaction
 */
export async function redeemRewardItemXp(params: {
  studentId: string;
  itemId: string;
  itemTitle: string;
  costXp: number;
  userId: string;
}): Promise<{
  success: boolean;
  remainingXp: number;
  transactionId: string;
}> {
  const { studentId, itemId, itemTitle, costXp, userId } = params;

  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM students WHERE id = ${studentId} FOR UPDATE`;
    const student = await tx.student.findUnique({
      where: { id: studentId },
      select: { xp: true },
    });
    if (!student) throw new Error("Student not found");
    if (student.xp < costXp) {
      throw new Error(`Insufficient XP: required ${costXp}, available ${student.xp}`);
    }

    const previousBalance = student.xp;
    const remainingXp = previousBalance - costXp;
    const newLevel = levelForXp(remainingXp);

    await tx.student.update({
      where: { id: studentId },
      data: {
        xp: remainingXp,
        level: newLevel,
      },
    });

    const transaction = await tx.xPTransaction.create({
      data: {
        studentId,
        amount: -costXp,
        reason: "REWARD_REDEMPTION",
        status: "SUCCESSFUL",
        activity: "REWARD_REDEMPTION",
        rewardLabel: `Redeemed: ${itemTitle}`,
        idempotencyKey: `redeem_${itemId}_${studentId}_${Date.now()}`,
        balanceBefore: previousBalance,
        balanceAfter: remainingXp,
        metadata: {
          itemId,
          itemTitle,
          costXp,
        },
      },
    });

    // Also write to legacy xp_events
    await tx.xPEvent.create({
      data: {
        id: transaction.id,
        studentId,
        amount: -costXp,
        reason: "REWARD_REDEMPTION",
        metadata: {
          itemId,
          itemTitle,
          transactionId: transaction.id,
        },
      },
    });

    return {
      success: true,
      remainingXp,
      transactionId: transaction.id,
    };
  });
}

/**
 * Check and award Rank Milestone Rewards
 */
export async function checkRankMilestoneRewards(studentId: string, currentRank: number): Promise<void> {
  const milestones = [
    { rank: 1, activityName: "RANK_MILESTONE_RANK1" },
    { rank: 10, activityName: "RANK_MILESTONE_TOP10" },
    { rank: 50, activityName: "RANK_MILESTONE_TOP50" },
    { rank: 100, activityName: "RANK_MILESTONE_TOP100" },
  ];

  for (const m of milestones) {
    if (currentRank <= m.rank) {
      await awardActivityXp({
        studentId,
        activityName: m.activityName,
        sourceEntityId: `rank_${m.rank}`,
        idempotencyKey: `milestone_${m.activityName}_${studentId}`,
        payload: { rank: currentRank, milestoneTarget: m.rank },
      });
    }
  }
}
