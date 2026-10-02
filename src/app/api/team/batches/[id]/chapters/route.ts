import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getMasterChapterById } from "@/lib/batch/master-chapters";
import { syncChapterLecturesIntoBatch } from "@/lib/batch/chapter-sync";
import { z } from "zod";

// Lectures keep the date / time already set on them in Chapter Management,
// so import takes only the chapter. (Old clients may still send timing
// fields; they are accepted and ignored.)
const importChapterSchema = z.object({
  chapterIdOrCode: z.string().min(1, "Chapter ID or code is required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    const batch = await prisma.batch.findUnique({
      where: { id: params.id },
      include: { teachers: true },
    });
    if (!batch) return apiError("Batch not found", 404);

    const body = await request.json();
    const input = importChapterSchema.parse(body);

    const masterChapter = await getMasterChapterById(input.chapterIdOrCode);
    if (!masterChapter) {
      return apiError(`Master Chapter "${input.chapterIdOrCode}" not found.`, 404);
    }

    // Check if masterChapter maps to a real DB Chapter
    const dbChapter = await prisma.chapter.findFirst({
      where: {
        OR: [
          { id: masterChapter.id },
          { chapterId: masterChapter.chapterCode },
          { title: masterChapter.title },
        ],
      },
      select: { id: true, title: true },
    });

    if (!dbChapter) return apiError(`Chapter "${masterChapter.title}" not found.`, 404);

    const [existingInBatch, existingAssignment] = await Promise.all([
      prisma.batchSchedule.findFirst({ where: { batchId: batch.id, chapterId: dbChapter.id }, select: { id: true } }),
      prisma.batchChapter.findUnique({ where: { batchId_chapterId: { batchId: batch.id, chapterId: dbChapter.id } }, select: { id: true } }),
    ]);
    if (existingInBatch || existingAssignment) {
      return apiError(
        `Chapter "${masterChapter.title}" (${masterChapter.chapterCode}) is already imported into this batch. Duplicate chapter imports are strictly forbidden.`,
        409
      );
    }

    await prisma.batchChapter.create({ data: { batchId: batch.id, chapterId: dbChapter.id, assignedById: session.user.id } });
    const sync = await syncChapterLecturesIntoBatch(batch.id, dbChapter.id, session.user.id);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_CHAPTER_IMPORTED",
        entityType: "Batch",
        entityId: batch.id,
        metadata: {
          chapterCode: masterChapter.chapterCode,
          chapterTitle: masterChapter.title,
          lecturesCount: masterChapter.lectures.length,
          lecturesScheduled: sync.scheduled,
          lecturesWithoutTime: sync.notScheduled,
        },
      },
    });

    return apiSuccess(
      {
        message:
          `Imported "${masterChapter.title}" — ${sync.scheduled} lecture${sync.scheduled === 1 ? "" : "s"} added at their set date & time` +
          (sync.notScheduled ? `; ${sync.notScheduled} without a date/time yet (they appear once scheduled in the chapter).` : "."),
        chapter: masterChapter,
        sync,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
