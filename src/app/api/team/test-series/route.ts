import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { testSeriesSchema } from "@/lib/validation/test-series";
import { generateTestSeriesCode } from "@/lib/test-series/code";
import { Prisma } from "@prisma/client";

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.TEST_READ);

    const series = await prisma.testSeries.findMany({
      include: { _count: { select: { tests: true } } },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    // Standalone TestSeries are managed the same way standalone (non-
    // batch-bound) tests are — admin-tier only, per canManageTest's rule
    // in @/lib/test-engine/access.ts.
    await requirePermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    const data = testSeriesSchema.parse(await request.json());

    let series: Awaited<ReturnType<typeof prisma.testSeries.create>> | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3 && !series; attempt++) {
      const code = await generateTestSeriesCode(prisma);
      try {
        series = await prisma.testSeries.create({
          data: {
            code,
            name: data.name,
            description: data.description || null,
            targetBatch: data.targetBatch || null,
            className: data.className || null,
            course: data.course || null,
            examType: data.examType || null,
            tags: data.tags.length > 0 ? data.tags.join(",") : null,
            visibility: data.visibility,
            startDate: data.startDate ? new Date(data.startDate) : null,
            endDate: data.endDate ? new Date(data.endDate) : null,
          },
        });
      } catch (err) {
        lastError = err;
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
          throw err;
        }
      }
    }

    if (!series) {
      throw lastError instanceof Error ? lastError : new Error("Could not generate a unique series code");
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_SERIES_CREATE",
        entityType: "TestSeries",
        entityId: series.id,
      },
    });

    return apiSuccess({ series }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
