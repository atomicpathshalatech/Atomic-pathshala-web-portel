import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordedBucket } from "./storage";
import type { z } from "zod";
import type { recordedLectureCreateSchema, recordedLectureUpdateSchema } from "./schemas";

export class RecordedLectureError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "RecordedLectureError";
  }
}

/** The player route; also stored in Lecture.videoUrl so every existing lecture link leads there. */
export const recordedWatchPath = (lectureId: string) => `/recorded-lectures/${lectureId}`;

const STAFF_INCLUDE = {
  chapter: { select: { id: true, title: true, subject: { select: { id: true, title: true, courseId: true } } } },
  teacher: { select: { id: true, user: { select: { name: true } } } },
  recordedMedia: { include: { batch: { select: { id: true, name: true } } } },
  about: true,
  summaries: { orderBy: { revision: "desc" as const }, take: 10 },
} satisfies Prisma.LectureInclude;

export type StaffRecordedLecture = Prisma.LectureGetPayload<{ include: typeof STAFF_INCLUDE }>;

export async function loadRecordedLecture(lectureId: string): Promise<StaffRecordedLecture | null> {
  const lecture = await prisma.lecture.findUnique({ where: { id: lectureId }, include: STAFF_INCLUDE });
  return lecture?.recordedMedia ? lecture : null;
}

/** JSON-safe view for the team screens (BigInt → number). */
export function serializeStaffLecture(l: StaffRecordedLecture) {
  const m = l.recordedMedia!;
  return {
    id: l.id,
    title: l.title,
    language: l.language,
    status: l.status,
    order: l.order,
    durationMin: l.durationMin,
    teacher: { id: l.teacher.id, name: l.teacher.user.name },
    chapter: { id: l.chapter.id, title: l.chapter.title },
    subject: { id: l.chapter.subject.id, title: l.chapter.subject.title },
    batch: m.batch ? { id: m.batch.id, name: m.batch.name } : null,
    media: {
      uploadStatus: m.uploadStatus,
      uploadError: m.uploadError,
      originalFileName: m.originalFileName,
      mimeType: m.mimeType,
      sizeBytes: Number(m.sizeBytes),
      durationSec: m.durationSec,
      hasThumbnail: Boolean(m.thumbnailKey),
      partSizeBytes: m.partSizeBytes,
      uploadOpen: Boolean(m.multipartUploadId),
      verifiedAt: m.verifiedAt,
      lectureNumber: m.lectureNumber,
      tags: m.tags,
      additionalNotes: m.additionalNotes,
      publishedAt: m.publishedAt,
      archivedAt: m.archivedAt,
      updatedAt: m.updatedAt,
    },
    about: l.about ? { content: l.about.content, revision: l.about.revision, updatedAt: l.about.updatedAt } : { content: "", revision: 0, updatedAt: null },
    summaries: l.summaries.map((s) => ({
      id: s.id,
      revision: s.revision,
      aboutRevision: s.aboutRevision,
      content: s.content,
      language: s.language,
      status: s.status,
      outdated: s.outdated,
      aiProvider: s.aiProvider,
      aiModel: s.aiModel,
      generatedAt: s.generatedAt,
      approvedAt: s.approvedAt,
      publishedAt: s.publishedAt,
      updatedAt: s.updatedAt,
    })),
  };
}

/** Batch → chapter must belong together: the chapter is assigned to the batch or is in its course. */
async function assertChapterInBatch(batchId: string, chapterId: string) {
  const [batch, chapter] = await Promise.all([
    prisma.batch.findUnique({ where: { id: batchId }, select: { id: true, courseId: true } }),
    prisma.chapter.findUnique({ where: { id: chapterId }, select: { id: true, subject: { select: { courseId: true } } } }),
  ]);
  if (!batch) throw new RecordedLectureError("That batch does not exist.", 400);
  if (!chapter) throw new RecordedLectureError("That chapter does not exist.", 400);
  const assigned = await prisma.batchChapter.count({ where: { batchId, chapterId } });
  if (!assigned && batch.courseId !== chapter.subject.courseId) {
    throw new RecordedLectureError("That chapter is not part of the chosen batch.", 400);
  }
}

async function assertTeacher(teacherId: string) {
  const t = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } });
  if (!t) throw new RecordedLectureError("That teacher does not exist.", 400);
}

/**
 * Creates the draft lecture + its media record (no file yet). A retried
 * request with the same requestId returns the draft it already made.
 */
