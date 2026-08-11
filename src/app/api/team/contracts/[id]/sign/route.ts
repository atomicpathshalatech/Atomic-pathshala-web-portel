import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { contractSignSchema } from "@/lib/validation/contract";
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

    const input = contractSignSchema.parse(await request.json());

    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!teacher) return apiError("No faculty profile found for this account.", 404);

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract) return apiError("Contract not found.", 404);
    if (contract.teacherId !== teacher.id) throw new ForbiddenError();
    if (contract.status !== "SENT") {
      return apiError("This contract is not awaiting a signature.", 409);
    }

    // A best-effort audit signal, not a legal identity guarantee.
    const forwardedFor = request.headers.get("x-forwarded-for");
    const signatureIp = forwardedFor?.split(",")[0]?.trim() ?? null;

    const updated = await prisma.$transaction(async (tx) => {
      const signed = await tx.contract.update({
        where: { id },
        data: {
          status: "SIGNED",
          signedAt: new Date(),
          signedName: input.signedName,
          signatureIp,
        },
      });

      await tx.teacher.updateMany({
        where: { id: teacher.id, onboardingStatus: "PENDING_CONTRACT" },
        data: { onboardingStatus: "ACTIVE" },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CONTRACT_SIGNED",
          entityType: "Contract",
          entityId: signed.id,
          ipAddress: signatureIp ?? undefined,
        },
      });

      return signed;
    });

    return apiSuccess({ contract: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
