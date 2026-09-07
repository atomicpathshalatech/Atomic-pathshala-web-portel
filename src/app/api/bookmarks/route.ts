import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { bookmarkCreateSchema } from "@/lib/validation/bookmark";

/**
 * A student's own saved questions — ownership-scoped, not RBAC-gated,
 * same pattern as `/api/doubts` and `/api/batches/my`.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    const bookmarks = await prisma.bookmark.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      include: {
        question: {
          include: { translations: true },
        },
      },
    });

    return apiSuccess({ bookmarks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    const { questionId } = bookmarkCreateSchema.parse(await request.json());

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) return apiError("Question not found", 404);

    // Idempotent add — bookmarking an already-bookmarked question just
    // returns the existing row instead of erroring on the unique constraint.
    const bookmark = await prisma.bookmark.upsert({
      where: { studentId_questionId: { studentId: student.id, questionId } },
      create: { studentId: student.id, questionId },
      update: {},
    });

    return apiSuccess({ bookmark }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
