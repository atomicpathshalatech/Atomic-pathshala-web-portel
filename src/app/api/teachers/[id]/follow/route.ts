import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Student-follow-teacher. Deliberately no enrollment restriction — this is
 * a lightweight "subscribe to updates from this educator" action, not a
 * gated feature, so any signed-in student can follow any teacher on the
 * platform.
 *
 * Privacy: the follower LIST is never exposed anywhere, to anyone,
 * including the teacher themselves or an admin — only the aggregate count
 * (see GET below, and the Faculty Profile card on the team dashboard which
 * reads teacherFollow.count() directly). There is deliberately no route
 * that returns the list of students following a given teacher.
 */

async function requireStudent(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
  if (!student) throw new ForbiddenError("A student profile is required.");
  return student;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const followerCount = await prisma.teacherFollow.count({ where: { teacherId: params.id } });

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    const following = student
      ? (await prisma.teacherFollow.count({ where: { studentId: student.id, teacherId: params.id } })) > 0
      : false;

    return apiSuccess({ followerCount, following });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const student = await requireStudent(request);

    const teacher = await prisma.teacher.findUnique({ where: { id: params.id } });
    if (!teacher) return apiError("Teacher not found", 404);

    await prisma.teacherFollow.upsert({
      where: { studentId_teacherId: { studentId: student.id, teacherId: params.id } },
      create: { studentId: student.id, teacherId: params.id },
      update: {},
    });

    const followerCount = await prisma.teacherFollow.count({ where: { teacherId: params.id } });
    return apiSuccess({ following: true, followerCount }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const student = await requireStudent(request);

    await prisma.teacherFollow.deleteMany({ where: { studentId: student.id, teacherId: params.id } });

    const followerCount = await prisma.teacherFollow.count({ where: { teacherId: params.id } });
    return apiSuccess({ following: false, followerCount });
  } catch (error) {
    return handleApiError(error);
  }
}
