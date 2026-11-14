import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    // Check new Agreement model
    const agreement = await prisma.agreement.findUnique({
      where: { id: params.id },
      include: {
        educator: { include: { user: true } },
        signers: {
          include: {
            signatures: true,
            invitations: { orderBy: { sentAt: "desc" } },
          },
        },
        stamp: true,
        versions: { orderBy: { versionNumber: "desc" } },
        emailLogs: { orderBy: { createdAt: "desc" } },
        auditLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    if (agreement) {
      const canReadAny = await hasPermission(session.user.id, PERMISSIONS.CONTRACT_READ_ANY);
      if (!canReadAny && agreement.educator.userId !== session.user.id) {
        throw new ForbiddenError();
      }
      return apiSuccess({ contract: agreement });
    }

    // Fallback to legacy Contract model
    const legacyContract = await prisma.contract.findUnique({
      where: { id: params.id },
      include: { teacher: { include: { user: { select: { name: true, email: true } } } } },
    });
    if (!legacyContract) return apiError("Contract not found.", 404);

    const canReadAny = await hasPermission(session.user.id, PERMISSIONS.CONTRACT_READ_ANY);
    if (!canReadAny && legacyContract.teacher.userId !== session.user.id) {
      throw new ForbiddenError();
    }

    return apiSuccess({ contract: legacyContract });
  } catch (error) {
    return handleApiError(error);
  }
}
