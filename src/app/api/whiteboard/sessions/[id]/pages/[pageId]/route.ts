import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { whiteboardPageAutosaveSchema } from "@/lib/validation/whiteboard";
import { pushBoardUpdated } from "@/lib/whiteboard/board-mirror";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { deleteFile, keyFromPublicUrl } from "@/lib/storage";

/**
 * Debounced autosave target. The teacher client (see the live-class UI's use
 * of canvas-engine.ts's onCommit hook) batches strokes in memory and calls
 * this on a short debounce plus on page-switch/unload — never per stroke or
 * per pointer move, per the spec's performance rules. Intentionally NOT
 * audit-logged: this fires dozens of times per class and isn't the kind of
 * accountable action audit logs are for (compare WHITEBOARD_SESSION_STARTED/
 * ENDED, which are logged).
 *
 * Also accepts an optional `background` — the Slide Theme (light/dark)
 * control routes through here rather than a separate endpoint, since it's
 * just another field on the same row. An *uploaded image* background goes
 * through .../pages/[pageId]/background instead (see that route), which is
 * why this one only ever treats `background` as a plain string swap, never
 * an upload — if the page previously pointed at an uploaded image and this
 * call replaces it with "light"/"dark", the now-orphaned object is cleaned
 * up the same way profile-photo/doubt-attachment replacements already are.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; pageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const page = await prisma.whiteboardPage.findFirst({
      where: { id: params.pageId, sessionId: params.id },
    });
    if (!page) return apiError("Page not found", 404);

    const input = whiteboardPageAutosaveSchema.parse(await request.json());

    const updated = await prisma.whiteboardPage.update({
      where: { id: params.pageId },
      data: {
        objects: input.objects as Prisma.InputJsonValue,
        ...(input.background !== undefined && { background: input.background }),
      },
    });

    if (input.background !== undefined && input.background !== page.background) {
      const oldKey = keyFromPublicUrl(page.background);
      if (oldKey) deleteFile(oldKey).catch(() => undefined);
    }

    // Board mirroring: only broadcast when this is the page students are
    // currently looking at — an edit on a page the teacher has since
    // navigated away from would just be a wasted signal (and a confusing
    // one, since /board always serves the *active* page, not this one).
    const wbSessionForBroadcast = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: { activePageNumber: true },
    });
    if (wbSessionForBroadcast && wbSessionForBroadcast.activePageNumber === updated.pageNumber) {
      await pushBoardUpdated(params.id, updated.pageNumber);
    }

    return apiSuccess({ page: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Teacher-only. Deletes one page and renumbers the survivors back to a
 * contiguous 1..N range — every other page route (addPage's pageCount+1,
 * the prev/next toolbar controls, sessionId_pageNumber lookups) assumes no
 * gaps, so this can't just soft-delete and leave holes.
 *
 * The renumbering updates run in ascending original-pageNumber order with
 * strictly-decreasing-or-equal targets (idx+1). That ordering is what makes
 * it safe against the sessionId_pageNumber unique constraint inside a single
 * transaction: by the time any update writes target number T, whichever
 * page previously held T has either already been moved off it by an earlier
 * update in this same sequence, or T was vacated by the initial delete.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; pageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({ where: { id: params.id } });
    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const page = await prisma.whiteboardPage.findFirst({
      where: { id: params.pageId, sessionId: params.id },
    });
    if (!page) return apiError("Page not found", 404);

    const pageCount = await prisma.whiteboardPage.count({ where: { sessionId: params.id } });
    if (pageCount <= 1) {
      return apiError("A live board needs at least one page — you can't delete the last one.", 400);
    }

    const oldKey = keyFromPublicUrl(page.background);
    if (oldKey) deleteFile(oldKey).catch(() => undefined);

    const remaining = await prisma.whiteboardPage.findMany({
      where: { sessionId: params.id, id: { not: params.pageId } },
      orderBy: { pageNumber: "asc" },
    });

    const newActivePageNumber = Math.max(
      1,
      wbSession.activePageNumber > page.pageNumber
        ? wbSession.activePageNumber - 1
        : Math.min(wbSession.activePageNumber, remaining.length)
    );

    await prisma.$transaction([
      prisma.whiteboardPage.delete({ where: { id: params.pageId } }),
      ...remaining.map((p, idx) =>
        prisma.whiteboardPage.update({ where: { id: p.id }, data: { pageNumber: idx + 1 } })
      ),
      prisma.whiteboardSession.update({
        where: { id: params.id },
        data: { activePageNumber: newActivePageNumber },
      }),
    ]);

    const pages = await prisma.whiteboardPage.findMany({
      where: { sessionId: params.id },
      orderBy: { pageNumber: "asc" },
    });

    await pushBoardUpdated(params.id, newActivePageNumber);

    return apiSuccess({ pages, activePageNumber: newActivePageNumber });
  } catch (error) {
    return handleApiError(error);
  }
}
