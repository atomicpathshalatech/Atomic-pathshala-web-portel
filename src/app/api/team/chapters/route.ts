import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { chapterSchema } from "@/lib/validation/chapter";
import { generateChapterId } from "@/lib/chapters/code";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.CHAPTER_READ);

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");
    const courseId = searchParams.get("courseId");
    const medium = searchParams.get("medium");
    const status = searchParams.get("status");

    const where: Prisma.ChapterWhereInput = {
      ...(subjectId ? { subjectId } : {}),
      ...(courseId ? { subject: { courseId } } : {}),
      ...(medium ? { medium: medium as Prisma.EnumMediumFilter } : {}),
      ...(status ? { status: status as Prisma.EnumChapterStatusFilter } : {}),
    };

    const chapters = await prisma.chapter.findMany({
      where,
      include: {
        subject: { include: { course: true } },
        _count: { select: { lectures: true, dpps: true, tests: true } },
      },
      orderBy: [{ subjectId: "asc" }, { order: "asc" }],
    });

    return apiSuccess({ chapters });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CHAPTER_CREATE);

    const data = chapterSchema.parse(await request.json());

    const subject = await prisma.subject.findUnique({
      where: { id: data.subjectId },
      include: { course: true },
    });
    if (!subject) return apiError("Subject not found", 404);

    if (data.courseId && subject.courseId !== data.courseId) {
      return apiError("The selected Subject does not belong to the selected Course/Exam", 400);
    }

    let chapter: Awaited<ReturnType<typeof prisma.chapter.create>> | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3 && !chapter; attempt++) {
      const chapterId = await generateChapterId(prisma);
      try {
        chapter = await prisma.chapter.create({
          data: {
            chapterId,
            title: data.title,
            subjectId: data.subjectId,
            medium: data.medium,
            order: data.order,
            description: data.description ?? null,
            learningObjectives: data.learningObjectives ?? null,
            prerequisites: data.prerequisites ?? null,
            createdById: session.user.id,
          },
          include: {
            subject: { include: { course: true } },
          },
        });
      } catch (err) {
        lastError = err;
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
          throw err;
        }
      }
    }

    if (!chapter) {
      throw lastError instanceof Error ? lastError : new Error("Could not generate a unique chapter ID");
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CHAPTER_CREATE",
        entityType: "Chapter",
        entityId: chapter.id,
        metadata: { chapterId: chapter.chapterId },
      },
    });

    return apiSuccess({ chapter }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
