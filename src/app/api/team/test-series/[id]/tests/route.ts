import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { seriesTestCreateSchema } from "@/lib/validation/test-series";
import {
  createSectionsFromTemplate,
  createSectionsFromPreset,
  getOrCreateDefaultSection,
} from "@/lib/test-engine/sections";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    const series = await prisma.testSeries.findUnique({ where: { id: params.id } });
    if (!series) return apiError("Test series not found", 404);

    const data = seriesTestCreateSchema.parse(await request.json());

    const openTime = data.startDate ? new Date(data.startDate) : null;

    const test = await prisma.test.create({
      data: {
        testSeriesId: series.id,
        name: data.title.trim(),
        instructions: data.instructions || null,
        durationMin: data.durationMin,
        templateId: data.templateId || null,
        testType: data.testType || null,
        examType: data.examType || null,
        openTime: openTime,
        syllabus: data.syllabus ? data.syllabus : undefined,
        createdById: session.user.id,
      },
    });

    // Apply template or preset sections
    if (data.templateId) {
      await createSectionsFromTemplate(test.id, data.templateId);
    } else if (data.templatePreset && ["NEET", "JEE", "CHAPTER_TEST"].includes(data.templatePreset)) {
      await createSectionsFromPreset(test.id, data.templatePreset as "NEET" | "JEE" | "CHAPTER_TEST");
    } else {
      await getOrCreateDefaultSection(test.id);
    }

    // Automatically sync test syllabus to all batches where this test series was imported
    try {
      const { syncTestSyllabusToBatches } = await import("@/lib/batch/test-syllabus-sync");
      await syncTestSyllabusToBatches({
        testId: test.id,
        testSeriesId: series.id,
      });
    } catch (syncErr) {
      console.error("[SeriesTestCreate] Syllabus sync error:", syncErr);
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_CREATED",
        entityType: "Test",
        entityId: test.id,
        metadata: {
          testSeriesId: series.id,
          templateId: data.templateId,
          templatePreset: data.templatePreset,
        },
      },
    });

    return apiSuccess({ test }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
