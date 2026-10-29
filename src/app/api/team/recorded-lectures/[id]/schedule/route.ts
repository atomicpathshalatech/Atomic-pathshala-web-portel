import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { recordedScheduleSchema } from "@/lib/recorded-lectures/schemas";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { parseIstLocal, premiereEnd, RECORDED_CLASS_MODE } from "@/lib/recorded-lectures/premiere";

export const dynamic = "force-dynamic";

/**
 * A recorded lecture in the batches' live schedule. Each batch gets one
 * class slot (BatchSchedule, LIVE_CLASS, classMode RECORDED) as long as the
 * video: students see it in the schedule like any class, it plays live in
 * the slot (no skipping ahead) and is a normal recording after it.
 *
 *   GET            → the lecture's slots and the batches it can be scheduled in
 *   POST           → schedule / move to {startsAt}; publishes the lecture
 *   DELETE ?slot=  → remove one slot (the lecture stays published)
 */

async function lectureFor(id: string) {
  return prisma.lecture.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      chapter: { select: { title: true, subject: { select: { title: true } }, batchAssignments: { select: { batch: { select: { id: true, name: true } } } } } },
      recordedMedia: { select: { uploadStatus: true, archivedAt: true, durationSec: true, batchId: true, publishedAt: true } },
    },
  });
}

/** The batches a lecture is for: its own batch, or every batch of its chapter. */
async function lectureBatches(lecture: NonNullable<Awaited<ReturnType<typeof lectureFor>>>) {
  const own = lecture.recordedMedia?.batchId;
  if (own) {
    const b = await prisma.batch.findUnique({ where: { id: own }, select: { id: true, name: true } });
    return b ? [b] : [];
  }
  return lecture.chapter.batchAssignments.map((a) => a.batch);
}

async function slotsOf(lectureId: string) {
  const slots = await prisma.batchSchedule.findMany({
    where: { lectureId, classMode: RECORDED_CLASS_MODE },
    orderBy: { startsAt: "asc" },
    select: { id: true, batchId: true, startsAt: true, endsAt: true, status: true, batch: { select: { name: true } } },
  });
  return slots.map((s) => ({ id: s.id, batchId: s.batchId, batchName: s.batch.name, startsAt: s.startsAt, endsAt: s.endsAt, status: s.status }));
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const lecture = await lectureFor(params.id);
    if (!lecture?.recordedMedia) return apiError("Recorded lecture not found.", 404);
    return apiSuccess({ slots: await slotsOf(lecture.id), batches: await lectureBatches(lecture) });
  } catch (error) {
    return recordedApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const input = recordedScheduleSchema.parse(await request.json());
    const lecture = await lectureFor(params.id);
    const media = lecture?.recordedMedia;
    if (!lecture || !media) return apiError("Recorded lecture not found.", 404);
    if (media.uploadStatus !== "READY") return apiError("Upload and verify the video before scheduling it.", 409, { code: "VIDEO_NOT_READY" });
    if (media.archivedAt) return apiError("Restore the lecture from the archive before scheduling it.", 409);

    const startsAt = parseIstLocal(input.startsAt);
    if (!startsAt) return apiError("Choose a valid date and time.", 422);
    if (startsAt.getTime() < Date.now() - 60_000) return apiError("Choose a time that has not passed yet.", 422);
    const endsAt = premiereEnd(startsAt, media.durationSec);

    const allowed = await lectureBatches(lecture);
    const batches = input.batchIds ? allowed.filter((b) => input.batchIds!.includes(b.id)) : allowed;
    if (!batches.length) {
      return apiError("This lecture is not in any batch yet. Add its chapter to a batch first.", 409, { code: "NO_BATCH" });
    }

    const existing = await prisma.batchSchedule.findMany({
      where: { lectureId: lecture.id, classMode: RECORDED_CLASS_MODE, batchId: { in: batches.map((b) => b.id) } },
      select: { id: true, batchId: true, startsAt: true, endsAt: true },
    });
    const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
    await prisma.$transaction(async (tx) => {
      for (const b of batches) {
        const slot = existing.find((e) => e.batchId === b.id);
        if (slot) {
          // One slot per batch: scheduling again moves it (a slot already over is moved too — it becomes the new premiere).
          await tx.batchSchedule.update({
            where: { id: slot.id },
            data: {
              startsAt,
              endsAt,
              durationMinutes,
              status: "SCHEDULED",
              ...(slot.startsAt.getTime() !== startsAt.getTime()
                ? { rescheduledAt: new Date(), rescheduledById: userId, previousStartsAt: slot.startsAt, previousEndsAt: slot.endsAt }
                : {}),
            },
          });
        } else {
          await tx.batchSchedule.create({
            data: {
              batchId: b.id,
              title: lecture.title,
              subject: lecture.chapter.subject.title,
              topic: lecture.chapter.title,
              durationMinutes,
              type: "LIVE_CLASS",
              classMode: RECORDED_CLASS_MODE,
              status: "SCHEDULED",
              lectureId: lecture.id,
              startsAt,
              endsAt,
              notes: "Recorded lecture — plays live at this time.",
              createdById: userId,
            },
          });
        }
      }
      // Scheduled = released at that time: the lecture is published (students cannot play it before the slot).
      if (lecture.status !== "PUBLISHED") await tx.lecture.update({ where: { id: lecture.id }, data: { status: "PUBLISHED" } });
      if (!media.publishedAt) {
        await tx.recordedLectureMedia.update({ where: { lectureId: lecture.id }, data: { publishedAt: new Date(), updatedById: userId } });
      }
    });

    await prisma.auditLog
      .create({
        data: {
          userId,
          action: "RECORDED_LECTURE_SCHEDULE",
          entityType: "Lecture",
          entityId: lecture.id,
          metadata: { startsAt: startsAt.toISOString(), batches: batches.map((b) => b.id) },
        },
      })
      .catch(() => null);
    return apiSuccess({ slots: await slotsOf(lecture.id), batches: allowed });
  } catch (error) {
    return recordedApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const slotId = request.nextUrl.searchParams.get("slot");
    if (!slotId) return apiError("Choose the slot to remove.", 400);
    const slot = await prisma.batchSchedule.findFirst({ where: { id: slotId, lectureId: params.id, classMode: RECORDED_CLASS_MODE }, select: { id: true, startsAt: true } });
    if (!slot) return apiError("Slot not found.", 404);
    // Not started: removed from the timetable. Started or over (students may have watched it): marked cancelled.
    if (slot.startsAt.getTime() > Date.now()) await prisma.batchSchedule.delete({ where: { id: slot.id } });
    else await prisma.batchSchedule.update({ where: { id: slot.id }, data: { status: "CANCELLED" } });
    await prisma.auditLog
      .create({ data: { userId, action: "RECORDED_LECTURE_UNSCHEDULE", entityType: "Lecture", entityId: params.id, metadata: { slotId } } })
      .catch(() => null);
    const lecture = await lectureFor(params.id);
    return apiSuccess({ slots: await slotsOf(params.id), batches: lecture ? await lectureBatches(lecture) : [] });
  } catch (error) {
    return recordedApiError(error);
  }
}
