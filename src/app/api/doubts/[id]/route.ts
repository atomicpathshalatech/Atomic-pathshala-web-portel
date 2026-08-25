import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";

/**
 * Single doubt, ownership-checked — a student may only read their own
 * doubt, never another student's, even by guessing an id.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    const doubt = await prisma.doubt.findUnique({
      where: { id: params.id },
      include: { resolvedBy: { select: { name: true } } },
    });
    if (!doubt) return apiError("Doubt not found.", 404);
    if (doubt.studentId !== student.id) {
      throw new ForbiddenError("This doubt doesn't belong to your account.");
    }

    return apiSuccess({ doubt });
  } catch (error) {
    return handleApiError(error);
  }
}
