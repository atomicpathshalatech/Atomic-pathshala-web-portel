import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageLecture, getLectureOr404 } from "@/lib/lecture/access";
import { lectureUpdateSchema } from "@/lib/validation/lecture";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_READ);

    const lecture = await prisma.lecture.findUnique({
      where: { id: params.id },
      include: {
        chapter: { include: { subject: { include: { course: { select: { title: true } } } } } },
        teacher: { include: { user: { select: { name: true } } } },
        _count: { select: { issueReports: true } },
      },
    });
    if (!lecture) return apiError("Lecture not found", 404);
    if (!(await canManageLecture(session.user.id, lecture.teacherId))) throw new ForbiddenError();

    return apiSuccess({ lecture });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Editable regardless of status — unlike a Test (where students may be
 * mid-attempt against locked-in duration/instructions), correcting a
 * lecture's title, URL or slides after publishing is low-risk and common
 * (e.g. swapping in a re-uploaded video with better audio). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_UPDATE);

    const lecture = await getLectureOr404(params.id);
    if (!lecture) return apiError("Lecture not found", 404);
    if (!(await canManageLecture(session.user.id, lecture.teacherId))) throw new ForbiddenError();

    const input = lectureUpdateSchema.parse(await request.json());

    const updated = await prisma.lecture.update({
      where: { id: params.id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.language !== undefined && { language: input.language }),
        ...(input.order !== undefined && { order: input.order }),
        ...(input.videoUrl !== undefined && { videoUrl: input.videoUrl }),
        ...(input.educatorVideoUrl !== undefined && { educatorVideoUrl: input.educatorVideoUrl || null }),
        ...(input.slidesUrl !== undefined && { slidesUrl: input.slidesUrl || null }),
      },
    });

    return apiSuccess({ lecture: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_DELETE);

    const lecture = await getLectureOr404(params.id);
    if (!lecture) return apiError("Lecture not found", 404);
    if (!(await canManageLecture(session.user.id, lecture.teacherId))) throw new ForbiddenError();

    await prisma.lecture.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LECTURE_DELETED",
        entityType: "Lecture",
        entityId: params.id,
      },
    });

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
