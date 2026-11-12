import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireGamificationAdmin } from "@/lib/gamification/admin-guard";
import { handleApiError, apiSuccess, apiError } from "@/lib/api/response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ruleUpdateSchema = z.object({
  displayLabel: z.string().min(2).max(128).optional(),
  description: z.string().optional().nullable(),
  category: z
    .enum([
      "DAILY_LOGIN",
      "LIVE_CLASS_ATTENDANCE",
      "RECORDED_LECTURE",
      "LIVE_CLASS_PARTICIPATION",
      "DPP_COMPLETION",
      "QUESTION_PRACTICE",
      "CORRECT_ANSWER",
      "TEST_SUBMISSION",
      "TEST_PERFORMANCE",
      "DAILY_STUDY_STREAK",
      "WEEKLY_STUDY_STREAK",
      "DOUBT_PARTICIPATION",
      "ASSIGNMENT_COMPLETION",
      "ACHIEVEMENT_UNLOCK",
      "RANK_MILESTONE",
      "MANUAL_ADJUSTMENT",
      "REWARD_REDEMPTION",
      "OTHER",
    ])
    .optional(),
  xpPoints: z.number().int().min(0).max(10000).optional(),
  triggerEvent: z.string().min(2).max(64).optional(),
  eligibilityConditions: z.record(z.any()).optional().nullable(),
  frequencyLimit: z
    .enum(["UNLIMITED", "ONCE_PER_DAY", "ONCE_PER_WEEK", "ONCE_PER_EVENT", "ONCE_LIFETIME"])
    .optional(),
  dailyLimit: z.number().int().min(0).optional().nullable(),
  weeklyLimit: z.number().int().min(0).optional().nullable(),
  maxRewardsLifetime: z.number().int().min(0).optional().nullable(),
  effectiveStartDate: z.string().optional().nullable(),
  effectiveEndDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  changeReason: z.string().min(3).max(256),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireGamificationAdmin();

    const rule = await prisma.xPRewardRule.findUnique({
      where: { id: params.id },
      include: {
        versions: {
          orderBy: { version: "desc" },
          include: { createdBy: { select: { name: true, email: true } } },
        },
        _count: { select: { transactions: true } },
      },
    });

    if (!rule) return apiError("Reward rule not found", 404);
    return apiSuccess({ rule });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireGamificationAdmin();
    const body = await req.json();
    const parsed = ruleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const rule = await prisma.xPRewardRule.findUnique({ where: { id: params.id } });
    if (!rule) return apiError("Reward rule not found", 404);

    const data = parsed.data;
    const nextVersion = rule.version + 1;

    const updated = await prisma.$transaction(async (tx) => {
      const savedRule = await tx.xPRewardRule.update({
        where: { id: params.id },
        data: {
          displayLabel: data.displayLabel ?? rule.displayLabel,
          description: data.description !== undefined ? data.description : rule.description,
          category: data.category ?? rule.category,
          xpPoints: data.xpPoints ?? rule.xpPoints,
          triggerEvent: data.triggerEvent ?? rule.triggerEvent,
          eligibilityConditions:
            data.eligibilityConditions !== undefined ? data.eligibilityConditions : (rule.eligibilityConditions as any),
          frequencyLimit: data.frequencyLimit ?? rule.frequencyLimit,
          dailyLimit: data.dailyLimit !== undefined ? data.dailyLimit : rule.dailyLimit,
          weeklyLimit: data.weeklyLimit !== undefined ? data.weeklyLimit : rule.weeklyLimit,
          maxRewardsLifetime:
            data.maxRewardsLifetime !== undefined ? data.maxRewardsLifetime : rule.maxRewardsLifetime,
          effectiveStartDate:
            data.effectiveStartDate !== undefined
              ? data.effectiveStartDate
                ? new Date(data.effectiveStartDate)
                : null
              : rule.effectiveStartDate,
          effectiveEndDate:
            data.effectiveEndDate !== undefined
              ? data.effectiveEndDate
                ? new Date(data.effectiveEndDate)
                : null
              : rule.effectiveEndDate,
          isActive: data.isActive !== undefined ? data.isActive : rule.isActive,
          version: nextVersion,
        },
      });

      // Immutable version archive
      await tx.xPRuleVersion.create({
        data: {
          ruleId: savedRule.id,
          version: nextVersion,
          displayLabel: savedRule.displayLabel,
          xpPoints: savedRule.xpPoints,
          category: savedRule.category,
          eligibilityConditions: savedRule.eligibilityConditions || undefined,
          frequencyLimit: savedRule.frequencyLimit,
          dailyLimit: savedRule.dailyLimit,
          weeklyLimit: savedRule.weeklyLimit,
          maxRewardsLifetime: savedRule.maxRewardsLifetime,
          isActive: savedRule.isActive,
          changeReason: data.changeReason,
          createdById: user.id,
        },
      });

      await tx.xPAuditLog.create({
        data: {
          action: "RULE_UPDATED",
          entityType: "XPRewardRule",
          entityId: savedRule.id,
          adminId: user.id,
          details: {
            ruleName: savedRule.activityName,
            version: nextVersion,
            previousXp: rule.xpPoints,
            newXp: savedRule.xpPoints,
            changeReason: data.changeReason,
          },
        },
      });

      return savedRule;
    });

    return apiSuccess({ rule: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireGamificationAdmin();
    const rule = await prisma.xPRewardRule.findUnique({
      where: { id: params.id },
      include: { _count: { select: { transactions: true } } },
    });
    if (!rule) return apiError("Reward rule not found", 404);

    // If transactions reference this rule, archive it safely instead of breaking foreign keys
    if (rule._count.transactions > 0) {
      await prisma.xPRewardRule.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      await prisma.xPAuditLog.create({
        data: {
          action: "RULE_ARCHIVED",
          entityType: "XPRewardRule",
          entityId: rule.id,
          adminId: user.id,
          details: { reason: "Archived because transactions reference this rule." },
        },
      });
      return apiSuccess({ message: "Rule has been archived and deactivated safely.", archived: true });
    }

    // Safe deletion if unused
    await prisma.xPRewardRule.delete({ where: { id: params.id } });
    await prisma.xPAuditLog.create({
      data: {
        action: "RULE_DELETED",
        entityType: "XPRewardRule",
        entityId: rule.id,
        adminId: user.id,
        details: { ruleName: rule.activityName },
      },
    });

    return apiSuccess({ message: "Rule deleted successfully.", deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
