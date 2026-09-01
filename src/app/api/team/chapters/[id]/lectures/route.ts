import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { LectureStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_READ);

    const lectures = await prisma.lecture.findMany({
      where: { chapterId: params.id },
      include: {
        teacher: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { order: "asc" },
    });

    return apiSuccess({ lectures });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_CREATE);

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: { subject: true },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    const body = await request.json();
    const { title, videoUrl, language, order, slidesUrl, educatorVideoUrl, status, teacherId: passedTeacherId } = body;

    if (!title?.trim()) {
      return apiError("Lecture title is required", 400);
    }
    if (!videoUrl?.trim()) {
      return apiError("Video / Stream URL is required", 400);
    }

    // Resolve teacher
    let teacherId = passedTeacherId;
    if (!teacherId) {
      const myTeacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
      if (myTeacher) {
        teacherId = myTeacher.id;
      } else {
        const anyTeacher = await prisma.teacher.findFirst();
        if (anyTeacher) {
          teacherId = anyTeacher.id;
        } else {
          // Create fallback teacher profile for admin
          const newTeacher = await prisma.teacher.create({
            data: {
              userId: session.user.id,
              employeeCode: `EMP_${session.user.id.slice(0, 6)}`,
              department: "ACADEMICS",
              subjects: [chapter.subject.title],
            },
          });
          teacherId = newTeacher.id;
        }
      }
    }

    // Find next order if not passed
    let lectureOrder = typeof order === "number" ? order : 0;
    if (lectureOrder === 0) {
      const last = await prisma.lecture.findFirst({
        where: { chapterId: chapter.id },
        orderBy: { order: "desc" },
      });
      lectureOrder = (last?.order ?? 0) + 1;
    }

    const lecture = await prisma.lecture.create({
      data: {
        chapterId: chapter.id,
        title: title.trim(),
        videoUrl: videoUrl.trim(),
        language: language || (chapter.medium === "HINDI" ? "Hindi" : chapter.medium === "HINGLISH" ? "Hinglish" : "English"),
        order: lectureOrder,
        slidesUrl: slidesUrl?.trim() || null,
        educatorVideoUrl: educatorVideoUrl?.trim() || null,
        status: status && Object.values(LectureStatus).includes(status) ? status : LectureStatus.PUBLISHED,
        teacherId,
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LECTURE_CREATED",
        entityType: "Lecture",
        entityId: lecture.id,
        metadata: { chapterId: chapter.id, title: lecture.title },
      },
    });

    return apiSuccess({ lecture }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}