import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { contractDeclineSchema } from "@/lib/validation/contract";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTRACT_SIGN_SELF);

    const input = contractDeclineSchema.parse(await request.json());

    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!teacher) return apiError("No faculty profile found for this account.", 404);

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) return apiError("Contract not found.", 404);
    if (contract.teacherId !== teacher.id) throw new ForbiddenError();
    if (contract.status !== "SENT") {
      return apiError("This contract is not awaiting a response.", 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const declined = await tx.contract.update({
        where: { id },
        data: { status: "DECLINED", declinedReason: input.declinedReason },
      });
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CONTRACT_DECLINED",
          entityType: "Contract",
          entityId: declined.id,
          metadata: { reason: input.declinedReason },
        },
      });
      return declined;
    });

    return apiSuccess({ contract: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
