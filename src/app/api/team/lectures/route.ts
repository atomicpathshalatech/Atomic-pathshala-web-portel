import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { lectureCreateSchema } from "@/lib/validation/lecture";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Lectures are scoped by ownership, not by batch: a non-admin teacher only
 * ever sees lectures where `teacherId` points at their own Teacher profile
 * (same "own content only, unless admin" rule as Tests — see
 * src/lib/lecture/access.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_READ);

    const chapterId = request.nextUrl.searchParams.get("chapterId") ?? undefined;
    const isAdmin = await hasPermission(session.user.id, PERMISSIONS.LECTURE_PUBLISH);

    const chapterInclude = {
      chapter: { include: { subject: { include: { course: { select: { title: true } } } } } },
      teacher: { include: { user: { select: { name: true } } } },
    } as const;

    if (isAdmin) {
      const lectures = await prisma.lecture.findMany({
        where: chapterId ? { chapterId } : {},
        include: chapterInclude,
        orderBy: [{ chapterId: "asc" }, { order: "asc" }],
      });
      return apiSuccess({ lectures });
    }

    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return apiSuccess({ lectures: [] });

    const lectures = await prisma.lecture.findMany({
      where: { teacherId: teacher.id, ...(chapterId && { chapterId }) },
      include: chapterInclude,
      orderBy: [{ chapterId: "asc" }, { order: "asc" }],
    });
    return apiSuccess({ lectures });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_CREATE);

    const input = lectureCreateSchema.parse(await request.json());

    const chapter = await prisma.chapter.findUnique({ where: { id: input.chapterId } });
    if (!chapter) return apiError("Chapter not found", 404);

    // Resolve ownership: default to the caller's own Teacher profile. Only
    // an admin-tier user (LECTURE_PUBLISH) without a Teacher profile of
    // their own may attribute a lecture to a different faculty member —
    // and only by passing a real teacherId, never trusted blindly.
    const myTeacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    let teacherId: string;
    if (myTeacher) {
      teacherId = myTeacher.id;
    } else {
      const isAdmin = await hasPermission(session.user.id, PERMISSIONS.LECTURE_PUBLISH);
      if (!isAdmin) throw new ForbiddenError("You need a faculty profile to upload lectures.");
      if (!input.teacherId) {
        return apiError("Select a faculty member to attribute this lecture to.", 400);
      }
      const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
      if (!teacher) return apiError("Faculty member not found", 404);
      teacherId = teacher.id;
    }

    const lecture = await prisma.lecture.create({
      data: {
        chapterId: input.chapterId,
        title: input.title,
        language: input.language,
        order: input.order,
        videoUrl: input.videoUrl,
        educatorVideoUrl: input.educatorVideoUrl || null,
        slidesUrl: input.slidesUrl || null,
        teacherId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LECTURE_CREATED",
        entityType: "Lecture",
        entityId: lecture.id,
        metadata: { chapterId: input.chapterId },
      },
    });

    return apiSuccess({ lecture }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
