import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";

export const dynamic = "force-dynamic";

const schema = z.object({ batchId: z.string().min(1), action: z.enum(["add", "remove"]) });

/**
 * Add the chapter to a batch (its students then see the chapter's published
 * recorded lectures) or take it out of one. Uses the existing batch–chapter
 * assignment, so the chapter's other content follows the same rule.
 */
export async function POST(request: NextRequest, { params }: { params: { chapterId: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const { batchId, action } = schema.parse(await request.json());

    const [chapter, batch] = await Promise.all([
      prisma.chapter.findUnique({ where: { id: params.chapterId }, select: { id: true } }),
      prisma.batch.findUnique({ where: { id: batchId }, select: { id: true, name: true } }),
    ]);
    if (!chapter) return apiError("Chapter not found.", 404);
    if (!batch) return apiError("Batch not found.", 404);

    if (action === "add") {
      await prisma.batchChapter.upsert({
        where: { batchId_chapterId: { batchId, chapterId: chapter.id } },
        update: {},
        create: { batchId, chapterId: chapter.id, assignedById: userId },
      });
    } else {
      await prisma.batchChapter.deleteMany({ where: { batchId, chapterId: chapter.id } });
    }
    await prisma.auditLog
      .create({ data: { userId, action: action === "add" ? "RECORDED_CHAPTER_BATCH_ADD" : "RECORDED_CHAPTER_BATCH_REMOVE", entityType: "Chapter", entityId: chapter.id, metadata: { batchId, batch: batch.name } } })
      .catch(() => null);
    return apiSuccess({ ok: true });
  } catch (error) {
    return recordedApiError(error);
  }
}
