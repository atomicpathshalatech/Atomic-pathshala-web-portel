import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";

export async function DELETE(
  _request: Request,
  { params }: { params: { questionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    // Deleting a bookmark that doesn't exist is a no-op, not an error —
    // the client's "unbookmark" action shouldn't have to check state first.
    await prisma.bookmark.deleteMany({
      where: { studentId: student.id, questionId: params.questionId },
    });

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
