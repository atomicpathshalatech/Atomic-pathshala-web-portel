import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.DOCUMENT_READ_ANY);

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!teacher) return apiError("Faculty member not found.", 404);

    return apiSuccess({ teacher });
  } catch (error) {
    return handleApiError(error);
  }
}
