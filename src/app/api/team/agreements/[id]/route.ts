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

    if (!agreement) {
      return apiError("Agreement not found.", 404);
    }

    const canReadAny = await hasPermission(session.user.id, PERMISSIONS.CONTRACT_READ_ANY);
    if (!canReadAny) {
      const isOwner = agreement.educator.userId === session.user.id;
      if (!isOwner) throw new ForbiddenError();
    }

    return apiSuccess({ agreement });
  } catch (error) {
    return handleApiError(error);
  }
}
