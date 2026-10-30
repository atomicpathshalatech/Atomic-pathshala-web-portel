import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Chosen students only: a chapter's recorded lectures are seen in a batch
 * only by the students ticked for it (RecordedChapterViewer rows). Nobody
 * else — not the rest of the batch. Before the migration has run the table
 * is missing: then nobody sees them (fail closed).
 */

const key = (batchId: string, chapterId: string) => `${batchId}:${chapterId}`;

function missingTable(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022");
}

/** "batchId:chapterId" pairs this student has been chosen for. */
export async function allowedChapters(studentId: string, batchIds: string[]): Promise<Set<string>> {
  if (!batchIds.length) return new Set();
  try {
    const mine = await prisma.recordedChapterViewer.findMany({
      where: { studentId, batchId: { in: batchIds } },
      select: { batchId: true, chapterId: true },
    });
    return new Set(mine.map((m) => key(m.batchId, m.chapterId)));
  } catch (err) {
    if (missingTable(err)) return new Set();
    throw err;
  }
}

export function isAllowed(allowed: Set<string>, batchId: string, chapterId: string): boolean {
  return allowed.has(key(batchId, chapterId));
}

/** Chapters (ids) this student was chosen for in one batch. */
export function allowedChapterIds(allowed: Set<string>, batchId: string): string[] {
  const prefix = `${batchId}:`;
  return Array.from(allowed)
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length));
}

/** Class slots without the recorded-lecture slots this student was not chosen for. */
export async function withoutUnchosenRecordedSlots<T extends { classMode?: string | null; lectureId: string | null; batchId: string }>(studentId: string, slots: T[]): Promise<T[]> {
  const recorded = slots.filter((s) => s.classMode === "RECORDED");
  if (!recorded.length) return slots;
  const lectureIds = Array.from(new Set(recorded.map((s) => s.lectureId).filter((id): id is string => Boolean(id))));
  const [lectures, chosen] = await Promise.all([
    prisma.lecture.findMany({ where: { id: { in: lectureIds } }, select: { id: true, chapterId: true } }),
    allowedChapters(studentId, Array.from(new Set(recorded.map((s) => s.batchId)))),
  ]);
  const chapterOf = new Map(lectures.map((l) => [l.id, l.chapterId]));
  return slots.filter((s) => {
    if (s.classMode !== "RECORDED") return true;
    const chapterId = s.lectureId ? chapterOf.get(s.lectureId) : undefined;
    return Boolean(chapterId && isAllowed(chosen, s.batchId, chapterId));
  });
}

/** The students chosen for one chapter in one batch. */
export async function chapterViewerIds(batchId: string, chapterId: string): Promise<string[]> {
  const viewers = await prisma.recordedChapterViewer.findMany({ where: { batchId, chapterId }, select: { studentId: true } });
  return viewers.map((v) => v.studentId);
}

/** Replaces the chosen students of a chapter in a batch (empty: nobody). */
export async function saveChapterViewers(p: { batchId: string; chapterId: string; studentIds: string[]; userId: string }) {
  await prisma.$transaction(async (tx) => {
    await tx.recordedChapterViewer.deleteMany({ where: { batchId: p.batchId, chapterId: p.chapterId, studentId: { notIn: p.studentIds } } });
    if (p.studentIds.length) {
      await tx.recordedChapterViewer.createMany({
        data: p.studentIds.map((studentId) => ({ batchId: p.batchId, chapterId: p.chapterId, studentId, addedById: p.userId })),
        skipDuplicates: true,
      });
    }
  });
}

/** Two devices may not play at once; the newest device takes over. */
export const DEVICE_WINDOW_MS = 2 * 60 * 1000;

/**
 * Claims playback for this device. Returns false when another device has
 * taken over since (the caller stops playback there). `takeOver`: a fresh
 * start on this device always wins; a heartbeat does not steal it back.
 */
export async function claimPlayback(p: { studentId: string; deviceId: string; lectureId: string; takeOver: boolean }): Promise<boolean> {
  try {
    const now = new Date();
    const current = await prisma.recordedPlaybackSession.findUnique({ where: { studentId: p.studentId } });
    const otherActive = current && current.deviceId !== p.deviceId && now.getTime() - current.lastSeenAt.getTime() < DEVICE_WINDOW_MS;
    if (otherActive && !p.takeOver) return false;
    await prisma.recordedPlaybackSession.upsert({
      where: { studentId: p.studentId },
      update: { deviceId: p.deviceId, lectureId: p.lectureId, lastSeenAt: now },
      create: { studentId: p.studentId, deviceId: p.deviceId, lectureId: p.lectureId, lastSeenAt: now },
    });
    return true;
  } catch (err) {
    if (missingTable(err)) return true;
    throw err;
  }
}
