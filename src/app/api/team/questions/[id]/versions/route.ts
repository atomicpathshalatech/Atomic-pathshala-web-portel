import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const versions = await prisma.questionVersion.findMany({
      where: { questionId: params.id },
      include: {
        editedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { versionNumber: "desc" },
    });

    return apiSuccess({ versions });
  } catch (error) {
    return handleApiError(error);
  }
}
