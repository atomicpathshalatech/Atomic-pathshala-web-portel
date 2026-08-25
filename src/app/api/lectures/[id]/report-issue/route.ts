import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { lectureIssueReportSchema } from "@/lib/validation/lecture";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Student-side "Report an issue" from the settings menu — this is the real
 * backing for that screenshot's menu item. Ownership check: the lecture
 * must be published, and the student must be actively enrolled in a batch
 * whose course contains the lecture's chapter (same course-reachability
 * rule the lecture/chapter pages themselves enforce).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    if (session.user.role !== "STUDENT") throw new ForbiddenError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) throw new ForbiddenError();

    const input = lectureIssueReportSchema.parse(await request.json());

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

    const report = await prisma.lectureIssueReport.create({
      data: {
        lectureId: lecture.id,
        studentId: student.id,
        note: input.note,
      },
    });

    return apiSuccess({ report }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
