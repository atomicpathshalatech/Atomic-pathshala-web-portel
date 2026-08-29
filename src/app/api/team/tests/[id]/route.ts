import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { testUpdateSchema } from "@/lib/validation/test";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: {
        batchSchedule: { include: { batch: { select: { id: true, name: true } } } },
        sections: {
          orderBy: { order: "asc" },
          include: { questions: { orderBy: { order: "asc" }, include: { question: true } } },
        },
      },
    });
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    const totalMarks = test.sections.reduce(
      (sum, s) =>
        sum + s.questions.reduce((sSum, sq) => sSum + (sq.marksOverride ?? s.marksPerQuestion ?? test.correctMarks), 0),
      0
    );
    return apiSuccess({ test, totalMarks });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Editable only while DRAFT — once published, students may already be
 * mid-attempt against the current duration/instructions, so changing them
 * would be unfair or confusing. Delete a published test and start a new one
 * if a real correction is needed. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();
    if (test.status !== "DRAFT") return apiError("Only draft tests can be edited.", 409);

    const input = testUpdateSchema.parse(await request.json());

    const updated = await prisma.test.update({
      where: { id: params.id },
      data: {
        ...(input.title !== undefined && { name: input.title }),
        ...(input.instructions !== undefined && { instructions: input.instructions }),
        ...(input.durationMin !== undefined && { durationMin: input.durationMin }),
      },
    });

    return apiSuccess({ test: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_DELETE);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();
    if (test.status !== "DRAFT") {
      return apiError("Only draft tests can be deleted — a published test may already have attempts.", 409);
    }

    await prisma.test.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_DELETED",
        entityType: "Test",
        entityId: params.id,
      },
    });

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
