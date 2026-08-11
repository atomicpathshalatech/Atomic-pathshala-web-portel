import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { penaltyRuleSchema } from "@/lib/validation/penalty";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    // Anyone who can see any penalty context (self or any) can see the
    // active rule catalogue — it's policy, not a secret.
    if (!session?.user?.id) throw new UnauthorizedError();

    const rules = await prisma.penaltyRule.findMany({ orderBy: { createdAt: "asc" } });
    return apiSuccess({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.PENALTY_RULE_MANAGE);

    const input = penaltyRuleSchema.parse(await request.json());

    const rule = await prisma.$transaction(async (tx) => {
      const created = await tx.penaltyRule.create({ data: input });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PENALTY_RULE_CREATED",
          entityType: "PenaltyRule",
          entityId: created.id,
        },
      });
      return created;
    });

    return apiSuccess({ rule }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
