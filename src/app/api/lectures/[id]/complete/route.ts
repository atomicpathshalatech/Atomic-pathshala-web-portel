import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { awardXp } from "@/lib/gamification/xp";

// XP for finishing a video lecture. Kept below LIVE_CLASS_ATTENDANCE's 20 —
// watching an on-demand recording is lower-effort than attending live.
const LECTURE_COMPLETE_XP = 15;

/**
 * Student marks a lecture as watched. Idempotent: re-marking an already
 * completed lecture is a no-op (no duplicate XP), matching the pattern
 * every other one-time XP award in this codebase needs but none of them
 * had to solve yet since this is the first "mark complete" action.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    if (session.user.role !== "STUDENT") throw new ForbiddenError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) throw new ForbiddenError();

    const lecture = await prisma.lecture.findUnique({
      where: { id: params.id },
      include: { chapter: { include: { subject: true } } },
    });
    if (!lecture || lecture.status !== "PUBLISHED") return apiError("Lecture not found", 404);

    const enrolled = await prisma.batchEnrollment.count({
      where: {
        studentId: student.id,
        status: "ACTIVE",
        batch: { courseId: lecture.chapter.subject.courseId },
      },
    });
    if (enrolled === 0) throw new ForbiddenError("You are not enrolled in this course.");

    const existing = await prisma.lectureProgress.findUnique({
      where: { lectureId_studentId: { lectureId: lecture.id, studentId: student.id } },
    });
    if (existing) {
      return apiSuccess({ completedAt: existing.completedAt, alreadyCompleted: true });
    }

    const progress = await prisma.lectureProgress.create({
      data: { lectureId: lecture.id, studentId: student.id },
    });
    await awardXp(student.id, LECTURE_COMPLETE_XP, "LECTURE_COMPLETED", { lectureId: lecture.id });

    return apiSuccess({ completedAt: progress.completedAt, alreadyCompleted: false }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
