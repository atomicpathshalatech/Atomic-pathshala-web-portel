import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, ForbiddenError, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resolveTeacherForSchedule } from "@/lib/whiteboard/access";
import { whiteboardSessionStartSchema } from "@/lib/validation/whiteboard";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Start-or-resume the live whiteboard for a scheduled class. There is at
 * most one WhiteboardSession per BatchSchedule (see the @unique on
 * batchScheduleId in schema.prisma) — calling this twice for the same
 * schedule resumes the existing session instead of erroring, so a teacher
 * who refreshes the page or briefly drops connection doesn't lose the board
 * or its pages.
 *
 * Binds to BatchSchedule rather than a `Lecture` entity — see the comment
 * above the WhiteboardSession model in schema.prisma for why.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const input = whiteboardSessionStartSchema.parse(await request.json());

    const existing = await prisma.whiteboardSession.findUnique({
      where: { batchScheduleId: input.batchScheduleId },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });

    if (existing) {
      const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
      if (!teacher || teacher.id !== existing.teacherId) {
        throw new ForbiddenError("Only the teacher who started this class can resume it.");
      }

      if (existing.status === "ACTIVE") {
        return apiSuccess({ whiteboardSession: existing, resumed: true });
      }

      const resumed = await prisma.whiteboardSession.update({
        where: { id: existing.id },
        // Resuming a previously-ended session re-opens the pre-class lobby
        // (livePhase: PREPARING) rather than dropping straight back into
        // LIVE — the teacher explicitly re-confirms Start Class again, and
        // students see the lobby (with chat) instead of jumping straight to
        // a board/video that isn't actually ready yet.
        data: { status: "ACTIVE", endedAt: null, livePhase: "PREPARING" },
        include: { pages: { orderBy: { pageNumber: "asc" } } },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "WHITEBOARD_SESSION_RESUMED",
          entityType: "WhiteboardSession",
          entityId: existing.id,
          metadata: { batchScheduleId: input.batchScheduleId },
        },
      });

      return apiSuccess({ whiteboardSession: resumed, resumed: true });
    }

    let schedule = await prisma.batchSchedule.findUnique({
      where: { id: input.batchScheduleId },
    });

    if (!schedule) {
      const lecture = await prisma.lecture.findUnique({
        where: { id: input.batchScheduleId },
      });
      if (lecture) {
        const defaultBatch =
          (await prisma.batch.findFirst({ where: { status: "ACTIVE" } })) ||
          (await prisma.batch.findFirst());
        if (defaultBatch) {
          try {
            const { computeISTScheduleDates } = await import("@/lib/date-utils");
            const { startsAt, endsAt } = computeISTScheduleDates(
              lecture.scheduledDate,
              lecture.startTime,
              lecture.durationMin || 60
            );

            schedule = await prisma.batchSchedule.upsert({
              where: { id: lecture.id },
              update: {
                title: lecture.title,
                startsAt,
                endsAt,
              },
              create: {
                id: lecture.id,
                title: lecture.title,
                type: "LIVE_CLASS",
                batchId: defaultBatch.id,
                teacherId: lecture.teacherId,
                chapterId: lecture.chapterId,
                startsAt,
                endsAt,
                createdById: session.user.id,
              },
            });
          } catch {
            schedule = await prisma.batchSchedule.findFirst({ where: { id: lecture.id } });
          }
        }
      }
    }

    if (!schedule) return apiError("Scheduled class not found", 404);
    if (schedule.type !== "LIVE_CLASS") {
      return apiError(
        "The live whiteboard is only available for Live Class schedule entries.",
        400
      );
    }

    // Resolve teaching claim: assigned teacher first, then an
    // ACADEMIC_HEAD/admin override (BATCH_UPDATE) stepping in on behalf of
    // whichever teacher the batch/schedule already names.
    const { teacher: assignedTeacher } = await resolveTeacherForSchedule(
      session.user.id,
      input.batchScheduleId
    );

    let teacher = assignedTeacher;

    if (!teacher) {
      const isAdminOverride = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);
      if (!isAdminOverride) {
        throw new ForbiddenError("You are not assigned to teach this batch.");
      }

      const fallbackTeacherId =
        schedule.teacherId ??
        (await prisma.batchTeacher.findFirst({ where: { batchId: schedule.batchId } }))
          ?.teacherId;

      if (!fallbackTeacherId) {
        return apiError(
          "No teacher is assigned to this batch yet — assign one before starting the live class.",
          400
        );
      }

      teacher = await prisma.teacher.findUnique({ where: { id: fallbackTeacherId } });
      if (!teacher) return apiError("Assigned teacher record could not be found.", 400);
    }

    const created = await prisma.whiteboardSession.create({
      data: {
        batchScheduleId: schedule.id,
        teacherId: teacher.id,
        title: schedule.title,
        // Opening the room starts the pre-class lobby, not the live class
        // itself — chat is already on so students who join early can talk,
        // but the board/video only appear once the teacher explicitly hits
        // Start Class (PATCH livePhase: "LIVE").
        livePhase: "PREPARING",
        pages: { create: { pageNumber: 1, objects: [] } },
      },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });

    if (schedule.status === "SCHEDULED") {
      await prisma.batchSchedule.update({
        where: { id: schedule.id },
        data: { status: "LIVE" },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "WHITEBOARD_SESSION_STARTED",
        entityType: "WhiteboardSession",
        entityId: created.id,
        metadata: { batchScheduleId: schedule.id, teacherId: teacher.id },
      },
    });

    return apiSuccess({ whiteboardSession: created, resumed: false }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
