import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";

/**
 * A student's own batch(es) + timetable. Checked against the caller's own
 * Student record, not RBAC — same pattern as /api/doubts (a basic student
 * action, not a team-portal permission).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    const enrollments = await prisma.batchEnrollment.findMany({
      where: { studentId: student.id, status: "ACTIVE" },
      include: {
        batch: {
          include: {
            course: { select: { id: true, title: true } },
            teachers: { include: { teacher: { include: { user: true } } } },
            schedules: {
              orderBy: { startsAt: "asc" },
              include: { teacher: { include: { user: true } } },
            },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    return apiSuccess({ enrollments });
  } catch (error) {
    return handleApiError(error);
  }
}
