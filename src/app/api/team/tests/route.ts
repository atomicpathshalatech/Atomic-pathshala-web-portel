import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resolveTeacherForSchedule } from "@/lib/batch/access";
import { testCreateSchema } from "@/lib/validation/test";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  createSectionsFromTemplate,
  createSectionsFromPreset,
  getOrCreateDefaultSection,
} from "@/lib/test-engine/sections";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const batchId = request.nextUrl.searchParams.get("batchId") ?? undefined;
    const testSeriesId = request.nextUrl.searchParams.get("testSeriesId") ?? undefined;
    const isAdmin = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    if (isAdmin) {
      const tests = await prisma.test.findMany({
        where: {
          ...(batchId && { batchSchedule: { batchId } }),
          ...(testSeriesId && { testSeriesId }),
        },
        include: {
          batchSchedule: { include: { batch: { select: { id: true, name: true } } } },
          testSeries: { select: { id: true, name: true, code: true } },
          template: { select: { id: true, name: true } },
          _count: { select: { sections: true, attempts: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return apiSuccess({ tests });
    }

    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return apiSuccess({ tests: [] });

    const assignedBatchIds = new Set<string>();
    const [directSchedules, batchAssignments] = await Promise.all([
      prisma.batchSchedule.findMany({ where: { teacherId: teacher.id }, select: { batchId: true } }),
      prisma.batchTeacher.findMany({ where: { teacherId: teacher.id }, select: { batchId: true } }),
    ]);
    directSchedules.forEach((s) => assignedBatchIds.add(s.batchId));
    batchAssignments.forEach((b) => assignedBatchIds.add(b.batchId));

    if (batchId && !assignedBatchIds.has(batchId)) return apiSuccess({ tests: [] });

    const tests = await prisma.test.findMany({
      where: {
        OR: [
          {
            batchSchedule: {
              batchId: batchId ?? { in: Array.from(assignedBatchIds) },
            },
          },
          { createdById: session.user.id },
          ...(testSeriesId ? [{ testSeriesId }] : []),
        ],
      },
      include: {
        batchSchedule: { include: { batch: { select: { id: true, name: true } } } },
        testSeries: { select: { id: true, name: true, code: true } },
        template: { select: { id: true, name: true } },
        _count: { select: { sections: true, attempts: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({ tests });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_CREATE);

    const input = testCreateSchema.parse(await request.json());

    let finalScheduleId: string | null = null;
    let finalTestSeriesId: string | null = input.testSeriesId || null;

    if (input.batchScheduleId) {
      const existing = await prisma.test.findUnique({ where: { batchScheduleId: input.batchScheduleId } });
      if (existing) return apiError("A test already exists for this schedule entry.", 409);

      const { schedule, teacher } = await resolveTeacherForSchedule(session.user.id, input.batchScheduleId);
      if (!schedule) return apiError("Scheduled test slot not found", 404);
      if (schedule.type !== "TEST") {
        return apiError("Tests can only be attached to a 'Test' type schedule entry.", 400);
      }

      const isAdmin = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);
      if (!teacher && !isAdmin) {
        throw new ForbiddenError("You are not assigned to teach this batch.");
      }
      finalScheduleId = schedule.id;
    }

    const test = await prisma.test.create({
      data: {
        batchScheduleId: finalScheduleId,
        testSeriesId: finalTestSeriesId,
        name: input.title.trim(),
        instructions: input.instructions || null,
        durationMin: input.durationMin || 60,
        templateId: input.templateId || null,
        createdById: session.user.id,
      },
    });

    // Apply template or preset sections systematically
    if (input.templateId) {
      await createSectionsFromTemplate(test.id, input.templateId);
    } else if (input.templatePreset && ["NEET", "JEE", "CHAPTER_TEST"].includes(input.templatePreset)) {
      await createSectionsFromPreset(test.id, input.templatePreset as "NEET" | "JEE" | "CHAPTER_TEST");
    } else {
      await getOrCreateDefaultSection(test.id);
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_CREATED",
        entityType: "Test",
        entityId: test.id,
        metadata: {
          batchScheduleId: finalScheduleId,
          testSeriesId: finalTestSeriesId,
          templateId: input.templateId,
          templatePreset: input.templatePreset,
        },
      },
    });

    return apiSuccess({ test }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
