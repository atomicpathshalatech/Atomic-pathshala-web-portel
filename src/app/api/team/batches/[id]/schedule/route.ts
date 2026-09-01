import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchScheduleCreateSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { checkScheduleConflict } from "@/lib/batch/schedule-conflict";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.BATCH_READ);

    const schedules = await prisma.batchSchedule.findMany({
      where: { batchId: params.id },
      include: { teacher: { include: { user: true } } },
      orderBy: { startsAt: "asc" },
    });

    return apiSuccess({ schedules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    const batch = await prisma.batch.findUnique({ where: { id: params.id } });
    if (!batch) return apiError("Batch not found", 404);

    const input = batchScheduleCreateSchema.parse(await request.json());

    if (input.teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
      if (!teacher) return apiError("Teacher not found", 404);
    }

    // Server-Side Conflict Check (Batch & Teacher Overlap)
    const conflict = await checkScheduleConflict({
      batchId: params.id,
      teacherId: input.teacherId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    if (conflict.hasConflict) {
      return apiError(conflict.message || "Schedule timing conflict detected.", 409);
    }

    const schedule = await prisma.batchSchedule.create({
      data: {
        batchId: params.id,
        title: input.title,
        subject: input.subject || null,
        type: input.type,
        teacherId: input.teacherId || null,
        chapterId: input.chapterId || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        notes: input.notes || null,
        createdById: session.user.id,
      },
      include: {
        teacher: { include: { user: true } },
        chapter: { include: { subject: { include: { course: true } } } },
      },
    });

    // If LIVE_CLASS with YouTube transport specified, initialize WhiteboardSession
    if (input.type === "LIVE_CLASS" && input.teacherId && (input.videoTransport === "YOUTUBE" || input.videoTransport === "BOTH")) {
      await prisma.whiteboardSession.upsert({
        where: { batchScheduleId: schedule.id },
        update: {
          videoTransport: input.videoTransport,
          youtubeVideoId: input.youtubeVideoId || null,
        },
        create: {
          batchScheduleId: schedule.id,
          teacherId: input.teacherId,
          title: schedule.title,
          videoTransport: input.videoTransport,
          youtubeVideoId: input.youtubeVideoId || null,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_SCHEDULE_CREATED",
        entityType: "Batch",
        entityId: params.id,
        metadata: {
          scheduleId: schedule.id,
          title: schedule.title,
          startsAt: schedule.startsAt.toISOString(),
          endsAt: schedule.endsAt.toISOString(),
        },
      },
    });

    return apiSuccess({ schedule }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
