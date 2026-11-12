import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireGamificationAdmin } from "@/lib/gamification/admin-guard";
import { handleApiError, apiSuccess, apiError } from "@/lib/api/response";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ruleCreateSchema = z.object({
  activityName: z.string().min(2).max(64),
  displayLabel: z.string().min(2).max(128),
  description: z.string().optional(),
  category: z.enum([
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
  ]),
  xpPoints: z.number().int().min(0).max(10000),
  triggerEvent: z.string().min(2).max(64),
  eligibilityConditions: z.record(z.any()).optional().nullable(),
  frequencyLimit: z.enum(["UNLIMITED", "ONCE_PER_DAY", "ONCE_PER_WEEK", "ONCE_PER_EVENT", "ONCE_LIFETIME"]),
  dailyLimit: z.number().int().min(0).optional().nullable(),
  weeklyLimit: z.number().int().min(0).optional().nullable(),
  maxRewardsLifetime: z.number().int().min(0).optional().nullable(),
  effectiveStartDate: z.string().optional().nullable(),
  effectiveEndDate: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireGamificationAdmin();

    const rules = await prisma.xPRewardRule.findMany({
      orderBy: [{ category: "asc" }, { xpPoints: "asc" }],
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 5,
          include: { createdBy: { select: { name: true, email: true } } },
        },
        _count: {
          select: { transactions: true },
        },
      },
    });

    return apiSuccess({ rules });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireGamificationAdmin();
    const body = await req.json();
    const parsed = ruleCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors.map((e) => e.message).join(", "), 400);
    }

    const data = parsed.data;
    const existing = await prisma.xPRewardRule.findUnique({
      where: { activityName: data.activityName },
    });
    if (existing) {
      return apiError(`A rule with activity name '${data.activityName}' already exists.`, 409);
    }

    const rule = await prisma.$transaction(async (tx) => {
      const created = await tx.xPRewardRule.create({
        data: {
          activityName: data.activityName,
          displayLabel: data.displayLabel,
          description: data.description,
          category: data.category,
          xpPoints: data.xpPoints,
          triggerEvent: data.triggerEvent,
          eligibilityConditions: data.eligibilityConditions || undefined,
          frequencyLimit: data.frequencyLimit,
          dailyLimit: data.dailyLimit,
          weeklyLimit: data.weeklyLimit,
          maxRewardsLifetime: data.maxRewardsLifetime,
          effectiveStartDate: data.effectiveStartDate ? new Date(data.effectiveStartDate) : null,
          effectiveEndDate: data.effectiveEndDate ? new Date(data.effectiveEndDate) : null,
          isActive: data.isActive,
          version: 1,
        },
      });

      await tx.xPRuleVersion.create({
        data: {
          ruleId: created.id,
          version: 1,
          displayLabel: created.displayLabel,
          xpPoints: created.xpPoints,
          category: created.category,
          eligibilityConditions: created.eligibilityConditions || undefined,
          frequencyLimit: created.frequencyLimit,
          dailyLimit: created.dailyLimit,
          weeklyLimit: created.weeklyLimit,
          maxRewardsLifetime: created.maxRewardsLifetime,
          isActive: created.isActive,
          changeReason: "Initial Rule Creation",
          createdById: user.id,
        },
      });

      await tx.xPAuditLog.create({
        data: {
          action: "RULE_CREATED",
          entityType: "XPRewardRule",
          entityId: created.id,
          adminId: user.id,
          details: { ruleName: created.activityName, xp: created.xpPoints, category: created.category },
        },
      });

      return created;
    });

    return apiSuccess({ rule }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
