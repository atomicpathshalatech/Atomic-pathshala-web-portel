import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resolveTeacherForSchedule } from "@/lib/batch/access";
import { testCreateSchema } from "@/lib/validation/test";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Tests are scoped like everything else batch-first: a teacher who isn't an
 * admin only ever sees tests bound to batches they're actually assigned to
 * (via BatchTeacher or as the schedule's own teacher) — same ownership rule
 * as the live whiteboard, moved to src/lib/batch/access.ts so both features
 * share one implementation.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const batchId = request.nextUrl.searchParams.get("batchId") ?? undefined;
    const isAdmin = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    if (isAdmin) {
      const tests = await prisma.test.findMany({
        where: batchId ? { batchSchedule: { batchId } } : {},
        include: { batchSchedule: { include: { batch: { select: { id: true, name: true } } } } },
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
        batchSchedule: {
          batchId: batchId ?? { in: Array.from(assignedBatchIds) },
        },
      },
      include: { batchSchedule: { include: { batch: { select: { id: true, name: true } } } } },
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

    const test = await prisma.test.create({
      data: {
        batchScheduleId: schedule.id,
        name: input.title,
        instructions: input.instructions || null,
        durationMin: input.durationMin,
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_CREATED",
        entityType: "Test",
        entityId: test.id,
        metadata: { batchScheduleId: schedule.id },
      },
    });

    return apiSuccess({ test }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
