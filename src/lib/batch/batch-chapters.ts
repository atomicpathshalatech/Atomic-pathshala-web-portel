import "server-only";
import { prisma } from "@/lib/db";

/**
 * The chapters a batch covers, worked out the same way the student's batch
 * page does (src/lib/batch/student-batch-home.ts): chapters assigned to the
 * batch, the chapters of its course, and the chapters of its classes / DPPs —
 * by the class's chapter, or by its topic / title ("Isomerism — Part 1").
 * Many batches have no course set and no assigned chapters, so the classes
 * are often the only link.
 *
 * Returns, for each chapter id, the first of the given batches that covers it.
 */
export async function chaptersOfBatches(batchIds: string[]): Promise<Map<string, string>> {
  const byChapter = new Map<string, string>();
  if (batchIds.length === 0) return byChapter;

  const [batches, assigned, schedules] = await Promise.all([
    prisma.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, courseId: true } }),
    prisma.batchChapter.findMany({ where: { batchId: { in: batchIds } }, select: { batchId: true, chapterId: true } }),
    prisma.batchSchedule.findMany({
      where: { batchId: { in: batchIds }, type: { in: ["LIVE_CLASS", "DPP"] } },
      select: { batchId: true, chapterId: true, topic: true, title: true, chapter: { select: { title: true } } },
    }),
  ]);

  const add = (chapterId: string, batchId: string) => {
    if (!byChapter.has(chapterId)) byChapter.set(chapterId, batchId);
  };
  for (const a of assigned) add(a.chapterId, a.batchId);

  const courseBatch = new Map<string, string>();
  for (const b of batches) if (b.courseId && !courseBatch.has(b.courseId)) courseBatch.set(b.courseId, b.id);
  if (courseBatch.size) {
    const courseChapters = await prisma.chapter.findMany({
      where: { subject: { courseId: { in: Array.from(courseBatch.keys()) } } },
      select: { id: true, subject: { select: { courseId: true } } },
    });
    for (const c of courseChapters) add(c.id, courseBatch.get(c.subject.courseId)!);
  }

  const titleBatch = new Map<string, string>();
  for (const s of schedules) {
    if (s.chapterId) add(s.chapterId, s.batchId);
    for (const t of [s.topic, s.chapter?.title, s.title.includes("—") ? s.title.split("—")[0]?.trim() : null]) {
      if (t && !titleBatch.has(t)) titleBatch.set(t, s.batchId);
    }
  }
  if (titleBatch.size) {
    const byTitle = await prisma.chapter.findMany({ where: { title: { in: Array.from(titleBatch.keys()) } }, select: { id: true, title: true } });
    for (const c of byTitle) add(c.id, titleBatch.get(c.title)!);
  }
  return byChapter;
}