export async function createRecordedDraft(input: z.infer<typeof recordedLectureCreateSchema>, userId: string) {
  const bucket = recordedBucket(); // throws when the separate storage is not set up
  const placeholderKey = `pending/${input.requestId}`;
  const existing = await prisma.recordedLectureMedia.findUnique({ where: { objectKey: placeholderKey }, select: { lectureId: true } });
  if (existing) return existing.lectureId;

  await Promise.all([assertChapterInBatch(input.batchId, input.chapterId), assertTeacher(input.teacherId)]);

  try {
    return await prisma.$transaction(async (tx) => {
      const order =
        input.sequenceNumber ??
        ((await tx.lecture.aggregate({ where: { chapterId: input.chapterId }, _max: { order: true } }))._max.order ?? 0) + 1;
      const lecture = await tx.lecture.create({
        data: {
          chapterId: input.chapterId,
          teacherId: input.teacherId,
          title: input.title,
          language: input.language,
          order,
          status: "DRAFT",
          durationMin: null,
        },
      });
      await tx.lecture.update({ where: { id: lecture.id }, data: { videoUrl: recordedWatchPath(lecture.id) } });
      await tx.recordedLectureMedia.create({
        data: {
          lectureId: lecture.id,
          bucket,
          objectKey: placeholderKey,
          mimeType: "video/mp4",
          sizeBytes: BigInt(0),
          batchId: input.batchId,
          lectureNumber: input.lectureNumber ?? null,
          tags: input.tags,
          additionalNotes: input.additionalNotes ?? null,
          createdById: userId,
          updatedById: userId,
        },
      });
      await tx.lectureAbout.create({ data: { lectureId: lecture.id, content: input.about, revision: 1, updatedById: userId } });
      return lecture.id;
    });
  } catch (err) {
    // Two identical requests at the same moment: the second hits the unique key.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await prisma.recordedLectureMedia.findUnique({ where: { objectKey: placeholderKey }, select: { lectureId: true } });
      if (again) return again.lectureId;
    }
    throw err;
  }
}

export async function updateRecordedMetadata(lectureId: string, input: z.infer<typeof recordedLectureUpdateSchema>, userId: string) {
  const current = await loadRecordedLecture(lectureId);
  if (!current) throw new RecordedLectureError("Recorded lecture not found.", 404);
  const batchId = input.batchId ?? current.recordedMedia!.batchId;
  const chapterId = input.chapterId ?? current.chapterId;
  if ((input.batchId || input.chapterId) && batchId) await assertChapterInBatch(batchId, chapterId);
  if (input.teacherId) await assertTeacher(input.teacherId);

  await prisma.$transaction([
    prisma.lecture.update({
      where: { id: lectureId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.language !== undefined && { language: input.language }),
        ...(input.chapterId !== undefined && { chapterId: input.chapterId }),
        ...(input.teacherId !== undefined && { teacherId: input.teacherId }),
        ...(input.sequenceNumber !== undefined && input.sequenceNumber !== null && { order: input.sequenceNumber }),
      },
    }),
    prisma.recordedLectureMedia.update({
      where: { lectureId },
      data: {
        ...(input.batchId !== undefined && { batchId: input.batchId }),
        ...(input.lectureNumber !== undefined && { lectureNumber: input.lectureNumber }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.additionalNotes !== undefined && { additionalNotes: input.additionalNotes }),
        updatedById: userId,
      },
    }),
  ]);
}

/**
 * Saves the About. Refuses when someone saved a newer version since the
 * editor loaded (baseRevision), so two editors cannot overwrite each other.
 * A changed About marks every summary made from an older version outdated.
 */
export async function saveAbout(lectureId: string, content: string, baseRevision: number, userId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.lectureAbout.findUnique({ where: { lectureId } });
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== baseRevision) {
      throw new RecordedLectureError("The About was changed by someone else since you opened it. Reload to see the latest version.", 409, "ABOUT_CONFLICT");
    }
    if (current && current.content === content) return current;
    const next = current
      ? await tx.lectureAbout.update({ where: { lectureId }, data: { content, revision: { increment: 1 }, updatedById: userId } })
      : await tx.lectureAbout.create({ data: { lectureId, content, revision: 1, updatedById: userId } });
    await tx.lectureSummary.updateMany({
      where: { lectureId, aboutRevision: { lt: next.revision }, status: { not: "SUPERSEDED" } },
      data: { outdated: true },
    });
    return next;
  });
}
