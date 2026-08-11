import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { teacher: { include: { user: { select: { name: true, email: true } } } } },
    });
    if (!contract) return apiError("Contract not found.", 404);

    const canReadAny = await hasPermission(session.user.id, PERMISSIONS.CONTRACT_READ_ANY);
    if (!canReadAny) {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!teacher || teacher.id !== contract.teacherId) throw new ForbiddenError();
    }

    return apiSuccess({ contract });
  } catch (error) {
    return handleApiError(error);
  }
}
