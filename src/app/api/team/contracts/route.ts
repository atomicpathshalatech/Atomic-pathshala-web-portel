import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { contractCreateSchema } from "@/lib/validation/contract";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * GET: admins (CONTRACT_READ_ANY) see everything, optionally filtered by
 * ?teacherId=. Teachers without that permission fall back to their own
 * contracts (CONTRACT_READ_SELF).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canReadAny = await hasPermission(session.user.id, PERMISSIONS.CONTRACT_READ_ANY);
    const teacherIdFilter = request.nextUrl.searchParams.get("teacherId");

    if (canReadAny) {
      const contracts = await prisma.contract.findMany({
        where: teacherIdFilter ? { teacherId: teacherIdFilter } : undefined,
        include: { teacher: { include: { user: { select: { name: true, email: true } } } } },
        orderBy: { createdAt: "desc" },
      });
      return apiSuccess({ contracts });
    }

    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_READ_SELF);
    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!teacher) return apiError("No faculty profile found for this account.", 404);

    const contracts = await prisma.contract.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({ contracts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_CREATE);

    const input = contractCreateSchema.parse(await request.json());

    const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
    if (!teacher) return apiError("Faculty member not found.", 404);
    if (teacher.onboardingStatus !== "PENDING_CONTRACT" && teacher.onboardingStatus !== "ACTIVE") {
      return apiError("This educator's documents must be verified before sending a contract.", 409);
    }

    const contract = await prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({
        data: {
          teacherId: input.teacherId,
          title: input.title,
          bodyText: input.bodyText,
          status: "SENT",
          sentAt: new Date(),
          createdById: session.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CONTRACT_SENT",
          entityType: "Contract",
          entityId: created.id,
        },
      });
      await tx.notification.create({
        data: {
          userId: teacher.userId,
          title: "New contract to review",
          body: `"${input.title}" is ready for your review and e-signature.`,
        },
      });
      return created;
    });

    return apiSuccess({ contract }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
