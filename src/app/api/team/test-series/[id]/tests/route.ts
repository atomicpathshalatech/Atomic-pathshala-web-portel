import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { seriesTestCreateSchema } from "@/lib/validation/test-series";

/**
 * Creates a standalone Test (no batchScheduleId) directly under a
 * TestSeries. Gated the same as everything else that manages a
 * non-batch-bound test — see canManageTest() in
 * @/lib/test-engine/access.ts — so creation and later management stay
 * consistent (a teacher who could create one but not manage it afterward
 * would be a dead end).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    const series = await prisma.testSeries.findUnique({ where: { id: params.id } });
    if (!series) return apiError("Test series not found", 404);

    const data = seriesTestCreateSchema.parse(await request.json());

    const test = await prisma.test.create({
      data: {
        testSeriesId: series.id,
        name: data.title,
        instructions: data.instructions || null,
        durationMin: data.durationMin,
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_CREATED",
        entityType: "Test",
        entityId: test.id,
        metadata: { testSeriesId: series.id },
      },
    });

    return apiSuccess({ test }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
