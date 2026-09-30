import "server-only";
import { prisma } from "@/lib/db";
import { ROOT_FOLDER_NAME } from "@/lib/batch/folders";
import type { PastClassCreateInput } from "@/lib/validation/batch";
import { canonicalYouTubeUrl, checkYouTubeEmbeddable, parseYouTubeVideoId, type EmbedCheck } from "@/lib/youtube/video-link";

/**
 * Classes that happened before the app ran them (the batch started on
 * 1 July, classes were on YouTube since). Each one becomes:
 *   - a PUBLISHED lecture in its chapter (YouTube video + notes PDF), which
 *     is what students open from the chapter page;
 *   - a COMPLETED timetable entry on its real date, linked to that lecture
 *     (/watch/<id> sends students to the lecture);
 *   - the notes PDF, filed under "Class Notes / <Subject>" in the batch's
 *     materials.
 * No live room is created and nobody is notified: these are records, not
 * upcoming classes.
 */

export const CLASS_NOTES_FOLDER = "Class Notes";

const IST = "Asia/Kolkata";

/** "HH:mm" (24 h) in IST — the format Lecture.startTime/endTime use. */
export function istClock(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** Chapters this batch uses (assigned, scheduled, or in its course) and who can teach. */
export async function pastClassOptions(batchId: string) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      courseId: true,
      teachers: { select: { teacherId: true, subject: true, teacher: { select: { user: { select: { name: true } } } } } },
    },
  });
  if (!batch) return null;

  const chapters = await prisma.chapter.findMany({
    where: {
      status: { not: "ARCHIVED" },
      OR: [
        { batchAssignments: { some: { batchId } } },
        { batchSchedules: { some: { batchId } } },
        ...(batch.courseId ? [{ subject: { courseId: batch.courseId } }] : []),
      ],
    },
    select: { id: true, title: true, status: true, subject: { select: { title: true } } },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });

  let teachers = batch.teachers.map((t) => ({ id: t.teacherId, name: t.teacher.user.name, subject: t.subject }));
  if (teachers.length === 0) {
    const all = await prisma.teacher.findMany({ select: { id: true, department: true, user: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
    teachers = all.map((t) => ({ id: t.id, name: t.user.name, subject: t.department }));
  }

  return {
    chapters: chapters
      .map((c) => ({ id: c.id, title: c.title, subject: c.subject.title, status: c.status, visibleToStudents: c.status === "PUBLISHED" || c.status === "APPROVED" }))
      .sort((a, b) => a.subject.localeCompare(b.subject)),
    teachers,
  };
}

export class PastClassError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Finds or creates a folder by name under `parentId` (null = batch root level). */
async function ensureFolder(tx: typeof prisma, batchId: string, parentId: string | null, name: string, userId: string) {
  const existing = await tx.batchFolder.findFirst({ where: { batchId, parentId, name }, select: { id: true } });
  if (existing) return existing.id;
  const order = await tx.batchFolder.count({ where: { batchId, parentId } });
  const created = await tx.batchFolder.create({ data: { batchId, parentId, name, order, createdById: userId }, select: { id: true } });
  return created.id;
}

export async function createPastClass(
  batchId: string,
  userId: string,
  input: PastClassCreateInput,
  deps: { checkEmbed?: (id: string) => Promise<EmbedCheck> } = {}
) {
  const options = await pastClassOptions(batchId);
  if (!options) throw new PastClassError("Batch not found", 404);

  const chapter = await prisma.chapter.findUnique({
    where: { id: input.chapterId },
    select: { id: true, title: true, status: true, subject: { select: { title: true } } },
  });
  if (!chapter || !options.chapters.some((c) => c.id === chapter.id)) {
    throw new PastClassError("That chapter isn't part of this batch.");
  }
  const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId }, select: { id: true } });
  if (!teacher) throw new PastClassError("Teacher not found.");

  const videoId = parseYouTubeVideoId(input.youtubeUrl);
  if (!videoId) throw new PastClassError("That isn't a YouTube video link. Paste the link from YouTube's Share button.");
  const embed = await (deps.checkEmbed ?? checkYouTubeEmbeddable)(videoId);
  if (embed === "not_embeddable") {
    throw new PastClassError("This video can't play inside the app: embedding is off. In YouTube Studio → the video → Show more → tick \"Allow embedding\", then save it here again.");
  }
  if (embed === "not_found") {
    throw new PastClassError("YouTube can't find this video — it may be Private, deleted, or the link is wrong. Set it to Unlisted (or Public) and try again.");
  }

  const startsAt = input.startsAt;
  const endsAt = new Date(startsAt.getTime() + input.durationMin * 60_000);

  const duplicate = await prisma.batchSchedule.findFirst({
    where: { batchId, chapterId: chapter.id, startsAt },
    select: { id: true, title: true },
  });
  if (duplicate) throw new PastClassError(`Already added: "${duplicate.title}" at this date and time.`, 409);

  let notesAsset: { id: string; originalFilename: string; sizeBytes: bigint; mimeType: string } | null = null;
  if (input.notesFileAssetId) {
    const asset = await prisma.fileAsset.findUnique({
      where: { id: input.notesFileAssetId },
      select: { id: true, ownerId: true, originalFilename: true, sizeBytes: true, mimeType: true, status: true },
    });
    if (!asset || asset.status !== "ACTIVE") throw new PastClassError("The notes PDF didn't finish uploading — upload it again.", 410);
    // Only your own upload: otherwise any staff id could expose another document.
    if (asset.ownerId !== userId) throw new PastClassError("You can only attach a PDF you uploaded.", 403);
    if (asset.mimeType !== "application/pdf" && !asset.originalFilename.toLowerCase().endsWith(".pdf")) {
      throw new PastClassError("Notes must be a PDF file.");
    }
    notesAsset = asset;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.batchChapter.upsert({
      where: { batchId_chapterId: { batchId, chapterId: chapter.id } },
      update: {},
      create: { batchId, chapterId: chapter.id, assignedById: userId },
    });

    // Keep the chapter's classes in date order: slot in after the last
    // lecture dated before this one, pushing later ones down.
    const before = await tx.lecture.aggregate({
      where: { chapterId: chapter.id, scheduledDate: { lt: startsAt } },
      _max: { order: true },
    });
    const order = (before._max.order ?? 0) + 1;
    await tx.lecture.updateMany({ where: { chapterId: chapter.id, order: { gte: order } }, data: { order: { increment: 1 } } });

    const lecture = await tx.lecture.create({
      data: {
        chapterId: chapter.id,
        title: input.title,
        language: input.language,
        order,
        videoUrl: canonicalYouTubeUrl(videoId),
        scheduledDate: startsAt,
        startTime: istClock(startsAt),
        endTime: istClock(endsAt),
        durationMin: input.durationMin,
        status: "PUBLISHED",
        teacherId: teacher.id,
      },
      select: { id: true },
    });

    // Same id convention as the chapter-assignment sync
    // (chapter-assignments/route.ts), so re-assigning the chapter later
    // updates this row instead of adding a second copy of the class.
    const schedule = await tx.batchSchedule.create({
      data: {
        id: `${lecture.id}-${batchId}`,
        batchId,
        title: input.title,
        subject: chapter.subject.title,
        type: "LIVE_CLASS",
        status: "COMPLETED",
        teacherId: teacher.id,
        chapterId: chapter.id,
        lectureId: lecture.id,
        startsAt,
        endsAt,
        notes: "Recorded class (added after it happened)",
        createdById: userId,
      },
      select: { id: true },
    });

    let notesFileId: string | null = null;
    if (notesAsset) {
      const rootId = await ensureFolder(tx as typeof prisma, batchId, null, ROOT_FOLDER_NAME, userId);
      const notesId = await ensureFolder(tx as typeof prisma, batchId, rootId, CLASS_NOTES_FOLDER, userId);
      const subjectId = await ensureFolder(tx as typeof prisma, batchId, notesId, chapter.subject.title, userId);
      const file = await tx.batchFolderFile.create({
        data: {
          folderId: subjectId,
          fileAssetId: notesAsset.id,
          title: `${input.title} — Notes`,
          fileName: notesAsset.originalFilename,
          sizeBytes: Number(notesAsset.sizeBytes),
          mimeType: "application/pdf",
          order: await tx.batchFolderFile.count({ where: { folderId: subjectId } }),
          uploadedById: userId,
        },
        select: { id: true },
      });
      notesFileId = file.id;
      // Students open it through the enrolment-checked material route.
      await tx.lecture.update({ where: { id: lecture.id }, data: { slidesUrl: `/api/batch-materials/${file.id}?inline=1` } });
    }

    return { lectureId: lecture.id, scheduleId: schedule.id, notesFileId };
  });

  return {
    ...result,
    videoUrl: canonicalYouTubeUrl(videoId),
    embedCheck: embed,
    chapterVisibleToStudents: chapter.status === "PUBLISHED" || chapter.status === "APPROVED",
  };
}
