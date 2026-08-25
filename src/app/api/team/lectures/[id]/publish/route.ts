import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageLecture, getLectureOr404 } from "@/lib/lecture/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Publishing is gated behind LECTURE_PUBLISH — admin tier only, even though
 * a teacher can upload/edit their own draft. Same "second pair of eyes"
 * pattern as Test publishing and Question verification: a lecture only
 * becomes visible to students once someone besides its uploader has
 * checked it. */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_PUBLISH);

    const lecture = await getLectureOr404(params.id);
    if (!lecture) return apiError("Lecture not found", 404);
    if (!(await canManageLecture(session.user.id, lecture.teacherId))) throw new ForbiddenError();
    if (lecture.status !== "DRAFT") return apiError("This lecture has already been published.", 409);

    const updated = await prisma.lecture.update({
      where: { id: params.id },
      data: { status: "PUBLISHED" },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LECTURE_PUBLISHED",
        entityType: "Lecture",
        entityId: params.id,
      },
    });

    return apiSuccess({ lecture: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
