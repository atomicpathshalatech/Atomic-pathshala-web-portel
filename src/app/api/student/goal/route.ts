import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const body = await request.json();
    const { targetExam } = body;

    if (!targetExam || typeof targetExam !== "string") {
      return apiError("Valid targetExam is required", 400);
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });

    if (!student) throw new ForbiddenError("Student profile not found");

    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { targetExam: targetExam.trim() },
      select: { id: true, targetExam: true },
    });

    return apiSuccess({
      message: `Goal successfully switched to ${updated.targetExam}`,
      targetExam: updated.targetExam,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
