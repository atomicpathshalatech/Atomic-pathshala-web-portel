import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { pushBoardUpdated, pushPageChanged } from "@/lib/whiteboard/board-mirror";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const pages = await prisma.whiteboardPage.findMany({
      where: { sessionId: params.id },
      orderBy: { pageNumber: "asc" },
    });
    return apiSuccess({ pages });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Adds a blank page and makes it the active one. Teacher-only.
 * Body { afterPageNumber } puts it right after that slide (the slides behind
 * it move one place back); with no body it goes at the end.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({ where: { id: params.id } });
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    if (wbSession.status === "ENDED") return apiError("This session has ended.", 409);

    const pageCount = await prisma.whiteboardPage.count({ where: { sessionId: params.id } });
    const body = (await request.json().catch(() => null)) as { afterPageNumber?: unknown } | null;
    const after = Number(body?.afterPageNumber);
    const insertAfter = Number.isInteger(after) && after >= 1 && after < pageCount ? after : null;
    const nextPageNumber = insertAfter ? insertAfter + 1 : pageCount + 1;

    // Slides behind the new one move back by one — last first, so two slides
    // never hold the same number on the way.
    const behind = insertAfter
      ? await prisma.whiteboardPage.findMany({
          where: { sessionId: params.id, pageNumber: { gt: insertAfter } },
          select: { id: true, pageNumber: true },
          orderBy: { pageNumber: "desc" },
        })
      : [];

    const results = await prisma.$transaction([
      ...behind.map((p) => prisma.whiteboardPage.update({ where: { id: p.id }, data: { pageNumber: p.pageNumber + 1 } })),
      prisma.whiteboardPage.create({
        data: { sessionId: params.id, pageNumber: nextPageNumber, objects: [] },
      }),
      prisma.whiteboardSession.update({
        where: { id: params.id },
        data: { activePageNumber: nextPageNumber },
      }),
    ]);
    const page = results[behind.length] as Awaited<ReturnType<typeof prisma.whiteboardPage.create>>;

    // Without this, a student's view of "which page is the teacher on"
    // only ever catches up via their 2.5s board-mirror poll fallback — fine
    // for the rare case, but addPage is a common teacher action (every new
    // slide/PDF page), so it deserves the same instant push the PATCH
    // .../route.ts activePageNumber switch already gets.
    await pushPageChanged(params.id, nextPageNumber);
    // Slides were renumbered: mirrors re-read the board, not just the page number.
    if (insertAfter) await pushBoardUpdated(params.id, nextPageNumber, 0);

    // After an insert the client needs the renumbered slides.
    const pages = insertAfter
      ? await prisma.whiteboardPage.findMany({ where: { sessionId: params.id }, orderBy: { pageNumber: "asc" } })
      : undefined;
    return apiSuccess({ page, ...(pages && { pages }) }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
