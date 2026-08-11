import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.TEACHER_READ);

    const application = await prisma.teacherApplication.findUnique({
      where: { id: params.id },
      include: { reviewedBy: true },
    });
    if (!application) return apiError("Application not found", 404);

    return apiSuccess({ application });
  } catch (error) {
    return handleApiError(error);
  }
}
