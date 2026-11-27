import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

const upsertBudgetSchema = z.object({
  scopeType: z.enum(["GLOBAL", "ROLE", "USER", "PROJECT"]),
  scopeId: z.string().trim().min(1).max(100),
  dailyLimitUsd: z.number().min(0).max(100000),
  monthlyLimitUsd: z.number().min(0).max(1000000),
  hardStop: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_ACCESS);

    const limits = await prisma.aiBudgetLimit.findMany({
      orderBy: [{ scopeType: "asc" }, { scopeId: "asc" }],
    });

    return apiSuccess({ limits });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_BUDGET_MANAGE);

    const body = upsertBudgetSchema.parse(await req.json());

    const limit = await prisma.aiBudgetLimit.upsert({
      where: {
        scopeType_scopeId: {
          scopeType: body.scopeType,
          scopeId: body.scopeId,
        },
      },
      create: {
        scopeType: body.scopeType,
        scopeId: body.scopeId,
        dailyLimitUsd: body.dailyLimitUsd,
        monthlyLimitUsd: body.monthlyLimitUsd,
        hardStop: body.hardStop,
        isActive: body.isActive,
        updatedById: session.user.id,
      },
      update: {
        dailyLimitUsd: body.dailyLimitUsd,
        monthlyLimitUsd: body.monthlyLimitUsd,
        hardStop: body.hardStop,
        isActive: body.isActive,
        updatedById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CONTENT_STUDIO_BUDGET_UPSERT",
        entityType: "AiBudgetLimit",
        entityId: limit.id,
        metadata: body,
      },
    });

    return apiSuccess({ limit });
  } catch (err) {
    return handleApiError(err);
  }
}
