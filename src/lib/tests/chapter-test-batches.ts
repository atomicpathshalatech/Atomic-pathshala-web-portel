import "server-only";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Which batches a chapter test reaches: the batches the chapter is assigned
 * to, and the batches whose timetable has the chapter's classes (the same
 * two places the chapter page shows as "Scheduled in"). A chapter in no batch
 * reaches no student's schedule, so the test form lets whoever manages
 * batches pick them — that assigns the chapter to those batches.
 */
export async function chapterBatchIds(chapterId: string): Promise<string[]> {
  const [assigned, scheduled] = await Promise.all([
    prisma.batchChapter.findMany({ where: { chapterId }, select: { batchId: true } }),
    prisma.batchSchedule.findMany({ where: { chapterId }, distinct: ["batchId"], select: { batchId: true } }),
  ]);
  return Array.from(new Set([...assigned.map((a) => a.batchId), ...scheduled.map((s) => s.batchId)]));
}

export async function canAssignChapterBatches(userId: string): Promise<boolean> {
  return (await hasPermission(userId, PERMISSIONS.BATCH_UPDATE)) || (await hasPermission(userId, PERMISSIONS.BATCH_SCHEDULE_MANAGE));
}

export type AssignResult = { ok: true; added: number } | { ok: false; status: number; error: string };

/** Assigns the chapter to these batches (ones it is already in are left as they are). */
export async function assignChapterToBatches(userId: string, chapterId: string, batchIds: unknown): Promise<AssignResult> {
  if (!Array.isArray(batchIds) || batchIds.some((b) => typeof b !== "string")) return { ok: false, status: 400, error: "batchIds must be a list of batch ids." };
  const wanted = Array.from(new Set(batchIds as string[]));
  if (wanted.length === 0) return { ok: true, added: 0 };
  const current = new Set(await chapterBatchIds(chapterId));
  const toAdd = wanted.filter((id) => !current.has(id));
  if (toAdd.length === 0) return { ok: true, added: 0 };
  if (!(await canAssignChapterBatches(userId))) {
    return { ok: false, status: 403, error: "Only someone who manages batches can put this chapter (and its test) in a batch." };
  }
  const found = await prisma.batch.findMany({ where: { id: { in: toAdd } }, select: { id: true } });
  if (found.length !== toAdd.length) return { ok: false, status: 404, error: "One of the chosen batches was not found." };
  for (const batchId of toAdd) {
    await prisma.batchChapter.upsert({
      where: { batchId_chapterId: { batchId, chapterId } },
      update: {},
      create: { batchId, chapterId, assignedById: userId },
    });
  }
  await prisma.auditLog.create({
    data: { userId, action: "CHAPTER_ASSIGNED_TO_BATCHES", entityType: "Chapter", entityId: chapterId, metadata: { batchIds: toAdd, via: "chapter-test" } },
  });
  return { ok: true, added: toAdd.length };
}
