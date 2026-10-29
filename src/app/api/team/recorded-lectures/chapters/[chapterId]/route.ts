import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { recordedStorageStatus } from "@/lib/recorded-lectures/config";
import { pickPremiere } from "@/lib/recorded-lectures/premiere";

export const dynamic = "force-dynamic";

/** One chapter: its batches and its recorded lectures in order. */
export async function GET(_request: NextRequest, { params }: { params: { chapterId: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();

    const [chapter, batches] = await Promise.all([
      prisma.chapter.findUnique({
        where: { id: params.chapterId },
        select: {
          id: true,
          chapterId: true,
          title: true,
          description: true,
          subject: { select: { id: true, title: true, course: { select: { title: true } } } },
          batchAssignments: { orderBy: { assignedAt: "asc" }, select: { batch: { select: { id: true, name: true, status: true } } } },
          lectures: {
            where: { recordedMedia: { isNot: null } },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              status: true,
              order: true,
              language: true,
              teacher: { select: { displayName: true, user: { select: { name: true } } } },
              recordedMedia: { select: { uploadStatus: true, sizeBytes: true, durationSec: true, lectureNumber: true, archivedAt: true } },
              summaries: { where: { status: "PUBLISHED" }, select: { outdated: true }, take: 1 },
              // Its live-schedule slot (earliest first; one per batch, normally the same time).
              batchSchedules: { where: { classMode: "RECORDED", status: { not: "CANCELLED" } }, orderBy: { startsAt: "asc" }, select: { startsAt: true, endsAt: true } },
            },
          },
        },
      }),
      prisma.batch.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    if (!chapter) return apiError("Chapter not found.", 404);

    return apiSuccess({
      storage: recordedStorageStatus(),
      chapter: {
        id: chapter.id,
        code: chapter.chapterId,
        title: chapter.title,
        description: chapter.description,
        subject: { id: chapter.subject.id, title: chapter.subject.title },
        course: chapter.subject.course.title,
        batches: chapter.batchAssignments.map((a) => a.batch),
        lectures: chapter.lectures.map((l) => ({
          id: l.id,
          title: l.title,
          status: l.status,
          order: l.order,
          language: l.language,
          teacher: l.teacher.displayName || l.teacher.user.name,
          uploadStatus: l.recordedMedia?.uploadStatus ?? null,
          sizeBytes: Number(l.recordedMedia?.sizeBytes ?? 0),
          durationSec: l.recordedMedia?.durationSec ?? null,
          lectureNumber: l.recordedMedia?.lectureNumber ?? null,
          archived: Boolean(l.recordedMedia?.archivedAt),
          summary: l.summaries[0] ? (l.summaries[0].outdated ? "OUTDATED" : "PUBLISHED") : "NONE",
          scheduled: (() => {
            const slot = pickPremiere(l.batchSchedules);
            return slot ? { startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() } : null;
          })(),
        })),
      },
      allBatches: batches,
    });
  } catch (error) {
    return recordedApiError(error);
  }
}

const patchSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

/** Rename / describe the chapter. */
export async function PATCH(request: NextRequest, { params }: { params: { chapterId: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const input = patchSchema.parse(await request.json());
    await prisma.chapter.update({
      where: { id: params.chapterId },
      data: { ...(input.title !== undefined && { title: input.title }), ...(input.description !== undefined && { description: input.description }) },
    });
    await prisma.auditLog
      .create({ data: { userId, action: "RECORDED_CHAPTER_UPDATE", entityType: "Chapter", entityId: params.chapterId, metadata: { fields: Object.keys(input) } } })
      .catch(() => null);
    return apiSuccess({ ok: true });
  } catch (error) {
    return recordedApiError(error);
  }
}
