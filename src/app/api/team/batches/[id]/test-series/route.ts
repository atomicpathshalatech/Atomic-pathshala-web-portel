import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { syncTestSyllabusToBatches } from "@/lib/batch/test-syllabus-sync";

export const dynamic = "force-dynamic";

/**
 * GET /api/team/batches/[id]/test-series
 * List all Test Series imported into this batch, along with all tests.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_READ);

    const batch = await prisma.batch.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, code: true },
    });
    if (!batch) return apiError("Batch not found", 404);

    const importedSeries = await prisma.batchTestSeries.findMany({
      where: { batchId: params.id },
      orderBy: { importedAt: "desc" },
      include: {
        testSeries: {
          include: {
            tests: {
              where: { archived: false },
              orderBy: { createdAt: "asc" },
              include: {
                sections: {
                  select: {
                    id: true,
                    name: true,
                    subject: true,
                    targetCount: true,
                    _count: { select: { questions: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const items = importedSeries.map((item) => ({
      importId: item.id,
      importedAt: item.importedAt,
      testSeries: {
        id: item.testSeries.id,
        name: item.testSeries.name,
        code: item.testSeries.code,
        description: item.testSeries.description,
        targetBatch: item.testSeries.targetBatch,
        examType: item.testSeries.examType,
        visibility: item.testSeries.visibility,
        status: item.testSeries.status,
        tests: item.testSeries.tests.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          durationMin: t.durationMin,
          openTime: t.openTime,
          examType: t.examType,
          testType: t.testType,
          status: t.status,
          syllabus: t.syllabus,
          totalQuestions: t.sections.reduce(
            (sum, s) => sum + (s._count?.questions || s.targetCount || 0),
            0
          ),
          sections: t.sections,
        })),
      },
    }));

    return apiSuccess({ testSeries: items });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/team/batches/[id]/test-series
 * Import a master Test Series into this batch by unique ID or Code.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const batch = await prisma.batch.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    });
    if (!batch) return apiError("Batch not found", 404);

    const body = await request.json();
    const query = (body.testSeriesIdOrCode || body.testSeriesId || "").trim();

    if (!query) {
      return apiError("Please provide a Test Series Unique ID or Code", 400);
    }

    // Find test series by ID or Code
    const testSeries = await prisma.testSeries.findFirst({
      where: {
        OR: [{ id: query }, { code: query }],
      },
    });

    if (!testSeries) {
      return apiError(`Test Series with code/ID "${query}" was not found.`, 404);
    }

    // Check if already imported
    const existing = await prisma.batchTestSeries.findUnique({
      where: {
        batchId_testSeriesId: {
          batchId: batch.id,
          testSeriesId: testSeries.id,
        },
      },
    });

    if (existing) {
      return apiError("This Test Series is already imported in this batch.", 409);
    }

    // Create link
    const link = await prisma.batchTestSeries.create({
      data: {
        batchId: batch.id,
        testSeriesId: testSeries.id,
      },
    });

    // Automatically sync all syllabus documents & folders for tests in this series
    await syncTestSyllabusToBatches({
      batchId: batch.id,
      testSeriesId: testSeries.id,
    });

    return apiSuccess({ link, testSeries }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/team/batches/[id]/test-series
 * Unlink / remove an imported test series from this batch.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const body = await request.json();
    const testSeriesId = body.testSeriesId;

    if (!testSeriesId) {
      return apiError("testSeriesId is required", 400);
    }

    await prisma.batchTestSeries.deleteMany({
      where: {
        batchId: params.id,
        testSeriesId,
      },
    });

    return apiSuccess({ unlinked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
