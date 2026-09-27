import "server-only";
import type { Prisma, WhiteboardPage } from "@prisma/client";
import { prisma } from "@/lib/db";

export type PageSaveResult =
  | { ok: true; page: WhiteboardPage }
  | { ok: false; conflict: true; currentVersion: number | null };

/**
 * Saves a whiteboard page with optimistic concurrency. With `baseVersion`,
 * the write applies only if the stored page is still at that version
 * (compare-and-set in one UPDATE) — so a save that was built on older state
 * and arrives late can never overwrite newer strokes. Every successful save
 * bumps the version. Without `baseVersion` (older clients) it saves
 * unconditionally, still bumping the version.
 */
export async function saveWhiteboardPage(input: {
  sessionId: string;
  pageId: string;
  objects: Prisma.InputJsonValue;
  background?: string;
  baseVersion?: number;
}): Promise<PageSaveResult> {
  const data = {
    objects: input.objects,
    ...(input.background !== undefined && { background: input.background }),
    version: { increment: 1 },
  };
  if (input.baseVersion !== undefined) {
    const res = await prisma.whiteboardPage.updateMany({
      where: { id: input.pageId, sessionId: input.sessionId, version: input.baseVersion },
      data,
    });
    if (res.count === 0) {
      const current = await prisma.whiteboardPage.findUnique({ where: { id: input.pageId }, select: { version: true } });
      return { ok: false, conflict: true, currentVersion: current?.version ?? null };
    }
  } else {
    await prisma.whiteboardPage.update({ where: { id: input.pageId }, data });
  }
  return { ok: true, page: await prisma.whiteboardPage.findUniqueOrThrow({ where: { id: input.pageId } }) };
}
