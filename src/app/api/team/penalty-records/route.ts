import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { penaltyRecordSchema } from "@/lib/validation/penalty";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canReadAny = await hasPermission(session.user.id, PERMISSIONS.PENALTY_READ_ANY);
    const teacherIdFilter = request.nextUrl.searchParams.get("teacherId");

    if (canReadAny) {
      const records = await prisma.penaltyRecord.findMany({
        where: teacherIdFilter ? { teacherId: teacherIdFilter } : undefined,
        include: {
          rule: { select: { name: true, deductionType: true } },
          teacher: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });
      return apiSuccess({ records });
    }

    await requirePermission(session.user.id, PERMISSIONS.PENALTY_READ_SELF);
    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!teacher) return apiError("No faculty profile found for this account.", 404);

    const records = await prisma.penaltyRecord.findMany({
      where: { teacherId: teacher.id },
      include: { rule: { select: { name: true, deductionType: true } } },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({ records });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.PENALTY_RECORD_CREATE);

    const input = penaltyRecordSchema.parse(await request.json());

    const [teacher, rule] = await Promise.all([
      prisma.teacher.findUnique({ where: { id: input.teacherId } }),
      prisma.penaltyRule.findUnique({ where: { id: input.ruleId } }),
    ]);
    if (!teacher) return apiError("Faculty member not found.", 404);
    if (!rule) return apiError("Penalty rule not found.", 404);

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.penaltyRecord.create({
        data: { ...input, createdById: session.user.id },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PENALTY_APPLIED",
          entityType: "PenaltyRecord",
          entityId: created.id,
          metadata: { teacherId: input.teacherId, ruleId: input.ruleId, amount: input.amount },
        },
      });
      await tx.notification.create({
        data: {
          userId: teacher.userId,
          title: "Compliance penalty applied",
          body: `A ₹${input.amount} deduction ("${rule.name}") was applied for ${input.month}.`,
        },
      });
      return created;
    });

    return apiSuccess({ record }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
