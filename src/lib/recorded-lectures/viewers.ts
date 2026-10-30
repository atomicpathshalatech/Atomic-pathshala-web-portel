import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Chosen students: a chapter's recorded lectures in a batch can be limited
 * to students picked by the team (RecordedChapterAccess.selectedOnly +
 * RecordedChapterViewer rows). No access row: every active student of the
 * batch. Before the migration has run the tables are missing — then nothing
 * is limited (same as before this feature).
 */

const key = (batchId: string, chapterId: string) => `${batchId}:${chapterId}`;

function missingTable(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022");
}

/** "batchId:chapterId" pairs this student may NOT see (limited to others). */
export async function blockedChapters(studentId: string, batchIds: string[]): Promise<Set<string>> {
  if (!batchIds.length) return new Set();
  try {
    const limited = await prisma.recordedChapterAccess.findMany({
      where: { batchId: { in: batchIds }, selectedOnly: true },
      select: { batchId: true, chapterId: true },
    });
    if (!limited.length) return new Set();
    const mine = await prisma.recordedChapterViewer.findMany({
      where: { studentId, batchId: { in: batchIds } },
      select: { batchId: true, chapterId: true },
    });
    const allowed = new Set(mine.map((m) => key(m.batchId, m.chapterId)));
    return new Set(limited.map((l) => key(l.batchId, l.chapterId)).filter((k) => !allowed.has(k)));
  } catch (err) {
    if (missingTable(err)) return new Set();
    throw err;
  }
}

export function isBlocked(blocked: Set<string>, batchId: string, chapterId: string): boolean {
  return blocked.has(key(batchId, chapterId));
}

/** The team's setting for one chapter in one batch. */
export async function chapterViewerSetting(batchId: string, chapterId: string): Promise<{ selectedOnly: boolean; studentIds: string[] }> {
  const [access, viewers] = await Promise.all([
    prisma.recordedChapterAccess.findUnique({ where: { batchId_chapterId: { batchId, chapterId } }, select: { selectedOnly: true } }),
    prisma.recordedChapterViewer.findMany({ where: { batchId, chapterId }, select: { studentId: true } }),
  ]);
  return { selectedOnly: Boolean(access?.selectedOnly), studentIds: viewers.map((v) => v.studentId) };
}

/** Replaces the setting: everyone, or exactly these students. */
export async function saveChapterViewers(p: { batchId: string; chapterId: string; selectedOnly: boolean; studentIds: string[]; userId: string }) {
  await prisma.$transaction(async (tx) => {
    await tx.recordedChapterAccess.upsert({
      where: { batchId_chapterId: { batchId: p.batchId, chapterId: p.chapterId } },
      update: { selectedOnly: p.selectedOnly, updatedById: p.userId },
      create: { batchId: p.batchId, chapterId: p.chapterId, selectedOnly: p.selectedOnly, updatedById: p.userId },
    });
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
