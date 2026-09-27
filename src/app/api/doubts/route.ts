import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { doubtCreateSchema } from "@/lib/validation/doubt";

/**
 * A student's own doubts — ownership-scoped, not RBAC-gated, same pattern
 * as `/api/batches/my` (a basic student action, not a team-portal
 * permission check).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
    if (!student) return apiError("No student profile found for this account.", 404);

    const doubts = await prisma.doubt.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      include: { resolvedBy: { select: { name: true } } },
    });

    return apiSuccess({ doubts });
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

    const body = doubtCreateSchema.parse(await request.json());

    const doubt = await prisma.doubt.create({
      data: {
        studentId: student.id,
        subject: body.subject,
        body: body.body,
        priority: body.priority,
        attachmentUrl: body.attachmentUrl || null,
      },
    });

    return apiSuccess({ doubt }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
